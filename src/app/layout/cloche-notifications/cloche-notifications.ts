import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { catchError, EMPTY, switchMap, timer } from 'rxjs';
import { ICONES_NOTIFICATION, NotificationResponse } from '../../core/models/notification.model';
import { NotificationService } from '../../core/services/notification.service';
import { messageErreur } from '../../core/utils/erreur-http';

/** Intervalle de mise à jour de la pastille. */
const INTERVALLE_MS = 60_000;
/** Nombre de notifications montrées dans le menu (la liste complète arrive en F8). */
const TAILLE_APERCU = 10;

@Component({
  selector: 'app-cloche-notifications',
  imports: [
    DatePipe,
    RouterLink,
    MatBadgeModule,
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatMenuModule,
    MatProgressBarModule,
  ],
  templateUrl: './cloche-notifications.html',
  styleUrl: './cloche-notifications.scss',
})
export class ClocheNotifications {
  private readonly service = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly icones = ICONES_NOTIFICATION;
  protected readonly nonLues = signal(0);
  protected readonly notifications = signal<NotificationResponse[]>([]);
  protected readonly chargement = signal(false);
  protected readonly erreur = signal<string | null>(null);

  protected readonly libelleBouton = computed(() => {
    const nombre = this.nonLues();
    return nombre === 0
      ? 'Notifications, aucune non lue'
      : `Notifications, ${nombre} non lue${nombre > 1 ? 's' : ''}`;
  });

  constructor() {
    // Erreurs ignorées : la pastille garde sa dernière valeur (l'intercepteur gère le 401).
    timer(0, INTERVALLE_MS)
      .pipe(
        switchMap(() => this.service.nombreNonLues().pipe(catchError(() => EMPTY))),
        takeUntilDestroyed(),
      )
      .subscribe((reponse) => this.nonLues.set(reponse.nonLues));
  }

  /** À l'ouverture du menu : les plus récentes. */
  protected charger(): void {
    this.chargement.set(true);
    this.erreur.set(null);
    this.service
      .lister(0, TAILLE_APERCU)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.notifications.set(page.contenu);
          this.chargement.set(false);
        },
        error: (erreur: unknown) => {
          this.erreur.set(messageErreur(erreur, 'Les notifications n’ont pas pu être chargées.'));
          this.chargement.set(false);
        },
      });
  }

  protected marquerLue(notification: NotificationResponse): void {
    if (notification.lue) {
      return;
    }
    this.service.marquerLue(notification.id).subscribe({
      next: (miseAJour) => {
        this.notifications.update((liste) =>
          liste.map((n) => (n.id === miseAJour.id ? miseAJour : n)),
        );
        this.nonLues.update((nombre) => Math.max(nombre - 1, 0));
      },
      error: (erreur: unknown) => this.erreur.set(messageErreur(erreur)),
    });
  }

  protected toutMarquerLu(): void {
    this.service.toutMarquerLu().subscribe({
      next: () => {
        this.notifications.update((liste) => liste.map((n) => ({ ...n, lue: true })));
        this.nonLues.set(0);
      },
      error: (erreur: unknown) => this.erreur.set(messageErreur(erreur)),
    });
  }
}
