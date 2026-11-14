import { Routes } from '@angular/router';
import { fournirPaginateurFrancais } from '../../core/utils/paginateur-francais';
import { quitterEditeurGuard } from './editeur/quitter-editeur.guard';

/**
 * /sondages (garde roleGuard('ADMIN', 'GESTIONNAIRE') posée dans app.routes.ts ; le backend
 * filtre selon le rôle). Création et éditeur du brouillon en F5a.
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
        loadComponent: () => import('./creation-sondage/creation-sondage').then((m) => m.CreationSondage),
      },
      {
        // Lecture seule si le sondage est publié ou fermé, l'abonnement expiré, ou sans droit de modification.
        path: ':id/modifier',
        title: 'Modifier le sondage · Batulo',
        canDeactivate: [quitterEditeurGuard],
        loadComponent: () => import('./editeur/editeur-sondage').then((m) => m.EditeurSondage),
      },
      {
        path: ':id/apercu',
        title: 'Aperçu du sondage · Batulo',
        loadComponent: () => import('./apercu-sondage/apercu-sondage').then((m) => m.ApercuSondage),
      },
      {
        // Lien public et QR code (sondage publié).
        path: ':id/diffuser',
        title: 'Diffuser le sondage · Batulo',
        loadComponent: () => import('./diffuser-sondage/diffuser-sondage').then((m) => m.DiffuserSondage),
      },
      {
        path: ':id',
        title: 'Sondage · Batulo',
        loadComponent: () => import('./detail-sondage/detail-sondage').then((m) => m.DetailSondage),
      },
    ],
  },
];
