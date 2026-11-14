import { Routes } from '@angular/router';
import { fournirPaginateurFrancais } from '../../core/utils/paginateur-francais';

/** /notifications[?page&taille] (garde authGuard posée dans app.routes.ts). */
export const routes: Routes = [
  {
    path: '',
    title: 'Notifications · Batulo',
    providers: [fournirPaginateurFrancais()],
    loadComponent: () => import('./page-notifications').then((m) => m.PageNotifications),
  },
];
