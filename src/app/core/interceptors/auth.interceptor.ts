import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, Observable, of, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CODES_ERREUR } from '../models/erreur.model';
import { AuthService, MESSAGE_SESSION_EXPIREE } from '../services/auth.service';
import { codeErreur } from '../utils/erreur-http';
import { SANS_AUTHENTIFICATION } from './contexte-http';

/** Origine de l'API Batulo : la seule à recevoir le jeton. */
const ORIGINE_API = new URL(environment.apiUrl).origin;

/**
 * Routes publiques : aucune session en jeu. Un 401 y a un sens métier (identifiants faux,
 * mot de passe temporaire expiré) et doit être affiché par la page, jamais rafraîchi.
 */
const ROUTES_PUBLIQUES = new Set(
  ['connexion', 'inscription', 'rafraichir', 'mot-de-passe-oublie', 'reinitialiser-mot-de-passe'].map(
    (chemin) => `/api/auth/${chemin}`,
  ),
);

function urlApi(url: string): URL | null {
  try {
    const adresse = new URL(url, window.location.origin);
    // Comparaison par origine exacte (protocole, hôte, port).
    return adresse.origin === ORIGINE_API ? adresse : null;
  } catch {
    return null;
  }
}

function avecJeton(requete: HttpRequest<unknown>, jeton: string | null): HttpRequest<unknown> {
  return jeton ? requete.clone({ setHeaders: { Authorization: `Bearer ${jeton}` } }) : requete;
}

/**
 * - ajoute le jeton d'accès aux appels de l'API ;
 * - sur 401 : rafraîchit le jeton (une seule fois pour toutes les requêtes en attente) puis rejoue
 *   la requête ; si le rafraîchissement échoue, déconnecte ;
 * - sur 403 lié à l'état du compte : met à jour la session et redirige vers la page imposée.
 * Les autres erreurs remontent à la page, qui affiche le message du serveur.
 */
export const authInterceptor: HttpInterceptorFn = (requete, suivant) => {
  const adresse = urlApi(requete.url);
  if (
    !adresse ||
    requete.context.get(SANS_AUTHENTIFICATION) ||
    ROUTES_PUBLIQUES.has(adresse.pathname)
  ) {
    return suivant(requete);
  }

  const auth = inject(AuthService);
  const router = inject(Router);
  const jetonEnvoye = auth.jeton();

  return suivant(avecJeton(requete, jetonEnvoye)).pipe(
    catchError((erreur: unknown) => {
      if (erreur instanceof HttpErrorResponse && erreur.status === 401 && auth.estConnecte()) {
        return rejouerApresRafraichissement(requete, suivant, auth, jetonEnvoye, erreur);
      }
      return throwError(() => erreur);
    }),
    catchError((erreur: unknown) => {
      if (erreur instanceof HttpErrorResponse && erreur.status === 403) {
        redirigerSelonEtatDuCompte(erreur, auth, router);
      }
      return throwError(() => erreur);
    }),
  );
};

function rejouerApresRafraichissement(
  requete: HttpRequest<unknown>,
  suivant: HttpHandlerFn,
  auth: AuthService,
  jetonEnvoye: string | null,
  erreurInitiale: HttpErrorResponse,
): Observable<HttpEvent<unknown>> {
  // Un autre appel a déjà rafraîchi la session pendant que celui-ci était en route.
  const jetonActuel = auth.jeton();
  const nouveauJeton$ =
    jetonActuel && jetonActuel !== jetonEnvoye
      ? of(jetonActuel)
      : auth.rafraichir().pipe(
          catchError(() => {
            auth.terminerSession(MESSAGE_SESSION_EXPIREE);
            return throwError(() => erreurInitiale);
          }),
        );

  return nouveauJeton$.pipe(
    switchMap((jeton) =>
      suivant(avecJeton(requete, jeton)).pipe(
        catchError((erreur: unknown) => {
          // Jeton tout neuf et toujours refusé : la session n'est plus valable.
          if (erreur instanceof HttpErrorResponse && erreur.status === 401) {
            auth.terminerSession(MESSAGE_SESSION_EXPIREE);
          }
          return throwError(() => erreur);
        }),
      ),
    ),
  );
}

function redirigerSelonEtatDuCompte(
  erreur: HttpErrorResponse,
  auth: AuthService,
  router: Router,
): void {
  switch (codeErreur(erreur)) {
    case CODES_ERREUR.MOT_DE_PASSE_TEMPORAIRE:
      auth.signalerMotDePasseTemporaire();
      break;
    case CODES_ERREUR.ABONNEMENT_EN_ATTENTE_PAIEMENT:
      auth.mettreAJourStatutAbonnement('EN_ATTENTE_PAIEMENT');
      break;
    case CODES_ERREUR.ABONNEMENT_DESACTIVE:
      auth.mettreAJourStatutAbonnement('DESACTIVE');
      break;
    default:
      // ACCES_REFUSE, ABONNEMENT_EXPIRE, règles métier... : affichés par la page.
      return;
  }
  const redirection = auth.redirectionObligatoire();
  if (redirection && !router.url.startsWith(redirection)) {
    void router.navigateByUrl(redirection);
  }
}
