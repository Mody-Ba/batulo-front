import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router, RouterLink } from '@angular/router';
import { catchError, EMPTY, merge, switchMap } from 'rxjs';
import { ICONES_NOTIFICATION, NotificationResponse } from '../../core/models/notification.model';
import { AuthService } from '../../core/services/auth.service';
import { MessagerieService } from '../../core/services/messagerie.service';
import { NotificationService } from '../../core/services/notification.service';
import { interrogationPeriodique } from '../../core/utils/interrogation';
import { messageErreur } from '../../core/utils/erreur-http';
import { lienNotification } from '../../features/notifications/liens-notifications';
import { DateLPipe } from '../../core/i18n/formats.pipes';

/** Intervalle de mise à jour de la pastille. */
const INTERVALLE_MS = 60_000;
/** Nombre de notifications montrées dans le menu (la liste complète : /notifications). */
const TAILLE_APERCU = 10;

@Component({
  selector: 'app-cloche-notifications',
  imports: [DateLPipe, 
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
  private readonly messagerie = inject(MessagerieService);
  private readonly router = inject(Router);
  private readonly role = inject(AuthService).role;
  protected readonly nonLues = this.service.nombreNonLues;
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
    // Compteurs partagés (cloche, page des notifications, badge « Messagerie » du menu), relus toutes les minutes
    // quand l'onglet est visible. La cloche n'existe que si les notifications sont permises (pas de page imposée).
    // Erreurs ignorées : les compteurs gardent leur dernière valeur (l'intercepteur gère le 401).
    interrogationPeriodique(INTERVALLE_MS)
      .pipe(
        switchMap(() =>
          merge(
            this.service.actualiserNombre().pipe(catchError(() => EMPTY)),
            this.messagerie.actualiserNombre().pipe(catchError(() => EMPTY)),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe();
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

  /**
   * Clic sur une notification : marquée lue ; si elle mène à un élément, le menu se ferme et la page s'ouvre, sinon le
   * menu reste ouvert.
   */
  protected ouvrir(notification: NotificationResponse, evenement: Event): void {
    this.marquerLue(notification);
    const lien = lienNotification(notification, this.role());
    if (lien) {
      void this.router.navigate(lien.commandes, { queryParams: lien.queryParams });
    } else {
      evenement.stopPropagation();
    }
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
      },
      error: (erreur: unknown) => this.erreur.set(messageErreur(erreur)),
    });
  }

  protected toutMarquerLu(): void {
    this.service.toutMarquerLu().subscribe({
      next: () => {
        this.notifications.update((liste) => liste.map((n) => ({ ...n, lue: true })));
      },
      error: (erreur: unknown) => this.erreur.set(messageErreur(erreur)),
    });
  }
}
