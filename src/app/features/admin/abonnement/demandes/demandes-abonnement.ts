import { LowerCasePipe } from '@angular/common';
import { afterNextRender, Component, computed, DestroyRef, ElementRef, inject, Injector, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { Formule, FORMULES, LIBELLES_FORMULE } from '../../../../core/models/abonnement.model';
import {
  DemandeAbonnementResponse,
  LIBELLES_STATUT_DEMANDE,
  LONGUEUR_MAX_MESSAGE_DEMANDE,
} from '../../../../core/models/demande-abonnement.model';
import { DemandeAbonnementService } from '../../../../core/services/demande-abonnement.service';
import { aLeCode } from '../../../../core/utils/erreur-http';
import { Encadre } from '../../../../shared/components/encadre/encadre';
import { EntetePage } from '../../../../shared/components/entete-page/entete-page';
import { MessageErreur } from '../../../../shared/components/message-erreur/message-erreur';
import { DateLPipe } from '../../../../core/i18n/formats.pipes';

/** Demandes lues (les plus récentes d'abord) ; un admin en a peu. */
const TAILLE = 20;

/**
 * Admin : demande d'augmentation d'abonnement (formule souhaitée + message), postée dans la conversation avec Batulo,
 * et liste de ses demandes avec leur statut et la réponse. Purement informative : acceptée, l'admin paie lui-même la
 * formule par carte (aucun abonnement manuel). Permise abonnement expiré ; une seule demande en attente à la fois.
 * ?demande={id} (lien d'une notification ou d'un message automatique) met cette demande en évidence.
 */
@Component({
  selector: 'app-demandes-abonnement',
  imports: [DateLPipe, 
    LowerCasePipe,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    Encadre,
    EntetePage,
    MessageErreur,
  ],
  templateUrl: './demandes-abonnement.html',
  styleUrl: './demandes-abonnement.scss',
})
export class DemandesAbonnement {
  private readonly service = inject(DemandeAbonnementService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly hote = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Paramètre d'URL ?demande=. */
  readonly demande = input<string | undefined>(undefined);
  protected readonly demandeEnEvidence = computed(() => Number(this.demande()) || null);
  protected readonly formules = FORMULES;
  protected readonly libellesFormule = LIBELLES_FORMULE;
  protected readonly libellesStatut = LIBELLES_STATUT_DEMANDE;
  protected readonly max = LONGUEUR_MAX_MESSAGE_DEMANDE;

  protected readonly demandes = signal<DemandeAbonnementResponse[] | null>(null);
  protected readonly total = signal(0);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<unknown>(null);
  protected readonly envoiEnCours = signal(false);
  protected readonly erreurEnvoi = signal<unknown>(null);

  /** Une demande en attente : pas de nouvelle demande (409 DEMANDE_EN_COURS côté backend). */
  protected readonly enAttente = computed(() => this.demandes()?.find((d) => d.statut === 'EN_ATTENTE') ?? null);

  private readonly fb = inject(NonNullableFormBuilder);
  /** Formule choisie explicitement (aucune présélection). */
  protected readonly formulaire = this.fb.group({
    formuleSouhaitee: this.fb.control<Formule | ''>('', Validators.required),
    message: ['', [Validators.required, Validators.maxLength(LONGUEUR_MAX_MESSAGE_DEMANDE), Validators.pattern(/\S/)]],
  });

  constructor() {
    this.charger();
  }

  protected charger(): void {
    this.chargement.set(true);
    this.erreur.set(null);
    this.service
      .mesDemandes(0, TAILLE)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.demandes.set(page.contenu);
          this.total.set(page.totalElements);
          this.chargement.set(false);
          afterNextRender(() => this.montrerDemande(), { injector: this.injector });
        },
        error: (erreur: unknown) => {
          this.erreur.set(erreur);
          this.chargement.set(false);
        },
      });
  }

  /** Demande désignée par l'URL : focus et défilement jusqu'à elle. */
  private montrerDemande(): void {
    const id = this.demandeEnEvidence();
    const element = id ? this.hote.nativeElement.querySelector<HTMLElement>(`#demande-${id}`) : null;
    element?.focus();
    element?.scrollIntoView?.({ block: 'center' });
  }

  protected envoyer(): void {
    if (this.envoiEnCours()) {
      return;
    }
    if (this.formulaire.invalid) {
      this.formulaire.markAllAsTouched();
      return;
    }
    const { formuleSouhaitee, message } = this.formulaire.getRawValue();
    this.envoiEnCours.set(true);
    this.erreurEnvoi.set(null);
    this.service.demander({ formuleSouhaitee: formuleSouhaitee as Formule, message: message.trim() }).subscribe({
      next: (demande) => {
        this.envoiEnCours.set(false);
        this.formulaire.reset();
        this.demandes.update((liste) => [demande, ...(liste ?? [])]);
        this.total.update((n) => n + 1);
        this.snackBar.open('Demande envoyée à Batulo. Vous serez notifié de sa réponse.', 'Fermer', { duration: 5000 });
      },
      error: (erreur: unknown) => {
        this.envoiEnCours.set(false);
        this.erreurEnvoi.set(erreur);
        // Une demande en attente existe déjà (autre onglet) : la liste la montre.
        if (aLeCode(erreur, 'DEMANDE_EN_COURS')) {
          this.charger();
        }
      },
    });
  }
}
