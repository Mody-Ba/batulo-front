import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

/** Rien à détailler tant qu'aucune formule n'est payée : direction la souscription. */
const enAttenteVersSouscrire: CanActivateFn = () =>
  inject(AuthService).statutAbonnement() === 'EN_ATTENTE_PAIEMENT'
    ? inject(Router).parseUrl('/admin/abonnement/souscrire')
    : true;

/**
 * /admin/abonnement/** : seule zone permise à l'admin dont l'abonnement est en attente de paiement
 * (AuthService.redirectionObligatoire).
 */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Mon abonnement · Batulo',
    canActivate: [enAttenteVersSouscrire],
    loadComponent: () => import('./mon-abonnement/mon-abonnement').then((m) => m.MonAbonnement),
  },
  {
    // ?formule=MENSUEL|ANNUEL pour présélectionner (bouton « Renouveler »).
    path: 'souscrire',
    title: 'S’abonner · Batulo',
    loadComponent: () => import('./souscrire/souscrire').then((m) => m.Souscrire),
  },
];
