import { Routes } from '@angular/router';

/** Espace du gestionnaire (garde roleGuard('GESTIONNAIRE') posée dans app.routes.ts). */
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
];
