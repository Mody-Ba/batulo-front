import { interrogationPeriodique } from './interrogation';

/** Document simulé : seul visibilityState et l'événement visibilitychange comptent. */
class DocumentSimule extends EventTarget {
  visibilityState: DocumentVisibilityState = 'visible';
  cacher(cache: boolean): void {
    this.visibilityState = cache ? 'hidden' : 'visible';
    this.dispatchEvent(new Event('visibilitychange'));
  }
}

describe('interrogationPeriodique', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('un battement tout de suite puis à intervalle ; rien onglet caché ; reprise immédiate quand il redevient visible', () => {
    const doc = new DocumentSimule();
    const battements = vi.fn();
    const abonnement = interrogationPeriodique(1000, doc as unknown as Document).subscribe(battements);
    vi.advanceTimersByTime(0);
    expect(battements).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2000);
    expect(battements).toHaveBeenCalledTimes(3);

    doc.cacher(true);
    vi.advanceTimersByTime(10_000);
    expect(battements).toHaveBeenCalledTimes(3);

    doc.cacher(false);
    vi.advanceTimersByTime(0);
    expect(battements).toHaveBeenCalledTimes(4);
    abonnement.unsubscribe();
    vi.advanceTimersByTime(5000);
    expect(battements).toHaveBeenCalledTimes(4);
  });

  it('onglet caché dès le départ : aucun appel avant qu’il soit visible', () => {
    const doc = new DocumentSimule();
    doc.visibilityState = 'hidden';
    const battements = vi.fn();
    interrogationPeriodique(1000, doc as unknown as Document).subscribe(battements);
    vi.advanceTimersByTime(5000);
    expect(battements).not.toHaveBeenCalled();
    doc.cacher(false);
    vi.advanceTimersByTime(0);
    expect(battements).toHaveBeenCalledTimes(1);
  });
});
