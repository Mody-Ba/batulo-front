import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { ICONES_NOTIFICATION, NotificationResponse } from '../../../core/models/notification.model';
import { NotificationService } from '../../../core/services/notification.service';
import { MessageErreur } from '../message-erreur/message-erreur';

/** Nombre de notifications affichées. */
export const NOMBRE_NOTIFICATIONS = 5;

/**
 * Carte « Dernières notifications » des tableaux de bord : les 5 plus récentes, tous types confondus, avec un lien
 * vers la page complète. Le parent pose la carte (classe `carte-section`) ; ce composant en remplit le contenu.
 */
@Component({
  selector: 'app-dernieres-notifications',
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule, MatProgressBarModule, MessageErreur],
  templateUrl: './dernieres-notifications.html',
  styleUrl: './dernieres-notifications.scss',
})
export class DernieresNotifications {
  private readonly service = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly icones = ICONES_NOTIFICATION;

  protected readonly notifications = signal<NotificationResponse[]>([]);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<unknown>(null);

  constructor() {
    this.charger();
  }

  protected charger(): void {
    this.chargement.set(true);
    this.erreur.set(null);
    this.service
      .lister(0, NOMBRE_NOTIFICATIONS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.notifications.set(page.contenu);
          this.chargement.set(false);
        },
        error: (erreur: unknown) => {
          this.erreur.set(erreur);
          this.chargement.set(false);
        },
      });
  }
}
