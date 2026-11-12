import { Routes } from '@angular/router';
import { fournirPaginateurFrancais } from '../../core/utils/paginateur-francais';

const pageAVenir = () =>
  import('../../shared/components/page-a-venir/page-a-venir').then((m) => m.PageAVenir);

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
        path: 'statistiques-recues',
        title: 'Statistiques reçues · Batulo',
        loadComponent: pageAVenir,
        data: { titre: 'Statistiques reçues', icone: 'insights', etape: 'F7' },
      },
    ],
  },
];
