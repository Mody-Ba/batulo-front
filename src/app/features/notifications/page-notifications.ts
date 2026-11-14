import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { ICONES_NOTIFICATION, NotificationResponse } from '../../core/models/notification.model';
import { PageResponse } from '../../core/models/page.model';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { messageErreur } from '../../core/utils/erreur-http';
import { numeroPageUrl, parametresPage, taillePageUrl, TAILLES_PAGE } from '../../core/utils/pagination-url';
import { EntetePage } from '../../shared/components/entete-page/entete-page';
import { MessageErreur } from '../../shared/components/message-erreur/message-erreur';
import { lienNotification, LienNotification } from './liens-notifications';

/**
 * Toutes les notifications, les plus récentes d'abord (?page=&taille= dans l'URL) : marquer une ou toutes comme lues,
 * ouvrir la page concernée. Le nombre de non lues est partagé avec la cloche de la barre du haut.
 */
@Component({
  selector: 'app-page-notifications',
  imports: [DatePipe, MatButtonModule, MatIconModule, MatPaginatorModule, MatProgressBarModule, EntetePage, MessageErreur],
  templateUrl: './page-notifications.html',
  styleUrl: './page-notifications.scss',
})
export class PageNotifications {
  private readonly service = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly role = inject(AuthService).role;
  protected readonly icones = ICONES_NOTIFICATION;
  protected readonly tailles = [...TAILLES_PAGE];
  protected readonly nonLues = this.service.nombreNonLues;

  readonly pageUrl = input<string | undefined>(undefined, { alias: 'page' });
  readonly taille = input<string | undefined>(undefined);
  protected readonly numeroPage = computed(() => numeroPageUrl(this.pageUrl()));
  protected readonly taillePage = computed(() => taillePageUrl(this.taille()));

  protected readonly page = signal<PageResponse<NotificationResponse> | null>(null);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<unknown>(null);
  protected readonly marquageEnCours = signal(false);

  constructor() {
    effect(() => {
      const page = this.numeroPage();
      const taille = this.taillePage();
      untracked(() => this.charger(page, taille));
    });
  }

  protected charger(page = this.numeroPage(), taille = this.taillePage()): void {
    this.chargement.set(true);
    this.erreur.set(null);
    this.service
      .lister(page, taille)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultat) => {
          this.page.set(resultat);
          this.chargement.set(false);
        },
        error: (erreur: unknown) => {
          this.erreur.set(erreur);
          this.chargement.set(false);
        },
      });
    // La pastille suit aussi les notifications arrivées depuis le dernier battement.
    this.service.actualiserNombre().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ error: () => undefined });
  }

  protected lien(notification: NotificationResponse): LienNotification | null {
    return lienNotification(notification, this.role());
  }

  protected changerPage(evenement: PageEvent): void {
    void this.router.navigate([], { queryParams: parametresPage(evenement.pageIndex, evenement.pageSize), queryParamsHandling: 'merge' });
  }

  protected marquerLue(notification: NotificationResponse): void {
    if (notification.lue) {
      return;
    }
    this.service.marquerLue(notification.id).subscribe({
      next: (miseAJour) => this.remplacer(miseAJour),
      error: (erreur: unknown) => this.snackBar.open(messageErreur(erreur), 'Fermer', { duration: 6000 }),
    });
  }

  /** Ouvrir : la notification devient lue (sans attendre le serveur pour naviguer). */
  protected ouvrir(notification: NotificationResponse, lien: LienNotification): void {
    this.marquerLue(notification);
    void this.router.navigate(lien.commandes, { queryParams: lien.queryParams });
  }

  protected toutMarquerLu(): void {
    this.marquageEnCours.set(true);
    this.service.toutMarquerLu().subscribe({
      next: (r) => {
        this.marquageEnCours.set(false);
        this.page.update((p) => (p ? { ...p, contenu: p.contenu.map((n) => ({ ...n, lue: true })) } : p));
        this.snackBar.open(
          r.nombreMarquees > 1 ? `${r.nombreMarquees} notifications marquées comme lues.` : 'Notifications marquées comme lues.',
          'Fermer',
          { duration: 4000 },
        );
      },
      error: (erreur: unknown) => {
        this.marquageEnCours.set(false);
        this.snackBar.open(messageErreur(erreur), 'Fermer', { duration: 6000 });
      },
    });
  }

  private remplacer(miseAJour: NotificationResponse): void {
    this.page.update((p) => (p ? { ...p, contenu: p.contenu.map((n) => (n.id === miseAJour.id ? miseAJour : n)) } : p));
  }
}
