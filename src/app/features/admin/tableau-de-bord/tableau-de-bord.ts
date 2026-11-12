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
import { ICONES_NOTIFICATION, NotificationResponse } from '../../../core/models/notification.model';
import { AbonnementService } from '../../../core/services/abonnement.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TableauDeBordService } from '../../../core/services/tableau-de-bord.service';
import { TableauDeBordResponse } from '../../../core/models/tableau-de-bord.model';
import { EntetePage } from '../../../shared/components/entete-page/entete-page';
import { MessageErreur } from '../../../shared/components/message-erreur/message-erreur';

/** Nombre de notifications affichées. */
export const NOMBRE_NOTIFICATIONS = 5;

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
    EntetePage,
    MessageErreur,
  ],
  templateUrl: './tableau-de-bord.html',
  styleUrl: './tableau-de-bord.scss',
})
export class TableauDeBord {
  private readonly notificationService = inject(NotificationService);
  private readonly tableauDeBordService = inject(TableauDeBordService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly auth = inject(AuthService);
  protected readonly abonnement = inject(AbonnementService).abonnement;
  protected readonly libellesFormule = LIBELLES_FORMULE;
  protected readonly libellesStatut = LIBELLES_STATUT_ABONNEMENT;
  protected readonly icones = ICONES_NOTIFICATION;

  protected readonly enAlerte = computed(() => abonnementEnAlerte(this.abonnement()));
  protected readonly expire = computed(() => this.abonnement()?.statut === 'EXPIRE');
  protected readonly titre = computed(() => {
    const prenom = this.auth.utilisateur()?.prenom;
    return prenom ? `Bonjour ${prenom}` : 'Tableau de bord';
  });

  protected readonly chiffres = signal<TableauDeBordResponse | null>(null);
  protected readonly chargementChiffres = signal(true);
  protected readonly erreurChiffres = signal<unknown>(null);

  protected readonly notifications = signal<NotificationResponse[]>([]);
  protected readonly chargementNotifications = signal(true);
  protected readonly erreurNotifications = signal<unknown>(null);

  constructor() {
    // L'abonnement est chargé par la mise en page (signal partagé avec le bandeau).
    this.chargerChiffres();
    this.chargerNotifications();
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

  protected chargerNotifications(): void {
    this.chargementNotifications.set(true);
    this.erreurNotifications.set(null);
    this.notificationService
      .lister(0, NOMBRE_NOTIFICATIONS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.notifications.set(page.contenu);
          this.chargementNotifications.set(false);
        },
        error: (erreur: unknown) => {
          this.erreurNotifications.set(erreur);
          this.chargementNotifications.set(false);
        },
      });
  }
}
