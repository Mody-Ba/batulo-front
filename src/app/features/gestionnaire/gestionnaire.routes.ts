import { Routes } from '@angular/router';
import { fournirPaginateurFrancais } from '../../core/utils/paginateur-francais';

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
  {
    // ?page=&taille=
    path: 'statistiques-envoyees',
    pathMatch: 'full',
    title: 'Statistiques envoyées · Batulo',
    providers: [fournirPaginateurFrancais()],
    loadComponent: () =>
      import('./statistiques-envoyees/statistiques-envoyees').then((m) => m.StatistiquesEnvoyees),
  },
  {
    path: 'statistiques-envoyees/:envoiId',
    title: 'Statistiques envoyées · Batulo',
    loadComponent: () => import('./statistiques-envoyees/envoi-statistiques').then((m) => m.EnvoiStatistiques),
  },
];
