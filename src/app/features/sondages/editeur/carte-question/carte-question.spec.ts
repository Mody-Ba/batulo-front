import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatDialog } from '@angular/material/dialog';
import { MatSelectHarness } from '@angular/material/select/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import { QuestionResponse } from '../../../../core/models/sondage.model';
import { questionDeTest, sectionDeTest, sondageDeTest } from '../../../../testing/donnees-test';
import { EditeurSondageStore } from '../editeur-sondage.store';
import { DELAI_ENREGISTREMENT_MS } from '../enregistrement-auto';
import { CarteQuestion } from './carte-question';

describe('CarteQuestion', () => {
  let fixture: ComponentFixture<CarteQuestion>;
  let store: Record<string, ReturnType<typeof vi.fn>>;
  const modifiable = signal(true);
  let reponseDialogue: boolean;
  let dialog: { open: ReturnType<typeof vi.fn> };

  async function creer(question: QuestionResponse | null): Promise<HTMLElement> {
    fixture = TestBed.createComponent(CarteQuestion);
    fixture.componentRef.setInput('question', question);
    fixture.componentRef.setInput('cle', question ? `question-${question.id}` : 'nouvelle-1');
    fixture.componentRef.setInput('sectionId', 10);
    fixture.componentRef.setInput('numero', 1);
    fixture.componentRef.setInput('nombreEnregistrees', 1);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  function saisir(element: HTMLElement, selecteur: string, valeur: string): void {
    const champ = element.querySelector<HTMLInputElement | HTMLTextAreaElement>(selecteur)!;
    champ.value = valeur;
    champ.dispatchEvent(new Event('input'));
  }

  beforeEach(() => {
    reponseDialogue = true;
    dialog = { open: vi.fn(() => ({ afterClosed: () => of(reponseDialogue) })) };
    modifiable.set(true);
    store = {
      signalerEtat: vi.fn(),
      oublierEtat: vi.fn(),
      creerQuestion: vi.fn(),
      modifierQuestion: vi.fn(),
      supprimerQuestion: vi.fn(() => of({})),
      retirerQuestionLocale: vi.fn(),
      deplacerQuestion: vi.fn(() => of({})),
      recharger: vi.fn(),
      questionEnregistree: vi.fn(() => undefined),
      definirCritere: vi.fn(() => of({})),
      peutChangerDeSection: vi.fn(() => true),
      sectionPleine: vi.fn(() => false),
      changerDeSection: vi.fn(() => of({})),
    };
    TestBed.configureTestingModule({
      imports: [CarteQuestion],
      providers: [
        {
          provide: EditeurSondageStore,
          useValue: {
            ...store,
            modifiable,
            criteresModifiables: signal(true),
            sondage: signal(
              sondageDeTest({
                sections: [sectionDeTest({ id: 10, titre: 'Profil' }), sectionDeTest({ id: 20, titre: 'Avis' })],
              }),
            ),
          },
        },
        { provide: MatDialog, useValue: dialog },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    });
  });

  afterEach(() => vi.useRealTimers());

  it('question enregistrée : contenu affiché, « Enregistré », puis PUT 800 ms après une modification', async () => {
    const question = questionDeTest();
    store['modifierQuestion'].mockReturnValue(of(question));
    const element = await creer(question);
    expect(element.querySelector<HTMLTextAreaElement>('textarea')!.value).toBe('Votre secteur ?');
    expect(element.textContent).toContain('Choix unique');
    expect(element.querySelectorAll('app-editeur-options input').length).toBe(2);
    expect(element.textContent).toContain('Enregistré');

    vi.useFakeTimers();
    saisir(element, 'textarea', 'Votre secteur d’activité ?');
    vi.advanceTimersByTime(DELAI_ENREGISTREMENT_MS);
    expect(store['modifierQuestion']).toHaveBeenCalledWith(
      101,
      expect.objectContaining({
        libelle: 'Votre secteur d’activité ?',
        type: 'CHOIX_UNIQUE',
        options: [
          { id: 1001, libelle: 'Agriculture', valeur: 'agriculture' },
          { id: 1002, libelle: 'Commerce', valeur: 'commerce' },
        ],
      }),
    );
  });

  it('nouvelle question : créée (POST) dès qu’elle est valide, puis modifiée (PUT) avec les ids des options', async () => {
    const creee = questionDeTest({
      id: 555,
      libelle: 'Secteur',
      options: [
        { id: 1, libelle: 'Option 1', valeur: 'option_1', ordre: 1 },
        { id: 2, libelle: 'Option 2', valeur: 'option_2', ordre: 2 },
      ],
    });
    store['creerQuestion'].mockReturnValue(of(creee));
    store['modifierQuestion'].mockReturnValue(of(creee));
    const element = await creer(null);
    expect(element.textContent).toContain('Modifications non enregistrées');

    vi.useFakeTimers();
    saisir(element, 'textarea', 'Secteur');
    vi.advanceTimersByTime(DELAI_ENREGISTREMENT_MS);
    expect(store['creerQuestion']).toHaveBeenCalledWith(
      10,
      'nouvelle-1',
      expect.objectContaining({ libelle: 'Secteur', options: [{ libelle: 'Option 1' }, { libelle: 'Option 2' }] }),
    );

    saisir(element, 'textarea', 'Secteur d’activité');
    vi.advanceTimersByTime(DELAI_ENREGISTREMENT_MS);
    expect(store['creerQuestion']).toHaveBeenCalledTimes(1);
    expect(store['modifierQuestion']).toHaveBeenCalledWith(
      555,
      expect.objectContaining({
        options: [
          { id: 1, libelle: 'Option 1', valeur: 'option_1' },
          { id: 2, libelle: 'Option 2', valeur: 'option_2' },
        ],
      }),
    );
  });

  it('nouvelle question sans libellé : rien n’est envoyé, l’erreur s’affiche sur la carte', async () => {
    const element = await creer(null);
    vi.useFakeTimers();
    saisir(element, 'input[formcontrolname="aide"]', 'Une aide');
    vi.advanceTimersByTime(DELAI_ENREGISTREMENT_MS);
    fixture.detectChanges();
    expect(store['creerQuestion']).not.toHaveBeenCalled();
    expect(element.textContent).toContain('Le libellé de la question est obligatoire.');
    expect(element.textContent).toContain('À corriger avant l’enregistrement');
  });

  it('refus du serveur : son message s’affiche sur cette question, avec « Réessayer »', async () => {
    store['modifierQuestion']
      .mockReturnValueOnce(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 400,
              error: { code: 'VALEUR_OPTION_EN_DOUBLE', message: 'La valeur « x » est utilisée par deux options.' },
            }),
        ),
      )
      .mockReturnValueOnce(of(questionDeTest()));
    const element = await creer(questionDeTest());
    saisir(element, 'textarea', 'Autre libellé');
    element.querySelector('textarea')!.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    fixture.detectChanges();
    expect(element.textContent).toContain('La valeur « x » est utilisée par deux options.');
    expect(element.textContent).toContain('Échec de l’enregistrement');

    Array.from(element.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Réessayer'))!
      .click();
    fixture.detectChanges();
    expect(store['modifierQuestion']).toHaveBeenCalledTimes(2);
    expect(element.textContent).not.toContain('La valeur « x »');
  });

  it('changer de type en perdant les options : confirmation ; refusée, le type ne change pas', async () => {
    const element = await creer(questionDeTest());
    const selecteur = await TestbedHarnessEnvironment.loader(fixture).getHarness(MatSelectHarness);

    reponseDialogue = false;
    await selecteur.open();
    await selecteur.clickOptions({ text: /Nombre/ });
    expect(dialog.open).toHaveBeenCalledTimes(1);
    expect(dialog.open.mock.calls[0][1].data.message).toContain('ses 2 options');
    expect(await selecteur.getValueText()).toContain('Choix unique');
    expect(element.querySelector('app-question-numerique')).toBeNull();

    reponseDialogue = true;
    await selecteur.open();
    await selecteur.clickOptions({ text: /Nombre/ });
    expect(await selecteur.getValueText()).toContain('Nombre');
    expect(element.querySelector('app-question-numerique')).not.toBeNull();
  });

  it('changer entre types à options : sans confirmation, options gardées', async () => {
    const element = await creer(questionDeTest());
    const selecteur = await TestbedHarnessEnvironment.loader(fixture).getHarness(MatSelectHarness);
    await selecteur.open();
    await selecteur.clickOptions({ text: /Classement/ });
    expect(dialog.open).not.toHaveBeenCalled();
    expect(element.querySelector('app-question-classement')).not.toBeNull();
    expect(element.querySelectorAll('app-editeur-options input').length).toBe(2);
  });

  it('lecture seule : champs et actions désactivés', async () => {
    modifiable.set(false);
    const element = await creer(questionDeTest());
    expect(element.querySelector<HTMLTextAreaElement>('textarea')!.disabled).toBe(true);
    const menu = element.querySelector<HTMLButtonElement>('button[aria-label="Actions de la question 1"]')!;
    expect(menu.disabled).toBe(true);
    expect(element.querySelector('.entete .poignee')).toBeNull();
    const poigneesOptions = Array.from(element.querySelectorAll<HTMLButtonElement>('app-editeur-options .poignee'));
    expect(poigneesOptions.every((b) => b.disabled)).toBe(true);
  });

  it('supprimer : après confirmation ; une nouvelle question vide disparaît sans confirmation', async () => {
    await creer(questionDeTest());
    (fixture.componentInstance as unknown as { supprimer(): void }).supprimer();
    expect(dialog.open).toHaveBeenCalledTimes(1);
    expect(store['supprimerQuestion']).toHaveBeenCalledWith(101);

    dialog.open.mockClear();
    await creer(null);
    (fixture.componentInstance as unknown as { supprimer(): void }).supprimer();
    expect(dialog.open).not.toHaveBeenCalled();
    expect(store['retirerQuestionLocale']).toHaveBeenCalledWith(10, 'nouvelle-1');
  });

  it('question enregistrée d’un type compatible : réglage du critère d’analyse affiché', async () => {
    const question = questionDeTest();
    store['questionEnregistree'].mockReturnValue(question);
    const element = await creer(question);
    expect(element.querySelector('app-critere-question')).not.toBeNull();

    store['questionEnregistree'].mockReturnValue(questionDeTest({ type: 'TEXTE_COURT', options: [] }));
    const autre = await creer(questionDeTest({ type: 'TEXTE_COURT', options: [], configuration: { longueurMax: 255 } }));
    expect(autre.querySelector('app-critere-question')).toBeNull();
  });

  it('menu : « Déplacer vers une autre section » propose les autres sections et déplace à la fin', async () => {
    await creer(questionDeTest());
    const carte = fixture.componentInstance as unknown as {
      autresSections(): { section: { id: number }; numero: number }[];
      changerDeSection(id: number): void;
    };
    expect(carte.autresSections().map((a) => [a.section.id, a.numero])).toEqual([[20, 2]]);
    carte.changerDeSection(20);
    expect(store['changerDeSection']).toHaveBeenCalledWith(101, 20);
  });
});
