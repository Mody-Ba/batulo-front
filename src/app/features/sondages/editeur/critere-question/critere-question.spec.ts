import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { QuestionResponse } from '../../../../core/models/sondage.model';
import { questionDeTest } from '../../../../testing/donnees-test';
import { EditeurSondageStore } from '../editeur-sondage.store';
import { DELAI_ENREGISTREMENT_MS } from '../enregistrement-auto';
import { CritereQuestion } from './critere-question';

describe('CritereQuestion', () => {
  let fixture: ComponentFixture<CritereQuestion>;
  let definirCritere: ReturnType<typeof vi.fn>;
  const criteresModifiables = signal(true);

  async function creer(question: QuestionResponse): Promise<HTMLElement> {
    fixture = TestBed.createComponent(CritereQuestion);
    fixture.componentRef.setInput('question', question);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  function interrupteur(element: HTMLElement): void {
    element.querySelector<HTMLButtonElement>('mat-slide-toggle button')!.click();
    fixture.detectChanges();
  }

  function bouton(element: HTMLElement, texte: string): HTMLButtonElement {
    return Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes(texte))!;
  }

  beforeEach(() => {
    criteresModifiables.set(true);
    definirCritere = vi.fn(() => of({}));
    TestBed.configureTestingModule({
      imports: [CritereQuestion],
      providers: [
        {
          provide: EditeurSondageStore,
          useValue: { criteresModifiables, definirCritere, signalerEtat: vi.fn(), oublierEtat: vi.fn() },
        },
      ],
    });
  });

  afterEach(() => vi.useRealTimers());

  it('choix unique : l’interrupteur enregistre tout de suite, sans découpage', async () => {
    const element = await creer(questionDeTest());
    interrupteur(element);
    expect(definirCritere).toHaveBeenCalledWith(101, { estCritere: true, critereConfig: null });
    interrupteur(element);
    expect(definirCritere).toHaveBeenLastCalledWith(101, { estCritere: false, critereConfig: null });
  });

  it('date : granularité MOIS par défaut, ANNEE au choix', async () => {
    const element = await creer(questionDeTest({ type: 'DATE', options: [], configuration: {} }));
    interrupteur(element);
    expect(definirCritere).toHaveBeenCalledWith(101, { estCritere: true, critereConfig: { granularite: 'MOIS' } });
    bouton(element, 'Année').click();
    fixture.detectChanges();
    expect(definirCritere).toHaveBeenLastCalledWith(101, { estCritere: true, critereConfig: { granularite: 'ANNEE' } });
  });

  it('numérique sans min ni max : tranches égales impossibles, bornes personnalisées croissantes', async () => {
    const element = await creer(questionDeTest({ type: 'NUMERIQUE', options: [], configuration: { decimales: 0 } }));
    // Avant tout changement : l'attente de 800 ms (debounceTime) réutilise le minuteur déjà programmé.
    vi.useFakeTimers();
    interrupteur(element);
    expect(element.textContent).toContain('Les tranches égales se calculent entre le minimum et le maximum');

    bouton(element, 'Bornes personnalisées').click();
    fixture.detectChanges();
    const champs = () => element.querySelectorAll<HTMLInputElement>('.bornes input');
    expect(champs().length).toBe(1);
    champs()[0].value = '30';
    champs()[0].dispatchEvent(new Event('input'));
    bouton(element, 'Ajouter une borne').click();
    fixture.detectChanges();
    champs()[1].value = '18';
    champs()[1].dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(DELAI_ENREGISTREMENT_MS);
    fixture.detectChanges();
    expect(element.textContent).toContain('Les bornes doivent être strictement croissantes.');
    expect(definirCritere).not.toHaveBeenCalledWith(101, expect.objectContaining({ critereConfig: { tranches: [30, 18] } }));

    champs()[1].value = '45';
    champs()[1].dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(DELAI_ENREGISTREMENT_MS);
    fixture.detectChanges();
    expect(definirCritere).toHaveBeenLastCalledWith(101, { estCritere: true, critereConfig: { tranches: [30, 45] } });
    expect(element.textContent).toContain('moins de 30 · 30 à 45 · 45 et plus');
  });

  it('numérique avec min et max : bornes personnalisées proposées à partir des 5 tranches égales', async () => {
    const element = await creer(
      questionDeTest({ type: 'NUMERIQUE', options: [], configuration: { min: 0, max: 100, decimales: 0 } }),
    );
    interrupteur(element);
    expect(element.textContent).not.toContain('Les tranches égales se calculent');
    bouton(element, 'Bornes personnalisées').click();
    fixture.detectChanges();
    expect(Array.from(element.querySelectorAll<HTMLInputElement>('.bornes input')).map((c) => c.value)).toEqual([
      '20',
      '40',
      '60',
      '80',
    ]);
  });

  it('critère existant repris ; sans droit de gérer, tout est désactivé', async () => {
    criteresModifiables.set(false);
    const element = await creer(
      questionDeTest({ type: 'NUMERIQUE', options: [], configuration: {}, estCritere: true, critereConfig: { tranches: [18, 65] } }),
    );
    expect(element.querySelector<HTMLButtonElement>('mat-slide-toggle button')!.disabled).toBe(true);
    expect(element.querySelectorAll('.bornes input').length).toBe(2);
    expect(element.textContent).toContain('moins de 18 · 18 à 65 · 65 et plus');
  });
});
