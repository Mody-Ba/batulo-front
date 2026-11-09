import { Routes } from '@angular/router';

const pageAVenir = () =>
  import('../../shared/components/page-a-venir/page-a-venir').then((m) => m.PageAVenir);

/** Espace du super admin (garde roleGuard('SUPER_ADMIN') posée dans app.routes.ts). */
export const routes: Routes = [
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
    title: 'Admins et entreprises · Batulo',
    loadComponent: pageAVenir,
    data: { titre: 'Admins et entreprises', icone: 'business', etape: 'F3' },
  },
  {
    path: 'abonnements',
    title: 'Abonnements · Batulo',
    loadComponent: pageAVenir,
    data: { titre: 'Abonnements', icone: 'card_membership', etape: 'F3' },
  },
  {
    path: 'demandes-abonnement',
    title: 'Demandes d’abonnement · Batulo',
    loadComponent: pageAVenir,
    data: { titre: 'Demandes d’abonnement', icone: 'upgrade', etape: 'F3' },
  },
];
