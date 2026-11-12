import { Routes } from '@angular/router';
import { fournirPaginateurFrancais } from '../../core/utils/paginateur-francais';

/**
 * /sondages (garde roleGuard('ADMIN', 'GESTIONNAIRE') posée dans app.routes.ts ; le backend
 * filtre selon le rôle). Lecture seule en F4 ; l'éditeur arrive en F5.
 */
export const routes: Routes = [
  {
    path: '',
    providers: [fournirPaginateurFrancais()],
    children: [
      {
        // ?statut=&page=&taille=
        path: '',
        pathMatch: 'full',
        title: 'Sondages · Batulo',
        loadComponent: () => import('./liste-sondages/liste-sondages').then((m) => m.ListeSondages),
      },
      {
        path: 'nouveau',
        title: 'Nouveau sondage · Batulo',
        loadComponent: () =>
          import('../../shared/components/page-a-venir/page-a-venir').then((m) => m.PageAVenir),
        data: { titre: 'Nouveau sondage', icone: 'add', etape: 'F5' },
      },
      {
        path: ':id',
        title: 'Sondage · Batulo',
        loadComponent: () => import('./detail-sondage/detail-sondage').then((m) => m.DetailSondage),
      },
    ],
  },
];
