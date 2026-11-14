import { DatePipe } from '@angular/common';
import { afterNextRender, Component, computed, ElementRef, inject, Injector, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { concatMap, Observable, of, tap } from 'rxjs';
import { DatesSondageRequest, SondageResponse } from '../../../../core/models/sondage.model';
import { SondageService } from '../../../../core/services/sondage.service';
import { Encadre } from '../../../../shared/components/encadre/encadre';
import { MessageErreur } from '../../../../shared/components/message-erreur/message-erreur';
import { raisonIncomplet, versIso, versLocal } from '../dates-sondage';

export interface DonneesPublication {
  sondage: SondageResponse;
  /** publier : un brouillon ; dates : ajuster un sondage publié pas encore terminé (PUT .../dates). */
  mode: 'publier' | 'dates';
  /**
   * Appelée dès que « une réponse par appareil » a été enregistré (PUT du brouillon), même si la publication échoue
   * ensuite : l'éditeur se met à jour pour ne pas rétablir l'ancienne valeur à sa prochaine sauvegarde.
   */
  surReglageEnregistre?: (sondage: SondageResponse) => void;
}

/** Étape qui a échoué, pour un message précis. */
type Etape = 'reglage' | 'publication' | 'dates';

const TITRES_ERREUR: Record<Etape, string> = {
  reglage: 'Le réglage « une réponse par appareil » n’a pas été enregistré : rien n’a été publié',
  publication: 'Le sondage n’a pas été publié',
  dates: 'Les dates n’ont pas été enregistrées',
};

type Ouverture = 'maintenant' | 'planifiee';

/** Vérifications avant l'envoi (le backend renvoie DATES_INVALIDES sinon). */
function datesValides(groupe: AbstractControl): ValidationErrors | null {
  const v = groupe.getRawValue() as {
    ouverture: Ouverture;
    dateOuverture: string;
    avecFermeture: boolean;
    dateFermeture: string;
  };
  const maintenant = Date.now();
  const erreurs: ValidationErrors = {};
  let ouverture = maintenant;
  if (v.ouverture === 'planifiee') {
    const date = versIso(v.dateOuverture);
    if (!date) {
      erreurs['ouvertureManquante'] = true;
    } else if (new Date(date).getTime() <= maintenant) {
      erreurs['ouverturePassee'] = true;
    } else {
      ouverture = new Date(date).getTime();
    }
  }
  if (v.avecFermeture) {
    const date = versIso(v.dateFermeture);
    if (!date) {
      erreurs['fermetureManquante'] = true;
    } else if (new Date(date).getTime() <= Math.max(ouverture, maintenant)) {
      erreurs['fermetureAvantOuverture'] = true;
    }
  }
  return Object.keys(erreurs).length ? erreurs : null;
}

/**
 * Publier un brouillon (ouverture maintenant ou planifiée, fermeture facultative, « une réponse par appareil »),
 * ou ajuster les dates d'un sondage publié. La boîte rappelle que le contenu sera ensuite figé. Si le réglage
 * « une réponse par appareil » change, il est enregistré (PUT du brouillon) juste avant la publication.
 * Résultat : le sondage à jour, ou rien si la boîte est fermée.
 */
@Component({
  selector: 'app-dialogue-publication',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatRadioModule,
    Encadre,
    MessageErreur,
  ],
  templateUrl: './dialogue-publication.html',
  styleUrl: './dialogue-publication.scss',
})
export class DialoguePublication {
  private readonly service = inject(SondageService);
  private readonly reference = inject<MatDialogRef<DialoguePublication, SondageResponse>>(MatDialogRef);
  protected readonly donnees = inject<DonneesPublication>(MAT_DIALOG_DATA);
  protected readonly sondage = this.donnees.sondage;
  protected readonly publier = this.donnees.mode === 'publier';
  /** Ajustement : l'ouverture ne se modifie plus une fois le sondage ouvert. */
  protected readonly dejaOuvert = !this.publier && this.sondage.statut !== 'NON_COMMENCE';
  protected readonly incomplet = this.publier ? raisonIncomplet(this.sondage.sections) : null;
  /** Minimum des champs date et heure : maintenant. */
  protected readonly minimum = versLocal(new Date().toISOString());

  protected readonly formulaire = new FormGroup(
    {
      ouverture: new FormControl<Ouverture>(
        !this.publier && this.sondage.statut === 'NON_COMMENCE' ? 'planifiee' : 'maintenant',
        { nonNullable: true },
      ),
      dateOuverture: new FormControl(this.publier ? '' : versLocal(this.sondage.datePublication), { nonNullable: true }),
      avecFermeture: new FormControl(!!this.sondage.dateFermeture, { nonNullable: true }),
      dateFermeture: new FormControl(versLocal(this.sondage.dateFermeture), { nonNullable: true }),
      reponseUnique: new FormControl(this.sondage.reponseUnique, { nonNullable: true }),
    },
    { validators: this.dejaOuvert ? null : datesValides },
  );

