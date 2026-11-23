import { Routes } from '@angular/router';

/** /super-admin/admins (garde roleGuard('SUPER_ADMIN') posée sur /super-admin). */
export const routes: Routes = [
  {
    // ?recherche=&statut=&page=&taille=
    path: '',
    pathMatch: 'full',
    title: 'titres.admins',
    loadComponent: () => import('./liste-admins/liste-admins').then((m) => m.ListeAdmins),
  },
  {
    path: ':id',
    title: 'titres.entreprise',
    loadComponent: () => import('./detail-admin/detail-admin').then((m) => m.DetailAdmin),
  },
];
