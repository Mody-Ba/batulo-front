import { ecrireLocal, effacerLocal, lireLocal, nouvelUuid } from '../../../core/utils/stockage-local';
import { DUREE_BROUILLON_JOURS, memoireRepondant } from './memoire-repondant';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('Stockage local protégé et mémoire du répondant', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('stockage refusé (navigation privée, plein) : lecture null, écriture false, jamais d’exception', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('refusé', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('plein', 'QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('refusé', 'SecurityError');
    });
    expect(lireLocal('x')).toBeNull();
    expect(ecrireLocal('x', 1)).toBe(false);
    expect(() => effacerLocal('x')).not.toThrow();
    // Sans stockage, le jeton reste le même pendant la visite.
    const jeton = memoireRepondant.jetonRepondant('lien-prive');
    expect(memoireRepondant.jetonRepondant('lien-prive')).toBe(jeton);
    expect(() => memoireRepondant.ecrireBrouillon('lien-prive', 0, { 1: 'a' })).not.toThrow();
    expect(memoireRepondant.lireBrouillon('lien-prive')).toBeNull();
  });

  it('valeur illisible : ignorée', () => {
    localStorage.setItem('batulo.brouillon.l1', '{pas du json');
    expect(memoireRepondant.lireBrouillon('l1')).toBeNull();
  });

  it('UUID v4, un par sondage (lignée), gardé dans le navigateur', () => {
    expect(nouvelUuid()).toMatch(UUID);
    const a = memoireRepondant.jetonRepondant('lien-a');
    expect(a).toMatch(UUID);
    expect(memoireRepondant.jetonRepondant('lien-a')).toBe(a);
    expect(memoireRepondant.jetonRepondant('lien-b')).not.toBe(a);
    expect(localStorage.getItem('batulo.repondant.lien-a')).toBe(JSON.stringify(a));
  });

  it('UUID sans crypto.randomUUID (contexte non sécurisé) : tiré de getRandomValues, toujours au format v4', () => {
    vi.spyOn(crypto, 'randomUUID').mockImplementation(undefined as never);
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
    try {
      expect(nouvelUuid()).toMatch(UUID);
    } finally {
      delete (crypto as { randomUUID?: unknown }).randomUUID;
    }
  });

  it('brouillon : écrit, relu, effacé ; vide = effacé ; oublié après 30 jours', () => {
    memoireRepondant.ecrireBrouillon('l1', 1, { 3: 4 });
    expect(memoireRepondant.lireBrouillon('l1')).toEqual(expect.objectContaining({ section: 1, reponses: { 3: 4 } }));
    memoireRepondant.ecrireBrouillon('l1', 0, {});
    expect(memoireRepondant.lireBrouillon('l1')).toBeNull();

    memoireRepondant.ecrireBrouillon('l1', 0, { 1: 'a' });
    // Horloge de l'appareil un peu en arrière : gardé.
    expect(memoireRepondant.lireBrouillon('l1', Date.now() - 60_000)).not.toBeNull();
    const plusTard = Date.now() + (DUREE_BROUILLON_JOURS + 1) * 86_400_000;
    expect(memoireRepondant.lireBrouillon('l1', plusTard)).toBeNull();
    expect(localStorage.getItem('batulo.brouillon.l1')).toBeNull();
    localStorage.setItem('batulo.brouillon.l1', JSON.stringify({ enregistreLe: 'pas une date', section: 0, reponses: { 1: 'a' } }));
    expect(memoireRepondant.lireBrouillon('l1')).toBeNull();
  });

  it('déjà répondu : drapeau par sondage', () => {
    expect(memoireRepondant.dejaRepondu('l1')).toBe(false);
    memoireRepondant.marquerRepondu('l1');
    expect(memoireRepondant.dejaRepondu('l1')).toBe(true);
    expect(memoireRepondant.dejaRepondu('l2')).toBe(false);
  });
});
