import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { TextFieldModule } from '@angular/cdk/text-field';
import { Component, computed, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { filter, map, Observable, of, switchMap } from 'rxjs';
import {
  classeEtatSondage,
  libelleEtatSondage,
  SectionResponse,
  SondageRequest,
  SondageResponse,
} from '../../../core/models/sondage.model';
import { SondageService } from '../../../core/services/sondage.service';
import { messageErreur } from '../../../core/utils/erreur-http';
import { REGLES_SONDAGE } from '../../../core/utils/regles-question';
import { nonVide } from '../../../core/utils/validateurs';
import { confirmer } from '../../../shared/components/dialogue-confirmation/dialogue-confirmation';
import { Encadre } from '../../../shared/components/encadre/encadre';
import { MessageErreur } from '../../../shared/components/message-erreur/message-erreur';
import { ActionsSondage } from '../cycle-de-vie/actions-sondage';
import { CarteSection } from './carte-section/carte-section';
import { EditeurSondageStore } from './editeur-sondage.store';
import { EnregistrementAuto, EtatEnregistrement } from './enregistrement-auto';
import { EtatEnregistrementIndicateur } from './etat-enregistrement/etat-enregistrement';

/** Page qui peut demander confirmation avant d'être quittée (garde `quitterEditeurGuard`). */
export interface PeutQuitter {
  peutQuitter(): Observable<boolean>;
}

/**
 * Éditeur d'un sondage (F5a), comme Google Forms : en-tête (titre, description, réponse unique), sections et
 * questions, enregistrés élément par élément et automatiquement. Lecture seule si le sondage est publié ou fermé,
 * si l'abonnement est expiré ou si l'utilisateur n'a pas le droit de le modifier (bandeau explicatif).
 */
@Component({
  selector: 'app-editeur-sondage',
  imports: [
    CdkDrag,
    CdkDropList,
    TextFieldModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressBarModule,
    Encadre,
    MessageErreur,
    CarteSection,
    EtatEnregistrementIndicateur,
  ],
  providers: [EditeurSondageStore],
  templateUrl: './editeur-sondage.html',
  styleUrl: './editeur-sondage.scss',
  host: { '(window:beforeunload)': 'avantDechargement($event)' },
})
export class EditeurSondage implements PeutQuitter {
  protected readonly store = inject(EditeurSondageStore);
  private readonly service = inject(SondageService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly actions = inject(ActionsSondage);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly regles = REGLES_SONDAGE;
  protected readonly libelleEtat = libelleEtatSondage;
  protected readonly classeEtat = classeEtatSondage;
  protected readonly parId = (_index: number, section: SectionResponse) => section.id;

  /** Paramètre de route :id. */
  readonly id = input.required<string>();

  protected readonly chargement = signal(true);
  protected readonly erreur = signal<unknown>(null);
  protected readonly ajoutSectionEnCours = signal(false);
  /** Brouillon supprimé : rien à enregistrer, on quitte sans confirmation. */
  private quitterSansConfirmer = false;

  protected readonly formulaire = new FormGroup({
    titre: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, nonVide, Validators.maxLength(REGLES_SONDAGE.titreMax)],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(REGLES_SONDAGE.descriptionMax)],
    }),
    reponseUnique: new FormControl(true, { nonNullable: true }),
  });
  /** Créé au premier chargement du sondage. */
  protected readonly enTete = signal<EnregistrementAuto<SondageRequest> | null>(null);

  protected readonly sections = computed(() => this.store.sondage()?.sections ?? []);
  protected readonly limiteSections = computed(() => this.sections().length >= REGLES_SONDAGE.sectionsMax);
  protected readonly etatGlobal = computed<EtatEnregistrement>(() => {
    switch (this.store.etatGlobal()) {
      case 'enregistrement':
        return 'enregistrement';
      case 'erreur':
        return 'invalide';
      case 'a-enregistrer':
        return 'modifie';
      default:
        return 'enregistre';
    }
  });

  constructor() {
    effect(() => {
      const id = Number(this.id());
      untracked(() => this.charger(id));
    });
    effect(() => {
      if (this.store.modifiable()) {
        this.formulaire.enable({ emitEvent: false });
      } else {
        this.formulaire.disable({ emitEvent: false });
      }
    });
    effect(() => {
      const enTete = this.enTete();
      if (enTete) {
        this.store.signalerEtat('en-tete', enTete.etat());
      }
    });
  }

  protected charger(id = Number(this.id())): void {
    this.chargement.set(true);
    this.erreur.set(null);
    this.store
      .charger(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sondage) => {
          this.initialiserEnTete(sondage);
          this.chargement.set(false);
        },
        error: (erreur: unknown) => {
          this.erreur.set(erreur);
          this.chargement.set(false);
        },
      });
  }

  /** Publication : tout doit être enregistré d'abord (la publication fige le contenu enregistré). */
  protected publier(sondage: SondageResponse): void {
    if (this.store.modificationsEnAttente()) {
      this.snackBar.open(
        'Des modifications ne sont pas encore enregistrées : corrigez-les ou attendez « Tout est enregistré ».',
        'Fermer',
        { duration: 6000 },
      );
      return;
    }
    this.actions
      .publier(sondage, (brouillon) => {
        // Réglage enregistré par le dialogue : l'en-tête suit, sinon sa prochaine sauvegarde rétablirait l'ancien.
        this.store.remplacer(brouillon);
        this.formulaire.controls.reponseUnique.setValue(brouillon.reponseUnique, { emitEvent: false });
      })
      .subscribe((publie) => this.store.remplacer(publie));
  }

  protected nouvelleVersion(sondage: SondageResponse): void {
    this.actions.nouvelleVersion(sondage).subscribe();
  }

  protected sortieEnTete(): void {
    this.enTete()?.maintenant();
  }

  protected ajouterSection(): void {
    this.ajoutSectionEnCours.set(true);
    this.store.ajouterSection({ titre: `Section ${this.sections().length + 1}`, description: null }).subscribe({
      next: () => this.ajoutSectionEnCours.set(false),
      error: (erreur: unknown) => {
        this.ajoutSectionEnCours.set(false);
        this.snackBar.open(messageErreur(erreur), 'Fermer', { duration: 6000 });
      },
    });
  }

  protected deposerSection(evenement: CdkDragDrop<unknown>): void {
    this.store.deplacerSection(evenement.previousIndex, evenement.currentIndex).subscribe({
      error: (erreur: unknown) => {
        this.snackBar.open(messageErreur(erreur), 'Fermer', { duration: 6000 });
        this.store.recharger();
      },
    });
  }

  protected supprimerBrouillon(sondage: SondageResponse): void {
    confirmer(this.dialog, {
      titre: 'Supprimer ce brouillon ?',
      message: `« ${sondage.titre} » sera supprimé définitivement, avec ses sections et ses questions. Cette action est irréversible.`,
      action: 'Supprimer le brouillon',
      destructive: true,
    })
      .pipe(
        filter(Boolean),
        switchMap(() => this.service.supprimer(sondage.id)),
      )
      .subscribe({
        next: () => {
          this.snackBar.open('Brouillon supprimé.', 'Fermer', { duration: 5000 });
          this.quitterSansConfirmer = true;
          void this.router.navigateByUrl('/sondages');
        },
        error: (erreur: unknown) => this.snackBar.open(messageErreur(erreur), 'Fermer', { duration: 6000 }),
      });
  }

  /** Garde de sortie : confirmation si quelque chose n'est pas enregistré. */
  peutQuitter(): Observable<boolean> {
    if (this.quitterSansConfirmer || !this.store.modificationsEnAttente()) {
      return of(true);
    }
    const nombre = this.store.nombreNonEnregistres();
    return confirmer(this.dialog, {
      titre: 'Quitter l’éditeur ?',
      message:
        nombre > 0
          ? `${nombre === 1 ? 'Un élément n’est' : `${nombre} éléments ne sont`} pas enregistrés (à corriger ou en cours). Ces modifications seront perdues.`
          : 'Un enregistrement est en cours : attendez qu’il se termine pour ne rien perdre.',
      action: 'Quitter quand même',
      destructive: true,
    }).pipe(map(Boolean));
  }

  protected avantDechargement(evenement: BeforeUnloadEvent): void {
    if (!this.quitterSansConfirmer && this.store.modificationsEnAttente()) {
      evenement.preventDefault();
    }
  }

  private initialiserEnTete(sondage: SondageResponse): void {
    if (this.enTete()) {
      return;
    }
    this.formulaire.setValue(
      { titre: sondage.titre, description: sondage.description ?? '', reponseUnique: sondage.reponseUnique },
      { emitEvent: false },
    );
    this.enTete.set(
      new EnregistrementAuto<SondageRequest>({
        formulaire: this.formulaire,
        requete: () => this.requeteEnTete(),
        envoyer: (requete) => this.store.modifierEnTete(requete),
        enregistree: this.requeteEnTete(),
        destroyRef: this.destroyRef,
      }),
    );
    this.destroyRef.onDestroy(() => this.store.oublierEtat('en-tete'));
  }

  private requeteEnTete(): SondageRequest {
    const { titre, description, reponseUnique } = this.formulaire.getRawValue();
    return { titre: titre.trim(), description: description.trim() || null, reponseUnique };
  }
}
