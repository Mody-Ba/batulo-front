import { CurrencyPipe, DatePipe, DecimalPipe, UpperCasePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import {
  abonnementEnAlerte,
  LIBELLES_FORMULE,
  LIBELLES_STATUT_ABONNEMENT,
} from '../../../core/models/abonnement.model';
import { AbonnementService } from '../../../core/services/abonnement.service';
import { AuthService } from '../../../core/services/auth.service';
import { TableauDeBordService } from '../../../core/services/tableau-de-bord.service';
import { TableauDeBordResponse } from '../../../core/models/tableau-de-bord.model';
import { EntetePage } from '../../../shared/components/entete-page/entete-page';
import { DernieresNotifications } from '../../../shared/components/dernieres-notifications/dernieres-notifications';
import { MessageErreur } from '../../../shared/components/message-erreur/message-erreur';

/**
 * Tableau de bord de l'admin : chiffres de l'entreprise (GET /api/admin/tableau-de-bord), abonnement et dernières
 * notifications. Un sondage est compté une fois (sa lignée), brouillons compris dans « Non commencés ».
 */
@Component({
  selector: 'app-tableau-de-bord',
  imports: [
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    UpperCasePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    DernieresNotifications,
    EntetePage,
    MessageErreur,
  ],
  templateUrl: './tableau-de-bord.html',
  styleUrl: './tableau-de-bord.scss',
})
export class TableauDeBord {
  private readonly tableauDeBordService = inject(TableauDeBordService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly auth = inject(AuthService);
  protected readonly abonnement = inject(AbonnementService).abonnement;
  protected readonly libellesFormule = LIBELLES_FORMULE;
  protected readonly libellesStatut = LIBELLES_STATUT_ABONNEMENT;

  protected readonly enAlerte = computed(() => abonnementEnAlerte(this.abonnement()));
  protected readonly expire = computed(() => this.abonnement()?.statut === 'EXPIRE');
  protected readonly titre = computed(() => {
    const prenom = this.auth.utilisateur()?.prenom;
    return prenom ? `Bonjour ${prenom}` : 'Tableau de bord';
  });

  protected readonly chiffres = signal<TableauDeBordResponse | null>(null);
  protected readonly chargementChiffres = signal(true);
  protected readonly erreurChiffres = signal<unknown>(null);

  constructor() {
    // L'abonnement est chargé par la mise en page (signal partagé avec le bandeau).
    this.chargerChiffres();
  }

  protected chargerChiffres(): void {
    this.chargementChiffres.set(true);
    this.erreurChiffres.set(null);
    this.tableauDeBordService
      .lire()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (chiffres) => {
          this.chiffres.set(chiffres);
          this.chargementChiffres.set(false);
        },
        error: (erreur: unknown) => {
          this.erreurChiffres.set(erreur);
          this.chargementChiffres.set(false);
        },
      });
  }
}
