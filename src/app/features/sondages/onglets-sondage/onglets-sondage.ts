import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/**
 * Onglets de la fiche d'un sondage (une adresse par onglet : retour arrière et lien direct) : Fiche, Réponses,
 * Statistiques. Navigation simple, l'onglet courant porte aria-current="page".
 */
@Component({
  selector: 'app-onglets-sondage',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="onglets" aria-label="Rubriques du sondage">
      <a [routerLink]="['/sondages', id()]" routerLinkActive="actif" [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page">Fiche</a>
      <a [routerLink]="['/sondages', id(), 'reponses']" routerLinkActive="actif" ariaCurrentWhenActive="page">Réponses</a>
      <a [routerLink]="['/sondages', id(), 'statistiques']" routerLinkActive="actif" ariaCurrentWhenActive="page">Statistiques</a>
    </nav>
  `,
  styles: `
    .onglets {
      display: flex;
      gap: var(--bt-espace-1);
      margin: 0 0 var(--bt-espace-4);
      overflow-x: auto;
      border-bottom: 1px solid var(--mat-sys-outline-variant);

      a {
        display: inline-flex;
        align-items: center;
        min-height: 48px;
        padding: 0 var(--bt-espace-4);
        border-bottom: 3px solid transparent;
        color: var(--mat-sys-on-surface-variant);
        font: var(--mat-sys-title-small);
        text-decoration: none;
        white-space: nowrap;

        &:hover {
          background: var(--mat-sys-surface-container);
        }

        &:focus-visible {
          outline: 2px solid var(--mat-sys-primary);
          outline-offset: -2px;
        }

        &.actif {
          border-bottom-color: var(--mat-sys-primary);
          color: var(--mat-sys-primary);
        }
      }
    }
  `,
})
export class OngletsSondage {
  readonly id = input.required<number | string>();
}
