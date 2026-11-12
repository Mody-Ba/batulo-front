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
        title: 'Tableau de bord · Batulo',
        loadComponent: () =>
          import('../../shared/components/accueil-provisoire/accueil-provisoire').then(
            (m) => m.AccueilProvisoire,
          ),
      },
      {
        path: 'admins',
        loadChildren: () => import('./admins/admins.routes').then((m) => m.routes),
      },
      {
        // ?statut=&page=&taille=
        path: 'abonnements',
        title: 'Abonnements · Batulo',
        loadComponent: () =>
          import('./abonnements/liste-abonnements/liste-abonnements').then((m) => m.ListeAbonnements),
      },
      {
        // ?statut=&page=&taille=
        path: 'demandes-abonnement',
        title: 'Demandes d’abonnement · Batulo',
        loadComponent: () =>
          import('./demandes/liste-demandes/liste-demandes').then((m) => m.ListeDemandes),
      },
    ],
  },
];