  private readonly valeurs = toSignal(this.formulaire.valueChanges, { initialValue: this.formulaire.getRawValue() });
  protected readonly planifiee = computed(() => this.valeurs().ouverture === 'planifiee');
  protected readonly avecFermeture = computed(() => !!this.valeurs().avecFermeture);

  protected readonly enCours = signal(false);
  protected readonly erreur = signal<unknown>(null);
  protected readonly titreErreur = signal<string | null>(null);
  /** Formulaire refusé sans message plus précis (cas imprévu) : jamais d'échec silencieux. */
  protected readonly invalideSansDetail = signal(false);
  protected readonly tente = signal(false);

  private readonly injector = inject(Injector);
  private readonly zoneErreur = viewChild<ElementRef<HTMLElement>>('zoneErreur');
  /** Réglage déjà enregistré par un essai précédent : pas besoin de le renvoyer. */
  private reponseUniqueEnregistree: boolean;

  constructor() {
    this.reponseUniqueEnregistree = this.sondage.reponseUnique;
    if (this.dejaOuvert) {
      // Sondage ouvert : seule la fermeture prévue se règle (après maintenant).
      this.formulaire.setValidators((groupe) => {
        const v = groupe.getRawValue();
        if (!v.avecFermeture) {
          return null;
        }
        const date = versIso(v.dateFermeture);
        if (!date) {
          return { fermetureManquante: true };
        }
        return new Date(date).getTime() <= Date.now() ? { fermetureAvantOuverture: true } : null;
      });
    }
  }

  protected aErreur(code: string): boolean {
    return this.tente() && this.formulaire.hasError(code);
  }

  protected valider(): void {
    if (this.enCours() || this.incomplet) {
      return;
    }
    this.tente.set(true);
    this.formulaire.updateValueAndValidity();
    const connues = ['ouvertureManquante', 'ouverturePassee', 'fermetureManquante', 'fermetureAvantOuverture'];
    this.invalideSansDetail.set(this.formulaire.invalid && !connues.some((code) => this.formulaire.hasError(code)));
    if (this.formulaire.invalid) {
      this.afficherErreur();
      return;
    }
    this.enCours.set(true);
    this.erreur.set(null);
    this.titreErreur.set(null);
    this.reference.disableClose = true;
    let etape: Etape = this.publier ? 'publication' : 'dates';
    this.envoi((e) => (etape = e)).subscribe({
      next: (sondage) => this.reference.close(sondage),
      error: (erreur: unknown) => {
        this.enCours.set(false);
        this.reference.disableClose = false;
        this.titreErreur.set(TITRES_ERREUR[etape]);
        this.erreur.set(erreur);
        this.afficherErreur();
      },
    });
  }

  /** L'erreur est en haut du dialogue : on y fait défiler et on y met le focus (annoncée par role="alert"). */
  private afficherErreur(): void {
    afterNextRender(
      () => {
        const zone = this.zoneErreur()?.nativeElement;
        zone?.scrollIntoView?.({ block: 'nearest' });
        zone?.focus();
      },
      { injector: this.injector },
    );
  }

  private envoi(etape: (e: Etape) => void): Observable<SondageResponse> {
    const v = this.formulaire.getRawValue();
    const fermeture = v.avecFermeture ? versIso(v.dateFermeture) : null;
    if (!this.publier) {
      // Ajustement : ouverture absente = inchangée ; fermeture absente = pas de fermeture prévue.
      const dates: DatesSondageRequest = { dateFermeture: fermeture };
      if (!this.dejaOuvert) {
        // Date inchangée (à la minute près) : la date exacte d'origine, pour ne pas la décaler de quelques secondes.
        const inchangee = v.dateOuverture === versLocal(this.sondage.datePublication);
        dates.datePublication =
          v.ouverture === 'maintenant'
            ? new Date().toISOString()
            : inchangee
              ? this.sondage.datePublication
              : versIso(v.dateOuverture);
      }
      return this.service.modifierDates(this.sondage.id, dates);
    }
    const dates: DatesSondageRequest = {
      datePublication: v.ouverture === 'planifiee' ? versIso(v.dateOuverture) : null,
      dateFermeture: fermeture,
    };
    // « Une réponse par appareil » se règle dans le brouillon et se fige à la publication.
    const reglage =
      v.reponseUnique === this.reponseUniqueEnregistree
        ? of(this.sondage)
        : of(null).pipe(
            tap(() => etape('reglage')),
            concatMap(() =>
              this.service.modifier(this.sondage.id, {
                titre: this.sondage.titre,
                description: this.sondage.description,
                reponseUnique: v.reponseUnique,
              }),
            ),
            tap((brouillon) => {
              this.reponseUniqueEnregistree = brouillon.reponseUnique;
              this.donnees.surReglageEnregistre?.(brouillon);
            }),
          );
    return reglage.pipe(
      tap(() => etape('publication')),
      concatMap(() => this.service.publier(this.sondage.id, dates)),
    );
  }
}
