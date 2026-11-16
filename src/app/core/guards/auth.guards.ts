import { inject } from '@angular/core';
import { CanActivateFn, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Role } from '../models/role.model';
import { AuthService } from '../services/auth.service';
import { cheminInterne } from '../utils/redirection';

/*
 * Ces gardes servent seulement à l'affichage (ne pas montrer une page inutile).
 * Elles ne protègent aucune donnée : chaque appel est vérifié par le serveur, qui
 * répond 401 ou 403 quel que soit l'état du front.
 */

/** Connexion, puis retour à la page demandée (chemin interne seulement, revérifié par la page de connexion). */
function versConnexion(router: Router, url: string): UrlTree {
  const retour = cheminInterne(url);
  return router.createUrlTree(['/connexion'], retour && retour !== '/' ? { queryParams: { retour } } : {});
}

function verifierAcces(etat: RouterStateSnapshot, rolesAutorises?: readonly Role[]): true | UrlTree {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.estConnecte()) {
    return versConnexion(router, etat.url);
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
export const connecteGuard: CanActivateFn = (_route, etat) => {
  const auth = inject(AuthService);
  return auth.estConnecte() ? true : versConnexion(inject(Router), etat.url);
};

/** Pages publiques (connexion, inscription) : un compte déjà connecté est renvoyé vers son accueil. */
export const inviteGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.estConnecte() ? inject(Router).parseUrl(auth.urlAccueil()) : true;
};
