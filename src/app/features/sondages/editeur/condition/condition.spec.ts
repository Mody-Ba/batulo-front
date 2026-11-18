import { HttpErrorResponse } from '@angular/common/http';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSelectHarness } from '@angular/material/select/testing';
import { of, Subject, throwError } from 'rxjs';
import { ConditionAffichage, operateursPermis, SondageResponse } from '../../../../core/models/sondage.model';
import { questionDeTest, sectionDeTest, sondageDeTest } from '../../../../testing/donnees-test';
import { regleEnClair, resumeCondition, sourcesPossibles } from './condition-editeur';
import { DialogueCondition, DonneesCondition, genreValeur } from './dialogue-condition';

const enfants = questionDeTest({ id: 1, libelle: 'Avez-vous des enfants ?', type: 'OUI_NON', options: [] });
const region = questionDeTest({
  id: 2,
  libelle: 'Région',
  type: 'CHOIX_UNIQUE',
  options: [
    { id: 21, libelle: 'Kayes', valeur: 'kayes', ordre: 1 },
    { id: 22, libelle: 'Ségou', valeur: 'segou', ordre: 2 },
  ],
});
const age = questionDeTest({ id: 3, libelle: 'Âge', type: 'NUMERIQUE', options: [] });
const cible = questionDeTest({ id: 4, libelle: 'Âge des enfants', type: 'TEXTE_COURT', options: [] });
const apres = questionDeTest({ id: 5, libelle: 'Commentaire', type: 'TEXTE_LONG', options: [] });
const SONDAGE: SondageResponse = sondageDeTest({
  sections: [
    sectionDeTest({ id: 10, titre: 'Profil', questions: [enfants, region] }),
    sectionDeTest({ id: 20, titre: 'Famille', questions: [age, cible, apres] }),
    sectionDeTest({ id: 30, titre: 'Fin', questions: [] }),
  ],
});

describe('Conditions dans l’éditeur : sources, résumé, opérateurs', () => {
  it('sources : seulement les questions placées avant (question : plus haut dans sa section ; section : sections précédentes)', () => {
    expect(sourcesPossibles(SONDAGE, { type: 'question', questionId: 4 }).map((s) => s.question.id)).toEqual([1, 2, 3]);
    expect(sourcesPossibles(SONDAGE, { type: 'question', questionId: 1 })).toEqual([]);
    expect(sourcesPossibles(SONDAGE, { type: 'section', sectionId: 20 }).map((s) => s.question.id)).toEqual([1, 2]);
    expect(sourcesPossibles(SONDAGE, { type: 'section', sectionId: 10 })).toEqual([]);
    const [premiere] = sourcesPossibles(SONDAGE, { type: 'question', questionId: 4 });
    expect(premiere).toEqual(expect.objectContaining({ numeroSection: 1, numero: 1 }));
  });

  it('opérateurs permis selon le type de la source (OperateurCondition.permis)', () => {
    expect(operateursPermis('CHOIX_UNIQUE')).toEqual(['EGAL', 'DIFFERENT', 'PARMI', 'REPONDUE', 'NON_REPONDUE']);
    expect(operateursPermis('CHOIX_MULTIPLE')).toEqual(['CONTIENT', 'PARMI', 'REPONDUE', 'NON_REPONDUE']);
    expect(operateursPermis('OUI_NON')).toEqual(['EGAL', 'DIFFERENT', 'REPONDUE', 'NON_REPONDUE']);
    expect(operateursPermis('DATE')).toEqual(['EGAL', 'DIFFERENT', 'SUPERIEUR', 'INFERIEUR', 'ENTRE', 'REPONDUE', 'NON_REPONDUE']);
    expect(operateursPermis('TEXTE_LONG')).toEqual(['REPONDUE', 'NON_REPONDUE']);
    expect(genreValeur(region, 'PARMI')).toBe('options');
    expect(genreValeur(region, 'EGAL')).toBe('option');
    expect(genreValeur(age, 'ENTRE')).toBe('intervalle-nombre');
    expect(genreValeur(age, 'REPONDUE')).toBe('aucune');
  });

  it('résumé lisible : libellés des options, Oui / Non, ET / OU, intervalles', () => {
    const condition: ConditionAffichage = {
      combinaison: 'ET',
      regles: [
        { questionId: 1, operateur: 'EGAL', valeur: true },
        { questionId: 2, operateur: 'PARMI', valeur: ['kayes', 'segou'] },
      ],
    };
    expect(resumeCondition(condition, SONDAGE)).toBe('Avez-vous des enfants ? = Oui et Région est l’une de : Kayes, Ségou');
    expect(resumeCondition({ ...condition, combinaison: 'OU' }, SONDAGE)).toContain(' ou ');
    expect(regleEnClair({ questionId: 3, operateur: 'ENTRE', valeur: [18, 25] }, SONDAGE)).toBe('Âge entre 18 et 25');
    expect(regleEnClair({ questionId: 3, operateur: 'SUPERIEUR', valeur: 1000 }, SONDAGE)).toBe('Âge > 1 000');
    expect(regleEnClair({ questionId: 2, operateur: 'NON_REPONDUE' }, SONDAGE)).toBe('Région n’a pas reçu de réponse');
  });
});

