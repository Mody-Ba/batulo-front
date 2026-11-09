import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { RouterLink, RouterLinkActive } from '@angular/router';
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
            <span matListItemTitle>{{ lien.libelle }}</span>
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
  `,
})
export class MenuLateral {
  readonly liens = input.required<readonly LienNavigation[]>();
}
