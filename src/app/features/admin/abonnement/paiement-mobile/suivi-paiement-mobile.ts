import { HttpErrorResponse } from '@angular/common/http';
import {
  catchError,
  concat,
  defer,
  EMPTY,
  exhaustMap,
  map,
  Observable,
  of,
  takeUntil,
  takeWhile,
  throwError,
  timer,
} from 'rxjs';
import { StatutPaiementMobileResponse } from '../../../../core/models/abonnement.model';
import { AbonnementService } from '../../../../core/services/abonnement.service';
import { AuthService } from '../../../../core/services/auth.service';
import { interrogationPeriodique } from '../../../../core/utils/interrogation';

/** Relecture du statut d'un paiement mobile. */
export const INTERVALLE_SUIVI_MS = 3000;
/** Sans fin de session connue (page de retour, expireLe absent) : arrêt après 10 minutes. */
export const DUREE_MAX_SUIVI_MS = 10 * 60_000;

export const MESSAGE_RECONNEXION = 'Votre paiement est enregistré. Reconnectez-vous pour accéder à Batulo.';
export const MESSAGE_ECHEC_MOBILE =
  'Le paiement n’a pas abouti : il a été refusé, annulé, ou la session de paiement a expiré. Votre abonnement n’a pas changé.';
export const MESSAGE_EXPIRE_MOBILE =
  'La session de paiement a expiré sans paiement confirmé. Votre abonnement n’a pas changé : relancez un paiement.';
export const MESSAGE_ATTENTE_LONGUE =
  'Le paiement n’est pas encore confirmé. Si vous avez payé, vérifiez à nouveau dans quelques instants ; sinon, relancez un paiement.';

/** Un statut relu, ou la fin du suivi sans réponse définitive (session expirée ou attente trop longue). */
export type EvenementSuivi =
  | { type: 'statut'; statut: StatutPaiementMobileResponse }
  | { type: 'expire' };

/** Erreur à ignorer pendant le suivi (réseau, serveur, trop de requêtes) : le prochain battement réessaie. */
export function erreurPassagere(erreur: unknown): boolean {
  if (!(erreur instanceof HttpErrorResponse)) {
    return false;
  }
  return erreur.status === 0 || erreur.status === 408 || erreur.status === 429 || erreur.status >= 500;
}

/** Fin du suivi : expireLe de la session si connu, sinon DUREE_MAX_SUIVI_MS à partir de maintenant. */
export function finDuSuivi(expireLe: string | null | undefined, maintenant = Date.now()): number {
  const fin = expireLe ? Date.parse(expireLe) : NaN;
  return Number.isFinite(fin) ? fin : maintenant + DUREE_MAX_SUIVI_MS;
}

/**
 * Suivi d'un paiement mobile : GET .../paiement-mobile/{reference} toutes les 3 s, onglet visible seulement
 * (relu tout de suite au retour sur l'onglet, par exemple après avoir payé sur le téléphone). Émet chaque statut ;
 * se termine au premier statut REUSSI ou ECHOUE, ou à `finLe` après une dernière lecture (« expire » si le paiement
 * est toujours en attente). Une erreur passagère est ignorée ; une autre (404 PAIEMENT_INTROUVABLE…) termine le
 * suivi en erreur. Se désabonner (quitter la page) l'arrête. `document` : injecté par le composant (DOCUMENT).
 */
export function suivrePaiementMobile(
  service: AbonnementService,
  reference: string,
  finLe: number,
  document: Document,
  intervalleMs = INTERVALLE_SUIVI_MS,
): Observable<EvenementSuivi> {
  const lire = () =>
    service
      .statutMobile(reference)
      .pipe(catchError((erreur: unknown) => (erreurPassagere(erreur) ? EMPTY : throwError(() => erreur))));

  const interrogation = interrogationPeriodique(intervalleMs, document).pipe(
    exhaustMap(() => lire()),
    takeUntil(defer(() => timer(Math.max(finLe - Date.now(), 0)))),
    map((statut): EvenementSuivi => ({ type: 'statut', statut })),
  );
  // Paiement fait juste avant l'expiration : une dernière lecture avant de conclure.
  const derniereLecture = defer(() =>
    service.statutMobile(reference).pipe(
      map((statut): EvenementSuivi => (statut.statut === 'EN_ATTENTE' ? { type: 'expire' } : { type: 'statut', statut })),
      catchError((erreur: unknown) => (erreurPassagere(erreur) ? of<EvenementSuivi>({ type: 'expire' }) : throwError(() => erreur))),
    ),
  );

  return concat(interrogation, derniereLecture).pipe(
    takeWhile((evenement) => evenement.type === 'statut' && evenement.statut.statut === 'EN_ATTENTE', true),
  );
}

/**
 * Paiement réussi : le statut est écrit dans le jeton, il faut un nouveau jeton pour que le backend ouvre l'accès.
 * Émet true si la session est à jour, false s'il faut se reconnecter (rafraîchissement refusé).
 */
export function activerAbonnement(auth: AuthService, statut: StatutPaiementMobileResponse): Observable<boolean> {
  auth.mettreAJourStatutAbonnement(statut.abonnement.statut);
  return auth.rafraichir().pipe(
    map(() => true),
    catchError(() => of(false)),
  );
}
