import { Routes } from '@angular/router';
import { fournirPaginateurFrancais } from '../../core/utils/paginateur-francais';

/** Espace de l'admin d'entreprise (garde roleGuard('ADMIN') posée dans app.routes.ts). */
export const routes: Routes = [
  {
    path: '',
    providers: [fournirPaginateurFrancais()],
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Tableau de bord · Batulo',
        loadComponent: () => import('./tableau-de-bord/tableau-de-bord').then((m) => m.TableauDeBord),
      },
      {
        path: 'abonnement',
        loadChildren: () => import('./abonnement/abonnement.routes').then((m) => m.routes),
      },
      {
        path: 'gestionnaires',
        loadChildren: () => import('./gestionnaires/gestionnaires.routes').then((m) => m.routes),
      },
      {
        // ?page=&taille=
        path: 'statistiques-recues',
        pathMatch: 'full',
        title: 'Statistiques reçues · Batulo',
        loadComponent: () =>
          import('./statistiques-recues/liste-statistiques-recues').then((m) => m.ListeStatistiquesRecues),
      },
      {
        path: 'statistiques-recues/:envoiId',
        title: 'Statistiques reçues · Batulo',
        loadComponent: () => import('./statistiques-recues/statistiques-recues').then((m) => m.StatistiquesRecues),
      },
    ],
  },
];
