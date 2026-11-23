import { Routes } from '@angular/router';
import { fournirPaginateurFrancais } from '../../core/utils/paginateur-francais';

/** Espace du super admin (garde roleGuard('SUPER_ADMIN') posée dans app.routes.ts). */
export const routes: Routes = [
  {
    path: '',
    providers: [fournirPaginateurFrancais()],
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'titres.tableauDeBord',
        loadComponent: () =>
          import('./tableau-de-bord/tableau-de-bord-super-admin').then((m) => m.TableauDeBordSuperAdmin),
      },
      {
        path: 'admins',
        loadChildren: () => import('./admins/admins.routes').then((m) => m.routes),
      },
      {
        // ?statut=&page=&taille=
        path: 'abonnements',
        title: 'titres.abonnements',
        loadComponent: () =>
          import('./abonnements/liste-abonnements/liste-abonnements').then((m) => m.ListeAbonnements),
      },
      {
        // ?statut=&page=&taille=
        path: 'demandes-abonnement',
        title: 'titres.demandesAbonnement',
        loadComponent: () =>
          import('./demandes/liste-demandes/liste-demandes').then((m) => m.ListeDemandes),
      },
    ],
  },
];
