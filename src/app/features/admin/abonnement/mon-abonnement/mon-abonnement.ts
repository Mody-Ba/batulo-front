import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router, RouterLink } from '@angular/router';
import { FormControl } from '@angular/forms';
import {
  abonnementEnAlerte,
  FormuleResponse,
  LIBELLES_FORMULE,
  LIBELLES_FOURNISSEUR,
  LIBELLES_STATUT_ABONNEMENT,
  LIBELLES_TYPE_PAIEMENT,
  offreAchat,
  PaiementResponse,
} from '../../../../core/models/abonnement.model';
import { AbonnementService } from '../../../../core/services/abonnement.service';
import { AuthService } from '../../../../core/services/auth.service';
import { bornesAchat, quantiteValide, validateurQuantite } from '../../../../core/utils/achat-sondages';
import { QuantiteSondages } from '../../../../shared/components/quantite-sondages/quantite-sondages';
import { montantEnClair } from '../../../../core/utils/montant';
import { Encadre } from '../../../../shared/components/encadre/encadre';
import { EntetePage } from '../../../../shared/components/entete-page/entete-page';
import { MessageErreur } from '../../../../shared/components/message-erreur/message-erreur';
import { DateLPipe } from '../../../../core/i18n/formats.pipes';
import { TranslocoPipe } from '@jsverse/transloco';
import { PlurielPipe } from '../../../../core/i18n/formats.pipes';
import { NombreLPipe } from '../../../../core/i18n/formats.pipes';

/** Tailles proposées pour l'historique des paiements. */
export const TAILLES_PAIEMENTS = [5, 10, 20];

/**
 * Détail de l'abonnement de l'entreprise, historique des paiements réussis (paginé, du plus récent au plus
 * ancien) et renouvellement. Pas d'annulation : l'abonnement
 * s'arrête de lui-même à sa date d'expiration.
 */
@Component({
  selector: 'app-mon-abonnement',
  imports: [NombreLPipe, PlurielPipe, TranslocoPipe, DateLPipe, QuantiteSondages,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressBarModule,
    EntetePage,
    Encadre,
    MessageErreur,
  ],
  templateUrl: './mon-abonnement.html',
  styleUrl: './mon-abonnement.scss',
})
export class MonAbonnement {
  private readonly service = inject(AbonnementService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);

  protected readonly abonnement = this.service.abonnement;
  protected readonly libellesFormule = LIBELLES_FORMULE;
  protected readonly libellesFournisseur = LIBELLES_FOURNISSEUR;
  protected readonly libellesType = LIBELLES_TYPE_PAIEMENT;
  protected readonly montant = montantEnClair;
  protected readonly libellesStatut = LIBELLES_STATUT_ABONNEMENT;
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<unknown>(null);

  protected readonly taillesPaiements = TAILLES_PAIEMENTS;
  protected readonly paiements = signal<PaiementResponse[]>([]);
  protected readonly totalPaiements = signal(0);
  protected readonly pagePaiements = signal(0);
  protected readonly taillePaiements = signal(TAILLES_PAIEMENTS[0]);
  protected readonly chargementPaiements = signal(true);
  protected readonly erreurPaiements = signal<unknown>(null);

  /** Offre d'achat de sondages (prix d'un sondage), lue dans /formules ; carte masquée si absente. */
  protected readonly offreAchat = signal<FormuleResponse | null>(null);
  protected readonly nombreSondages = new FormControl<number | null>(1, {
    validators: [validateurQuantite(() => bornesAchat(this.offreAchat()))],
  });
  /** Solde affiché dans la carte d'achat si l'entreprise a déjà acheté. */
  protected readonly credits = computed(() => this.abonnement()?.credits ?? this.auth.credits());

  protected readonly enAlerte = computed(() => abonnementEnAlerte(this.abonnement()));
  protected readonly expire = computed(() => this.abonnement()?.statut === 'EXPIRE');

  constructor() {
    this.charger();
    this.chargerPaiements();
    this.service
      .formules()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (formules) => {
          this.offreAchat.set(offreAchat(formules) ?? null);
          this.nombreSondages.updateValueAndValidity();
        },
        // Sans tarifs, pas de carte d'achat (la page reste utilisable).
        error: () => this.offreAchat.set(null),
      });
  }

  /** « Continuer vers le paiement » : souscription en mode achat, nombre gardé dans l'URL (carte ou mobile ensuite). */
  protected acheter(): void {
    const quantite = this.nombreSondages.value;
    if (!quantiteValide(quantite, bornesAchat(this.offreAchat()))) {
      this.nombreSondages.markAsTouched();
      return;
    }
    void this.router.navigate(['/admin/abonnement/souscrire'], {
      queryParams: { offre: 'ACHAT_SONDAGES', quantite },
    });
  }

  protected changerPagePaiements(evenement: PageEvent): void {
    this.pagePaiements.set(evenement.pageIndex);
    this.taillePaiements.set(evenement.pageSize);
    this.chargerPaiements();
  }

  protected chargerPaiements(): void {
    this.chargementPaiements.set(true);
    this.erreurPaiements.set(null);
    this.service
      .paiements(this.pagePaiements(), this.taillePaiements())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.paiements.set(page.contenu);
          this.totalPaiements.set(page.totalElements);
          this.chargementPaiements.set(false);
        },
        error: (erreur: unknown) => {
          this.erreurPaiements.set(erreur);
          this.chargementPaiements.set(false);
        },
      });
  }

  protected charger(): void {
    this.chargement.set(true);
    this.erreur.set(null);
    this.service
      .monAbonnement()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: () => this.chargement.set(false),
        error: (erreur: unknown) => {
          this.chargement.set(false);
          this.erreur.set(erreur);
        },
      });
  }
}
