import { Routes } from '@angular/router';

const pageAVenir = () =>
  import('../../shared/components/page-a-venir/page-a-venir').then((m) => m.PageAVenir);

/** Espace de l'admin d'entreprise (garde roleGuard('ADMIN') posée dans app.routes.ts). */
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
    path: 'abonnement',
    loadChildren: () => import('./abonnement/abonnement.routes').then((m) => m.routes),
  },
  {
    path: 'gestionnaires',
    title: 'Gestionnaires · Batulo',
    loadComponent: pageAVenir,
    data: { titre: 'Gestionnaires', icone: 'group', etape: 'F4' },
  },
  {
    path: 'statistiques-recues',
    title: 'Statistiques reçues · Batulo',
    loadComponent: pageAVenir,
    data: { titre: 'Statistiques reçues', icone: 'insights', etape: 'F7' },
  },
];
