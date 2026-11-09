import { CurrencyPipe, DatePipe, UpperCasePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import {
  abonnementEnAlerte,
  LIBELLES_FORMULE,
  LIBELLES_STATUT_ABONNEMENT,
} from '../../../../core/models/abonnement.model';
import { AbonnementService } from '../../../../core/services/abonnement.service';
import { Encadre } from '../../../../shared/components/encadre/encadre';
import { EntetePage } from '../../../../shared/components/entete-page/entete-page';
import { MessageErreur } from '../../../../shared/components/message-erreur/message-erreur';

/**
 * Détail de l'abonnement de l'entreprise et renouvellement. Pas d'annulation : l'abonnement
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

  protected readonly abonnement = this.service.abonnement;
  protected readonly libellesFormule = LIBELLES_FORMULE;
  protected readonly libellesStatut = LIBELLES_STATUT_ABONNEMENT;
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<unknown>(null);

  protected readonly enAlerte = computed(() => abonnementEnAlerte(this.abonnement()));
  protected readonly expire = computed(() => this.abonnement()?.statut === 'EXPIRE');

  constructor() {
    this.charger();
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
