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
import { Router } from '@angular/router';
import { catchError, concatMap, EMPTY, Observable, of, tap } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { DatesSondageRequest, requeteSondage, SondageResponse } from '../../../../core/models/sondage.model';
import { SondageService } from '../../../../core/services/sondage.service';
import { Encadre } from '../../../../shared/components/encadre/encadre';
import { MessageErreur } from '../../../../shared/components/message-erreur/message-erreur';
import { TextesManquants } from '../textes-manquants';
import { aLeCode } from '../../../../core/utils/erreur-http';
import { raisonIncomplet, versIso, versLocal } from '../dates-sondage';
import { DateLPipe, NombreLPipe } from '../../../../core/i18n/formats.pipes';
import { libelles } from '../../../../core/i18n/traduire';
import { TranslocoPipe } from '@jsverse/transloco';

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

const TITRES_ERREUR = libelles<Etape>('sondages.publication.titresErreur', ['reglage', 'publication', 'dates']);

type Ouverture = 'maintenant' | 'planifiee';

/**
 * Coût de la publication hors abonnement en cours, pour une entreprise qui a acheté des sondages (le serveur décide) :
 * credit : version 1, un sondage sera utilisé ; nouvelle-version : gratuite si la lignée a déjà été payée par un
 * crédit, sinon un sondage (le front ne peut pas le savoir) ; epuise : solde à 0 (version 1) ou 402 CREDITS_EPUISES.
 */
export type CoutPublication = 'credit' | 'nouvelle-version' | 'epuise';

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
  imports: [TranslocoPipe, DateLPipe, NombreLPipe, TextesManquants,
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
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
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

  /** Publication avec les sondages achetés : brouillon, sans abonnement en cours, compte de crédits. */
  protected readonly avecCredits = computed(
    () => this.publier && !this.auth.abonnementIllimite() && this.auth.compteCredits(),
  );
  protected readonly solde = computed(() => this.auth.credits()?.solde ?? 0);
  protected readonly estAdmin = computed(() => this.auth.role() === 'ADMIN');
  /** 402 CREDITS_EPUISES reçu à l'envoi (même sans compte de crédits connu). */
  protected readonly refusCredits = computed(() => aLeCode(this.erreur(), 'CREDITS_EPUISES'));
  protected readonly cout = computed<CoutPublication | null>(() => {
    if (this.refusCredits()) {
      return 'epuise';
    }
    if (!this.avecCredits()) {
      return null;
    }
    if (this.sondage.version > 1) {
      return 'nouvelle-version';
    }
    return this.solde() > 0 ? 'credit' : 'epuise';
  });
  /** Version 1 et plus aucun sondage : « Publier » est désactivé (le serveur refuserait par 402). */
  protected readonly bloqueParSolde = computed(() => this.cout() === 'epuise');
  /** 400 TRADUCTIONS_INCOMPLETES : liste des textes manquants et liens vers les traductions. */
  protected readonly traductionsIncompletes = computed(() => aLeCode(this.erreur(), 'TRADUCTIONS_INCOMPLETES'));
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
    // Solde relu à l'ouverture (un autre onglet, ou un gestionnaire, a pu en utiliser) ; jamais bloquant.
    if (this.publier && !this.auth.abonnementIllimite() && this.auth.role() !== 'SUPER_ADMIN' && this.auth.estConnecte()) {
      this.auth
        .chargerProfil()
        .pipe(catchError(() => EMPTY))
        .subscribe();
    }
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

  /** « Acheter des sondages » ou « S'abonner » : la boîte se ferme, la page de souscription s'ouvre. */
  protected allerVers(achat: boolean): void {
    this.reference.close();
    void this.router.navigate(['/admin/abonnement/souscrire'], {
      queryParams: achat ? { offre: 'ACHAT_SONDAGES' } : {},
    });
  }

  protected valider(): void {
    if (this.enCours() || this.incomplet || (this.bloqueParSolde() && !this.refusCredits())) {
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
    const avecCredits = this.avecCredits();
    this.envoi((e) => (etape = e)).subscribe({
      next: (sondage) => {
        if (avecCredits) {
          // Un sondage a peut-être été utilisé : solde relu (bandeau, tableau de bord).
          this.auth
            .chargerProfil()
            .pipe(catchError(() => EMPTY))
            .subscribe();
        }
        this.reference.close(sondage);
      },
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
              this.service.modifier(this.sondage.id, requeteSondage(this.sondage, { reponseUnique: v.reponseUnique })),
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
