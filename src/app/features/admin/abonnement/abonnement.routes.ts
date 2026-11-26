import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

/**
 * Rien à détailler tant que rien n'est payé : direction la souscription. Une entreprise qui a acheté des sondages
 * (compte de crédits) garde sa page « Mon abonnement », même sans abonnement.
 */
const enAttenteVersSouscrire: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.statutAbonnement() === 'EN_ATTENTE_PAIEMENT' && !auth.compteCredits()
    ? inject(Router).parseUrl('/admin/abonnement/souscrire')
    : true;
};

/**
 * /admin/abonnement/** : seule zone permise à l'admin dont l'abonnement est en attente de paiement
 * (AuthService.redirectionObligatoire).
 */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'titres.monAbonnement',
    canActivate: [enAttenteVersSouscrire],
    loadComponent: () => import('./mon-abonnement/mon-abonnement').then((m) => m.MonAbonnement),
  },
  {
    // Demandes d'augmentation (permises abonnement expiré). En attente de paiement, la mise en page n'y mène pas.
    path: 'demandes',
    title: 'titres.demandesAugmentation',
    canActivate: [enAttenteVersSouscrire],
    loadComponent: () => import('./demandes/demandes-abonnement').then((m) => m.DemandesAbonnement),
  },
  {
    // URL de retour de Moosyl (?reference=) ; permise abonnement en attente de paiement (sous /admin/abonnement).
    path: 'paiement-mobile',
    title: 'titres.paiementMobile',
    loadComponent: () =>
      import('./paiement-mobile/retour-paiement-mobile').then((m) => m.RetourPaiementMobile),
  },
  {
    // ?formule=MENSUEL|ANNUEL pour présélectionner (bouton « Renouveler ») ; ?offre=ACHAT_SONDAGES&quantite=N (achat de
    // sondages) ; ?moyen=carte|mobile.
    path: 'souscrire',
    title: 'titres.souscrire',
    loadComponent: () => import('./souscrire/souscrire').then((m) => m.Souscrire),
  },
];