/** Le sondage tel que le renverrait le serveur après PUT .../questions/{questionId}/condition. */
function avecCondition(questionId: number, condition: ConditionAffichage): SondageResponse {
  const copie = structuredClone(SONDAGE);
  copie.sections.flatMap((s) => s.questions).find((q) => q.id === questionId)!.condition = condition;
  return copie;
}

describe('DialogueCondition', () => {
  let fixture: ComponentFixture<DialogueCondition>;
  let element: HTMLElement;
  let enregistrer: ReturnType<typeof vi.fn>;
  let fermer: ReturnType<typeof vi.fn>;
  let ref: { close: ReturnType<typeof vi.fn>; disableClose: boolean; backdropClick: () => Subject<MouseEvent>; keydownEvents: () => Subject<KeyboardEvent> };
  let clicACote: Subject<MouseEvent>;
  let touches: Subject<KeyboardEvent>;
  let confirmation: boolean;
  let ouvrirConfirmation: ReturnType<typeof vi.fn>;

  async function creer(condition: ConditionAffichage | null = null, questionId = 4): Promise<void> {
    // Serveur qui garde la condition : la cible la porte dans la réponse.
    enregistrer = vi.fn((c: ConditionAffichage) => of(avecCondition(questionId, c)));
    fermer = vi.fn();
    clicACote = new Subject<MouseEvent>();
    touches = new Subject<KeyboardEvent>();
    confirmation = true;
    ref = { close: fermer, disableClose: false, backdropClick: () => clicACote, keydownEvents: () => touches };
    ouvrirConfirmation = vi.fn(() => ({ afterClosed: () => of(confirmation) }));
    const donnees: DonneesCondition = {
      sondage: SONDAGE,
      cible: { type: 'question', questionId },
      nomCible: 'la question 2 de la section 2',
      condition,
      enregistrer: enregistrer as unknown as DonneesCondition['enregistrer'],
    };
    TestBed.configureTestingModule({
      imports: [DialogueCondition],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: donnees },
        { provide: MatDialogRef, useValue: ref },
      ],
    });
    // MatDialogModule (importé par la boîte) fournit son propre MatDialog : remplacé ici.
    TestBed.overrideProvider(MatDialog, { useValue: { open: ouvrirConfirmation } });
    fixture = TestBed.createComponent(DialogueCondition);
    element = fixture.nativeElement;
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const selects = () => TestbedHarnessEnvironment.loader(fixture).getAllHarnesses(MatSelectHarness);
  const envoyer = async () => {
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('ne propose que les questions placées avant, groupées par section', async () => {
    await creer();
    const [source] = await selects();
    await source.open();
    const options = await source.getOptions();
    expect(await Promise.all(options.map((o) => o.getText()))).toEqual(['1. Avez-vous des enfants ?', '2. Région', '1. Âge']);
    expect(await source.getOptionGroups()).toHaveLength(2);
  });

  it('choix : opérateurs du type, valeur choisie dans les options (sa valeur, pas son libellé) ; corps envoyé', async () => {
    await creer();
    const [source] = await selects();
    await source.clickOptions({ text: '2. Région' });
    fixture.detectChanges();
    const [, operateur] = await selects();
    await operateur.open();
    expect(await Promise.all((await operateur.getOptions()).map((o) => o.getText()))).toEqual([
      'est égal à',
      'est différent de',
      'est l’une de',
      'a reçu une réponse',
      'n’a pas reçu de réponse',
    ]);
    await operateur.clickOptions({ text: 'est l’une de' });
    fixture.detectChanges();
    const [, , valeurs] = await selects();
    expect(await valeurs.isMultiple()).toBe(true);
    await valeurs.open();
    await valeurs.clickOptions({ text: 'Ségou' });
    await envoyer();
    expect(enregistrer).toHaveBeenCalledWith({
      combinaison: 'ET',
      regles: [{ questionId: 2, operateur: 'PARMI', valeur: ['segou'] }],
    });
    expect(fermer).toHaveBeenCalledWith(expect.objectContaining({ id: SONDAGE.id }));
  });

  it('plusieurs règles en OU ; REPONDUE sans valeur ; règle incomplète refusée avant l’envoi', async () => {
    await creer({ combinaison: 'ET', regles: [{ questionId: 1, operateur: 'EGAL', valeur: true }] });
    Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes('Ajouter une règle'))!.click();
    fixture.detectChanges();
    await envoyer();
    expect(enregistrer).not.toHaveBeenCalled();
    expect(element.textContent).toContain('Choisissez la question dont dépend l’affichage.');

    element.querySelectorAll<HTMLInputElement>('mat-radio-button input')[1].click();
    const listes = await selects();
    await listes[listes.length - 1].clickOptions({ text: '1. Âge' });
    fixture.detectChanges();
    const apres = await selects();
    await apres[apres.length - 1].clickOptions({ text: 'a reçu une réponse' });
    await envoyer();
    expect(enregistrer).toHaveBeenCalledWith({
      combinaison: 'OU',
      regles: [
        { questionId: 1, operateur: 'EGAL', valeur: true },
        { questionId: 3, operateur: 'REPONDUE' },
      ],
    });
  });

  it('intervalle : la première borne ne dépasse pas la seconde', async () => {
    await creer({ combinaison: 'ET', regles: [{ questionId: 3, operateur: 'ENTRE', valeur: [30, 18] }] });
    await envoyer();
    expect(enregistrer).not.toHaveBeenCalled();
    expect(element.textContent).toContain('La première borne doit être inférieure ou égale à la seconde.');
  });

  it('refus du serveur (400 CONDITION_INVALIDE, 409) : message affiché, la boîte reste ouverte', async () => {
    await creer({ combinaison: 'ET', regles: [{ questionId: 1, operateur: 'EGAL', valeur: true }] });
    enregistrer.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { code: 'CONDITION_INVALIDE', message: 'La question source doit être placée avant la question conditionnelle.' },
          }),
      ),
    );
    await envoyer();
    expect(element.textContent).toContain('La condition n’a pas été enregistrée');
    expect(element.textContent).toContain('La question source doit être placée avant');
    expect(fermer).not.toHaveBeenCalled();
  });

  it('fermeture sans modification (Annuler, Échap, clic à côté) : directe, sans confirmation', async () => {
    await creer({ combinaison: 'ET', regles: [{ questionId: 1, operateur: 'EGAL', valeur: true }] });
    expect(ref.disableClose).toBe(true);
    expect(element.textContent).not.toContain('Pas encore enregistrée');
    Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Annuler')!.click();
    expect(ouvrirConfirmation).not.toHaveBeenCalled();
    expect(fermer).toHaveBeenCalledTimes(1);
    touches.next(new KeyboardEvent('keydown', { key: 'Escape' }));
    clicACote.next(new MouseEvent('click'));
    expect(fermer).toHaveBeenCalledTimes(3);
  });

  it('règles non enregistrées : « Pas encore enregistrée », et Échap / clic à côté / Annuler demandent confirmation', async () => {
    await creer();
    const [source] = await selects();
    await source.clickOptions({ text: '1. Avez-vous des enfants ?' });
    fixture.detectChanges();
    expect(element.querySelector('.non-enregistree')!.textContent).toContain('Pas encore enregistrée');
    expect(element.querySelector('.non-enregistree')!.getAttribute('role')).toBe('status');

    confirmation = false;
    touches.next(new KeyboardEvent('keydown', { key: 'Escape' }));
    clicACote.next(new MouseEvent('click'));
    Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Annuler')!.click();
    expect(ouvrirConfirmation).toHaveBeenCalledTimes(3);
    expect(ouvrirConfirmation.mock.calls[0][1].data).toEqual(
      expect.objectContaining({ titre: 'Fermer sans enregistrer ?', action: 'Fermer sans enregistrer', destructive: true }),
    );
    expect(fermer).not.toHaveBeenCalled();

    confirmation = true;
    touches.next(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(fermer).toHaveBeenCalledTimes(1);
    expect(enregistrer).not.toHaveBeenCalled();
  });

  it('bouton « Enregistrer la condition » bien visible : bouton plein, principal, avec icône, dans la barre du bas', async () => {
    await creer();
    const bouton = element.querySelector<HTMLButtonElement>('mat-dialog-actions button[type="submit"]')!;
    expect(bouton.textContent).toContain('Enregistrer la condition');
    expect(bouton.classList).toContain('bouton-principal');
    expect(bouton.getAttribute('matbutton')).toBe('filled');
    expect(bouton.querySelector('mat-icon')).not.toBeNull();
  });

  it('enregistrée : fermée par le résultat, sans confirmation', async () => {
    await creer({ combinaison: 'ET', regles: [{ questionId: 1, operateur: 'EGAL', valeur: true }] });
    Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes('Ajouter une règle'))!.click();
    fixture.detectChanges();
    const listes = await selects();
    await listes[listes.length - 1].clickOptions({ text: '1. Âge' });
    fixture.detectChanges();
    const apres = await selects();
    await apres[apres.length - 1].clickOptions({ text: 'a reçu une réponse' });
    await envoyer();
    expect(enregistrer).toHaveBeenCalled();
    expect(fermer).toHaveBeenCalledWith(expect.objectContaining({ id: SONDAGE.id }));
    expect(ouvrirConfirmation).not.toHaveBeenCalled();
  });

  it('aucune question avant la cible : explication, pas de bouton « Enregistrer »', async () => {
    await creer(null, 1);
    expect(element.textContent).toContain('Aucune question enregistrée n’est placée avant');
    expect(Array.from(element.querySelectorAll('button')).some((b) => b.textContent?.includes('Enregistrer'))).toBe(false);
  });
});
