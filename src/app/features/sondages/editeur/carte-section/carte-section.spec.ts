import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { questionDeTest, sectionDeTest, sondageDeTest } from '../../../../testing/donnees-test';
import { EditeurSondageStore, ElementQuestion } from '../editeur-sondage.store';
import { CarteSection } from './carte-section';

type Interne = {
  deposer(e: CdkDragDrop<number, number, number | null>): void;
  positionAutorisee(index: number, drag: CdkDrag, liste: CdkDropList): boolean;
  entreeAutorisee(drag: CdkDrag<number | null>, liste: CdkDropList): boolean;
  listesConnectees(): string[];
};

describe('CarteSection (glisser-déposer entre sections)', () => {
  let fixture: ComponentFixture<CarteSection>;
  let store: Record<string, ReturnType<typeof vi.fn>>;
  const section = sectionDeTest({ id: 10, questions: [questionDeTest({ id: 1 }), questionDeTest({ id: 2 })] });
  const sondage = signal(sondageDeTest({ sections: [section, sectionDeTest({ id: 20 }), sectionDeTest({ id: 30 })] }));

  async function creer(): Promise<Interne> {
    fixture = TestBed.createComponent(CarteSection);
    fixture.componentRef.setInput('section', section);
    fixture.componentRef.setInput('position', 0);
    fixture.componentRef.setInput('nombreSections', 3);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.componentInstance as unknown as Interne;
  }

  beforeEach(() => {
    store = {
      signalerEtat: vi.fn(),
      oublierEtat: vi.fn(),
      modifierSection: vi.fn(() => of({})),
      deplacerQuestion: vi.fn(() => of({})),
      changerDeSection: vi.fn(() => of({})),
      peutChangerDeSection: vi.fn(() => true),
      sectionPleine: vi.fn(() => false),
      recharger: vi.fn(),
      questionEnregistree: vi.fn(() => undefined),
    };
    const elements = computed(
      () =>
        new Map<number, ElementQuestion[]>(
          sondage().sections.map((s) => [s.id, s.questions.map((q) => ({ cle: `question-${q.id}`, question: q }))]),
        ),
    );
    TestBed.configureTestingModule({
      imports: [CarteSection],
      providers: [
        {
          provide: EditeurSondageStore,
          useValue: { ...store, sondage, elements, modifiable: signal(true), criteresModifiables: signal(true) },
        },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    });
  });

  it('liste reliée aux listes des autres sections', async () => {
    const carte = await creer();
    expect(carte.listesConnectees()).toEqual(['questions-section-20', 'questions-section-30']);
    expect(fixture.nativeElement.querySelector('.questions').id).toBe('questions-section-10');
  });

  it('dépôt venant d’une autre section : changement de section à la position du dépôt', async () => {
    const carte = await creer();
    const ici = {} as CdkDropList;
    const ailleurs = {} as CdkDropList;
    carte.deposer({ previousContainer: ailleurs, container: ici, item: { data: 7 }, currentIndex: 1, previousIndex: 0 } as never);
    expect(store['changerDeSection']).toHaveBeenCalledWith(7, 10, 1);

    carte.deposer({ previousContainer: ici, container: ici, item: { data: 1 }, currentIndex: 1, previousIndex: 0 } as never);
    expect(store['deplacerQuestion']).toHaveBeenCalledWith(10, 0, 1);
  });

  it('entrée : question enregistrée sans modification, section pas pleine ; position jusqu’après la dernière', async () => {
    const carte = await creer();
    const ici = {} as CdkDropList;
    const ailleurs = {} as CdkDropList;
    expect(carte.entreeAutorisee({ dropContainer: ailleurs, data: 7 } as never, ici)).toBe(true);
    store['peutChangerDeSection'].mockReturnValue(false);
    expect(carte.entreeAutorisee({ dropContainer: ailleurs, data: 7 } as never, ici)).toBe(false);
    expect(carte.entreeAutorisee({ dropContainer: ici, data: 1 } as never, ici)).toBe(true);
    store['peutChangerDeSection'].mockReturnValue(true);
    store['sectionPleine'].mockReturnValue(true);
    expect(carte.entreeAutorisee({ dropContainer: ailleurs, data: 7 } as never, ici)).toBe(false);

    expect(carte.positionAutorisee(2, { dropContainer: ailleurs } as never, ici)).toBe(true);
    expect(carte.positionAutorisee(2, { dropContainer: ici } as never, ici)).toBe(false);
  });
});
