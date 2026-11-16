import { ConditionAffichage, OperateurCondition, RegleCondition, SectionAffichee } from '../../core/models/sondage.model';
import { questionDeTest, sectionDeTest } from '../../testing/donnees-test';
import { conditionVerifiee, evaluerVisibilite, regleVerifiee } from './conditions';
import { ValeurReponse } from './reponses';

const r = (operateur: OperateurCondition, valeur?: RegleCondition['valeur']): RegleCondition => ({ questionId: 1, operateur, valeur });
const verifie = (regle: RegleCondition, reponse: ValeurReponse | undefined) => regleVerifiee(regle, reponse);

describe('Conditions d’affichage : évaluateur (copie d’EvaluateurConditions)', () => {
  describe('chaque opérateur', () => {
    it('REPONDUE / NON_REPONDUE', () => {
      expect(verifie(r('REPONDUE'), 'oui')).toBe(true);
      expect(verifie(r('REPONDUE'), undefined)).toBe(false);
      expect(verifie(r('NON_REPONDUE'), undefined)).toBe(true);
      expect(verifie(r('NON_REPONDUE'), false)).toBe(false);
    });

    it('EGAL : option, booléen, nombre, date ; types différents : faux', () => {
      expect(verifie(r('EGAL', 'kayes'), 'kayes')).toBe(true);
      expect(verifie(r('EGAL', 'kayes'), 'segou')).toBe(false);
      expect(verifie(r('EGAL', true), true)).toBe(true);
      expect(verifie(r('EGAL', true), false)).toBe(false);
      expect(verifie(r('EGAL', 'true'), true)).toBe(false);
      expect(verifie(r('EGAL', 4), 4)).toBe(true);
      expect(verifie(r('EGAL', 4), 4.0)).toBe(true);
      expect(verifie(r('EGAL', 4), '4')).toBe(false);
      expect(verifie(r('EGAL', '2026-03-05'), '2026-03-05')).toBe(true);
      expect(verifie(r('EGAL', '2026-03-05'), '2026-03-06')).toBe(false);
    });

    it('DIFFERENT : contraire de EGAL, mais faux sans réponse', () => {
      expect(verifie(r('DIFFERENT', true), false)).toBe(true);
      expect(verifie(r('DIFFERENT', true), true)).toBe(false);
      expect(verifie(r('DIFFERENT', true), undefined)).toBe(false);
      expect(verifie(r('DIFFERENT', 3), 5)).toBe(true);
    });

    it('PARMI : choix unique dans la liste ; choix multiple : au moins une option cochée', () => {
      expect(verifie(r('PARMI', ['a', 'b']), 'b')).toBe(true);
      expect(verifie(r('PARMI', ['a', 'b']), 'c')).toBe(false);
      expect(verifie(r('PARMI', ['a', 'b']), ['c', 'a'])).toBe(true);
      expect(verifie(r('PARMI', ['a', 'b']), ['c'])).toBe(false);
      expect(verifie(r('PARMI', 'a'), 'a')).toBe(false);
    });

    it('CONTIENT : l’option est cochée', () => {
      expect(verifie(r('CONTIENT', 'radio'), ['tele', 'radio'])).toBe(true);
      expect(verifie(r('CONTIENT', 'radio'), ['tele'])).toBe(false);
      expect(verifie(r('CONTIENT', 'radio'), 'radio')).toBe(false);
    });

    it('SUPERIEUR / INFERIEUR stricts, nombres et dates ; incomparables : faux', () => {
      expect(verifie(r('SUPERIEUR', 18), 19)).toBe(true);
      expect(verifie(r('SUPERIEUR', 18), 18)).toBe(false);
      expect(verifie(r('INFERIEUR', 18), 17.5)).toBe(true);
      expect(verifie(r('INFERIEUR', 18), 18)).toBe(false);
      expect(verifie(r('SUPERIEUR', '2026-01-31'), '2026-02-01')).toBe(true);
      expect(verifie(r('INFERIEUR', '2026-01-31'), '2026-02-01')).toBe(false);
      expect(verifie(r('SUPERIEUR', 18), 'abc')).toBe(false);
      expect(verifie(r('INFERIEUR', 18), 'abc')).toBe(false);
      expect(verifie(r('SUPERIEUR', '2026-02-30'), '2026-03-01')).toBe(false);
    });

    it('ENTRE : bornes comprises ; bornes mal formées : faux', () => {
      expect(verifie(r('ENTRE', [1, 3]), 1)).toBe(true);
      expect(verifie(r('ENTRE', [1, 3]), 3)).toBe(true);
      expect(verifie(r('ENTRE', [1, 3]), 4)).toBe(false);
      expect(verifie(r('ENTRE', ['2026-01-01', '2026-12-31']), '2026-06-15')).toBe(true);
      expect(verifie(r('ENTRE', ['2026-01-01', '2026-12-31']), '2027-01-01')).toBe(false);
      expect(verifie(r('ENTRE', [1]), 1)).toBe(false);
      expect(verifie(r('ENTRE', 2), 2)).toBe(false);
    });

    it('sans réponse : seule NON_REPONDUE est vraie', () => {
      for (const operateur of ['EGAL', 'DIFFERENT', 'PARMI', 'CONTIENT', 'SUPERIEUR', 'INFERIEUR', 'ENTRE', 'REPONDUE'] as const) {
        expect(verifie(r(operateur, operateur === 'ENTRE' ? [1, 2] : 1), undefined)).toBe(false);
      }
    });
  });

  it('ET : toutes les règles ; OU : au moins une ; condition absente ou vide : vraie', () => {
    const retenues = new Map<number, ValeurReponse>([
      [1, true],
      [2, 30],
    ]);
    const regles: RegleCondition[] = [
      { questionId: 1, operateur: 'EGAL', valeur: true },
      { questionId: 2, operateur: 'SUPERIEUR', valeur: 40 },
    ];
    expect(conditionVerifiee({ combinaison: 'ET', regles }, retenues)).toBe(false);
    expect(conditionVerifiee({ combinaison: 'OU', regles }, retenues)).toBe(true);
    expect(conditionVerifiee({ combinaison: 'OU', regles: [regles[1]] }, retenues)).toBe(false);
    expect(conditionVerifiee(null, retenues)).toBe(true);
    expect(conditionVerifiee({ combinaison: 'ET', regles: [] }, retenues)).toBe(true);
  });

  describe('parcours du formulaire', () => {
    const si = (questionId: number, operateur: OperateurCondition, valeur?: RegleCondition['valeur']): ConditionAffichage => ({
      combinaison: 'ET',
      regles: [{ questionId, operateur, valeur }],
    });

    // Q1 enfants ? -> Q2 combien (si Q1 = oui) -> Q3 âges (si Q2 > 1) ; section 20 si Q1 = oui ; Q5 si Q4 non répondue.
    const SECTIONS: SectionAffichee[] = [
      sectionDeTest({
        id: 10,
        questions: [
          questionDeTest({ id: 1, type: 'OUI_NON', options: [] }),
          questionDeTest({ id: 2, type: 'NUMERIQUE', options: [], condition: si(1, 'EGAL', true) }),
          questionDeTest({ id: 3, type: 'TEXTE_COURT', options: [], condition: si(2, 'SUPERIEUR', 1) }),
        ],
      }),
      sectionDeTest({
        id: 20,
        condition: si(1, 'EGAL', true),
        questions: [questionDeTest({ id: 4, type: 'TEXTE_COURT', options: [] })],
      }),
      sectionDeTest({
        id: 30,
        questions: [questionDeTest({ id: 5, type: 'TEXTE_COURT', options: [], condition: si(4, 'NON_REPONDUE') })],
      }),
    ];
    const visibles = (reponses: Record<number, ValeurReponse>) => {
      const v = evaluerVisibilite(SECTIONS, (id) => reponses[id]);
      return { sections: [...v.sections], questions: [...v.questions] };
    };

    it('condition de section : masquée, toutes ses questions le sont', () => {
      expect(visibles({ 1: false })).toEqual({ sections: [10, 30], questions: [1, 5] });
      expect(visibles({ 1: true })).toEqual({ sections: [10, 20, 30], questions: [1, 2, 4, 5] });
    });

    it('chaîne : une source masquée compte comme non répondue, même avec une réponse gardée', () => {
      expect(visibles({ 1: true, 2: 3, 4: 'x' }).questions).toEqual([1, 2, 3, 4]);
      // Q1 passe à « Non » : Q2 masquée, sa réponse (3) ignorée -> Q3 masquée ; section 20 masquée -> Q4 « non répondue ».
      expect(visibles({ 1: false, 2: 3, 4: 'x' }).questions).toEqual([1, 5]);
    });

    it('réponse vide (texte blanc, liste vide) : non répondue', () => {
      expect(visibles({ 1: true, 4: '   ' }).questions).toContain(5);
      expect(visibles({ 1: true, 4: 'x' }).questions).not.toContain(5);
    });
  });
});
