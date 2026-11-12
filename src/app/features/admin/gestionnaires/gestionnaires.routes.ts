import { Routes } from '@angular/router';

/** /admin/gestionnaires (garde roleGuard('ADMIN') posée sur /admin). */
export const routes: Routes = [
  {
    // ?page=&taille=
    path: '',
    pathMatch: 'full',
    title: 'Gestionnaires · Batulo',
    loadComponent: () =>
      import('./liste-gestionnaires/liste-gestionnaires').then((m) => m.ListeGestionnaires),
  },
  {
    path: ':id',
    title: 'Gestionnaire · Batulo',
    loadComponent: () =>
      import('./detail-gestionnaire/detail-gestionnaire').then((m) => m.DetailGestionnaire),
  },
];
