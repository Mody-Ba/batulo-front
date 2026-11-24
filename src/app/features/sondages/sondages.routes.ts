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
        title: 'titres.sondages',
        loadComponent: () => import('./liste-sondages/liste-sondages').then((m) => m.ListeSondages),
      },
      {
        path: 'nouveau',
        title: 'titres.nouveauSondage',
        loadComponent: () => import('./creation-sondage/creation-sondage').then((m) => m.CreationSondage),
      },
      {
        // Lecture seule si le sondage est publié ou fermé, l'abonnement expiré, ou sans droit de modification.
        path: ':id/modifier',
        title: 'titres.modifierSondage',
        canDeactivate: [quitterEditeurGuard],
        loadComponent: () => import('./editeur/editeur-sondage').then((m) => m.EditeurSondage),
      },
      {
        // Traductions d'une langue supplémentaire, côte à côte ; ?manquants=true : seulement les textes manquants.
        path: ':id/traductions/:langue',
        title: 'titres.traductions',
        canDeactivate: [quitterEditeurGuard],
        loadComponent: () => import('./traductions/ecran-traductions').then((m) => m.EcranTraductions),
      },
      {
        path: ':id/apercu',
        title: 'titres.apercu',
        loadComponent: () => import('./apercu-sondage/apercu-sondage').then((m) => m.ApercuSondage),
      },
      {
        // Lien public et QR code (sondage publié).
        path: ':id/diffuser',
        title: 'titres.diffuser',
        loadComponent: () => import('./diffuser-sondage/diffuser-sondage').then((m) => m.DiffuserSondage),
      },
      {
        // ?page=&taille=
        path: ':id/reponses',
        title: 'titres.reponses',
        loadComponent: () => import('./reponses/liste-reponses').then((m) => m.ListeReponses),
      },
      {
        // ?lignee=&du=&au=&granularite=&critere=cle:valeur (répété)
        path: ':id/statistiques',
        title: 'titres.statistiques',
        loadComponent: () => import('./statistiques/page-statistiques').then((m) => m.PageStatistiques),
      },
      {
        path: ':id',
        title: 'titres.sondage',
        loadComponent: () => import('./detail-sondage/detail-sondage').then((m) => m.DetailSondage),
      },
    ],
  },
];
