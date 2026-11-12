import { CurrencyPipe, DatePipe, UpperCasePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import {
  abonnementEnAlerte,
  LIBELLES_FORMULE,
  LIBELLES_STATUT_ABONNEMENT,
  PaiementResponse,
} from '../../../../core/models/abonnement.model';
import { AbonnementService } from '../../../../core/services/abonnement.service';
import { Encadre } from '../../../../shared/components/encadre/encadre';
import { EntetePage } from '../../../../shared/components/entete-page/entete-page';
import { MessageErreur } from '../../../../shared/components/message-erreur/message-erreur';

/** Tailles proposées pour l'historique des paiements. */
export const TAILLES_PAIEMENTS = [5, 10, 20];

/**
 * Détail de l'abonnement de l'entreprise, historique des paiements réussis (paginé, du plus récent au plus
 * ancien) et renouvellement. Pas d'annulation : l'abonnement
 * s'arrête de lui-même à sa date d'expiration.
 */
@Component({
  selector: 'app-mon-abonnement',
  imports: [
    CurrencyPipe,
    DatePipe,
    UpperCasePipe,
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

  protected readonly abonnement = this.service.abonnement;
  protected readonly libellesFormule = LIBELLES_FORMULE;
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

  protected readonly enAlerte = computed(() => abonnementEnAlerte(this.abonnement()));
  protected readonly expire = computed(() => this.abonnement()?.statut === 'EXPIRE');

  constructor() {
    this.charger();
    this.chargerPaiements();
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
