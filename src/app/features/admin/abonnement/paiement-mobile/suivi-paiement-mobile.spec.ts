import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { StatutPaiementMobileResponse } from '../../../../core/models/abonnement.model';
import { AbonnementService } from '../../../../core/services/abonnement.service';
import { AuthService } from '../../../../core/services/auth.service';
import { statutMobileDeTest } from '../../../../testing/donnees-test';
import {
  activerAbonnement,
  DUREE_MAX_SUIVI_MS,
  erreurPassagere,
  EvenementSuivi,
  finDuSuivi,
  INTERVALLE_SUIVI_MS,
  suivrePaiementMobile,
} from './suivi-paiement-mobile';

class DocumentSimule extends EventTarget {
  visibilityState: DocumentVisibilityState = 'visible';
  cacher(cache: boolean): void {
    this.visibilityState = cache ? 'hidden' : 'visible';
    this.dispatchEvent(new Event('visibilitychange'));
  }
}

const enAttente = statutMobileDeTest();
const reussi = statutMobileDeTest({ statut: 'REUSSI', datePaiement: '2026-11-15T12:05:00Z' });
const echoue = statutMobileDeTest({ statut: 'ECHOUE' });

describe('suivi d’un paiement mobile', () => {
  let doc: DocumentSimule;
  let reponses: (() => Observable<StatutPaiementMobileResponse>)[];
  let statutMobile: ReturnType<typeof vi.fn>;
  let evenements: EvenementSuivi[];
  let termine: boolean;
  let erreur: unknown;

  function suivre(finLe = Date.now() + 60_000) {
    const service = { statutMobile } as unknown as AbonnementService;
    return suivrePaiementMobile(service, 'ref-123', finLe, doc as unknown as Document, INTERVALLE_SUIVI_MS).subscribe({
      next: (e) => evenements.push(e),
      complete: () => (termine = true),
      error: (e: unknown) => (erreur = e),
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    doc = new DocumentSimule();
    reponses = [];
    statutMobile = vi.fn(() => (reponses.shift() ?? (() => of(enAttente)))());
    evenements = [];
    termine = false;
    erreur = null;
  });
  afterEach(() => vi.useRealTimers());

  it('toutes les 3 s tant que EN_ATTENTE, puis arrêt au succès', () => {
    reponses = [() => of(enAttente), () => of(enAttente), () => of(reussi)];
    suivre();
    vi.advanceTimersByTime(0);
    expect(statutMobile).toHaveBeenCalledTimes(1);
    expect(statutMobile).toHaveBeenCalledWith('ref-123');
    vi.advanceTimersByTime(INTERVALLE_SUIVI_MS * 2);
    expect(statutMobile).toHaveBeenCalledTimes(3);
    expect(evenements.at(-1)).toEqual({ type: 'statut', statut: reussi });
    expect(termine).toBe(true);
    vi.advanceTimersByTime(INTERVALLE_SUIVI_MS * 5);
    expect(statutMobile).toHaveBeenCalledTimes(3);
  });

  it('arrêt à l’échec', () => {
    reponses = [() => of(echoue)];
    suivre();
    vi.advanceTimersByTime(INTERVALLE_SUIVI_MS * 3);
    expect(statutMobile).toHaveBeenCalledTimes(1);
    expect(evenements).toEqual([{ type: 'statut', statut: echoue }]);
    expect(termine).toBe(true);
  });

  it('expiration de la session : une dernière lecture, puis « expire » si toujours en attente', () => {
    suivre(Date.now() + 10_000);
    vi.advanceTimersByTime(10_000);
    const appels = statutMobile.mock.calls.length;
    expect(evenements.at(-1)).toEqual({ type: 'expire' });
    expect(termine).toBe(true);
    vi.advanceTimersByTime(30_000);
    expect(statutMobile).toHaveBeenCalledTimes(appels);
  });

  it('payé juste avant l’expiration : la dernière lecture donne le succès', () => {
    suivre(Date.now() + 1000);
    reponses = [() => of(enAttente), () => of(reussi)];
    vi.advanceTimersByTime(1000);
    expect(evenements.at(-1)).toEqual({ type: 'statut', statut: reussi });
  });

  it('onglet caché : pas d’appel ; au retour, lecture immédiate', () => {
    suivre();
    vi.advanceTimersByTime(0);
    doc.cacher(true);
    vi.advanceTimersByTime(INTERVALLE_SUIVI_MS * 4);
    expect(statutMobile).toHaveBeenCalledTimes(1);
    reponses = [() => of(reussi)];
    doc.cacher(false);
    vi.advanceTimersByTime(0);
    expect(statutMobile).toHaveBeenCalledTimes(2);
    expect(termine).toBe(true);
  });

  it('quitter la page (désabonnement) arrête le suivi', () => {
    const abonnement = suivre();
    vi.advanceTimersByTime(0);
    abonnement.unsubscribe();
    vi.advanceTimersByTime(INTERVALLE_SUIVI_MS * 10);
    expect(statutMobile).toHaveBeenCalledTimes(1);
  });

  it('erreur passagère (réseau, 5xx, 429) ignorée ; 404 PAIEMENT_INTROUVABLE termine en erreur', () => {
    reponses = [
      () => throwError(() => new HttpErrorResponse({ status: 0 })),
      () => throwError(() => new HttpErrorResponse({ status: 502 })),
      () => throwError(() => new HttpErrorResponse({ status: 404, error: { code: 'PAIEMENT_INTROUVABLE', message: 'x' } })),
    ];
    suivre();
    vi.advanceTimersByTime(INTERVALLE_SUIVI_MS * 2);
    expect(statutMobile).toHaveBeenCalledTimes(3);
    expect(erreur).toBeInstanceOf(HttpErrorResponse);
    expect((erreur as HttpErrorResponse).status).toBe(404);
  });

  it('fin du suivi : expireLe s’il est connu, sinon 10 minutes', () => {
    expect(finDuSuivi('2026-11-15T12:30:00Z')).toBe(Date.parse('2026-11-15T12:30:00Z'));
    expect(finDuSuivi(null, 1000)).toBe(1000 + DUREE_MAX_SUIVI_MS);
    expect(finDuSuivi('pas une date', 1000)).toBe(1000 + DUREE_MAX_SUIVI_MS);
    expect(erreurPassagere(new HttpErrorResponse({ status: 429 }))).toBe(true);
    expect(erreurPassagere(new HttpErrorResponse({ status: 403 }))).toBe(false);
  });

  it('activation : statut mis à jour puis nouveau jeton ; refus du rafraîchissement -> false', () => {
    const auth = { mettreAJourStatutAbonnement: vi.fn(), rafraichir: vi.fn(() => of('jeton')) };
    const statut = statutMobileDeTest({ statut: 'REUSSI', abonnement: { ...reussi.abonnement!, statut: 'ACTIF' } });
    const resultats: boolean[] = [];
    activerAbonnement(auth as unknown as AuthService, statut).subscribe((r) => resultats.push(r));
    expect(auth.mettreAJourStatutAbonnement).toHaveBeenCalledWith('ACTIF');
    auth.rafraichir.mockReturnValue(throwError(() => new Error('refus')));
    activerAbonnement(auth as unknown as AuthService, statut).subscribe((r) => resultats.push(r));
    expect(resultats).toEqual([true, false]);
  });
});
