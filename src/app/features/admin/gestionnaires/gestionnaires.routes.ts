import { Routes } from '@angular/router';

/** /admin/gestionnaires (garde roleGuard('ADMIN') posée sur /admin). */
export const routes: Routes = [
  {
    // ?page=&taille=
    path: '',
    pathMatch: 'full',
    title: 'titres.gestionnaires',
    loadComponent: () =>
      import('./liste-gestionnaires/liste-gestionnaires').then((m) => m.ListeGestionnaires),
  },
  {
    path: ':id',
    title: 'titres.gestionnaire',
    loadComponent: () =>
      import('./detail-gestionnaire/detail-gestionnaire').then((m) => m.DetailGestionnaire),
  },
];
