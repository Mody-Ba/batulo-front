import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Routes } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

/** Panneau du fil quand aucune conversation n'est ouverte (masqué sur téléphone). */
@Component({
  selector: 'app-fil-vide',
  imports: [MatIconModule, TranslocoPipe],
  template: `
    <p class="fil-vide">
      <mat-icon fontIcon="forum" aria-hidden="true" />
      {{ 'messagerie.choisissez' | transloco }}
    </p>
  `,
  styles: `
    .fil-vide {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--bt-espace-2);
      height: 100%;
      margin: 0;
      padding: var(--bt-espace-4);
      color: var(--mat-sys-on-surface-variant);
      text-align: center;
    }
  `,
})
export class FilVide {}

/** /messagerie (liste) et /messagerie/:id (fil, à côté de la liste). Garde authGuard posée dans app.routes.ts. */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./page-messagerie').then((m) => m.PageMessagerie),
    children: [
      { path: '', pathMatch: 'full', title: 'titres.messagerie', component: FilVide },
      {
        path: ':id',
        title: 'titres.conversation',
        loadComponent: () => import('./fil-conversation').then((m) => m.FilConversation),
      },
    ],
  },
];
