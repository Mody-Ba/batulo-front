import { inject } from '@angular/core';
import { CanActivateFn, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Role } from '../models/role.model';
import { AuthService } from '../services/auth.service';

/*
 * Ces gardes servent seulement à l'affichage (ne pas montrer une page inutile).
 * Elles ne protègent aucune donnée : chaque appel est vérifié par le serveur, qui
 * répond 401 ou 403 quel que soit l'état du front.
 */

function verifierAcces(etat: RouterStateSnapshot, rolesAutorises?: readonly Role[]): true | UrlTree {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.estConnecte()) {
    return router.parseUrl('/connexion');
  }
  // Mot de passe temporaire, abonnement désactivé ou en attente de paiement : page imposée,
  // sauf si on s'y rend déjà (ex. /admin/abonnement sous /admin).
  const redirection = auth.redirectionObligatoire();
  if (redirection && !etat.url.startsWith(redirection)) {
    return router.parseUrl(redirection);
  }
  const role = auth.role();
  if (rolesAutorises && (!role || !rolesAutorises.includes(role))) {
    return router.parseUrl('/acces-refuse');
  }
  return true;
}

/** Connecté, et rien n'impose une autre page. */
export const authGuard: CanActivateFn = (_route, etat) => verifierAcces(etat);

/** Comme authGuard, avec un rôle parmi ceux indiqués. */
export function roleGuard(...roles: Role[]): CanActivateFn {
  return (_route, etat) => verifierAcces(etat, roles);
}

/** Connecté, quel que soit l'état du compte (changer le mot de passe, compte suspendu...). */
export const connecteGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.estConnecte() ? true : inject(Router).parseUrl('/connexion');
};

/** Pages publiques (connexion, inscription) : un compte déjà connecté est renvoyé vers son accueil. */
export const inviteGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.estConnecte() ? inject(Router).parseUrl(auth.urlAccueil()) : true;
};
