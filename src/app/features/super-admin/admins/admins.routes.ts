import { Routes } from '@angular/router';

/** /super-admin/admins (garde roleGuard('SUPER_ADMIN') posée sur /super-admin). */
export const routes: Routes = [
  {
    // ?statut=&recherche=&page=&taille= : la liste attend la route du backend (filtre et recherche).
    path: '',
    pathMatch: 'full',
    title: 'Admins et entreprises · Batulo',
    loadComponent: () =>
      import('../../../shared/components/page-a-venir/page-a-venir').then((m) => m.PageAVenir),
    data: { titre: 'Admins et entreprises', icone: 'business', etape: 'F3' },
  },
  {
    path: ':id',
    title: 'Entreprise · Batulo',
    loadComponent: () => import('./detail-admin/detail-admin').then((m) => m.DetailAdmin),
  },
];
