import { Component, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MessagerieService } from '../../core/services/messagerie.service';
import { NotificationService } from '../../core/services/notification.service';
import { LienNavigation } from './liens-navigation';

/** Liste des rubriques du rôle connecté (calculée par la mise en page). */
@Component({
  selector: 'app-menu-lateral',
  imports: [MatListModule, MatIconModule, RouterLink, RouterLinkActive],
  template: `
    <nav aria-label="Menu principal">
      <mat-nav-list>
        @for (lien of liens(); track lien.lien) {
          <a
            mat-list-item
            [routerLink]="lien.lien"
            routerLinkActive
            #actif="routerLinkActive"
            [routerLinkActiveOptions]="{ exact: !!lien.exact }"
            [activated]="actif.isActive"
            [attr.aria-current]="actif.isActive ? 'page' : null"
          >
            <mat-icon matListItemIcon [fontIcon]="lien.icone" aria-hidden="true" />
            <span matListItemTitle>
              {{ lien.libelle }}
              @if (compteur(lien); as n) {
                <span class="compteur" aria-hidden="true">{{ n > 99 ? '99+' : n }}</span>
                <span class="visuellement-cache">({{ n }} non {{ lien.compteur === 'messagerie' ? 'lu' : 'lue' }}{{ n > 1 ? 's' : '' }})</span>
              }
            </span>
          </a>
        }
      </mat-nav-list>
    </nav>
  `,
  styles: `
    nav {
      padding: var(--bt-espace-2);
    }

    a {
      border-radius: 28px;
    }

    .compteur {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 20px;
      height: 20px;
      margin-left: var(--bt-espace-2);
      padding: 0 6px;
      border-radius: 10px;
      background: var(--mat-sys-error);
      color: var(--mat-sys-on-error);
      font: var(--mat-sys-label-small);
      vertical-align: middle;
    }
  `,
})
export class MenuLateral {
  private readonly messagerie = inject(MessagerieService);
  private readonly notifications = inject(NotificationService);
  readonly liens = input.required<readonly LienNavigation[]>();

  /** Non lus à afficher (0 : rien). Compteurs partagés, relus par la cloche de la barre du haut. */
  protected compteur(lien: LienNavigation): number {
    switch (lien.compteur) {
      case 'messagerie':
        return this.messagerie.nombreNonLus();
      case 'notifications':
        return this.notifications.nombreNonLues();
      default:
        return 0;
    }
  }
}
