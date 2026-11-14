import { QuestionResponse } from '../../core/models/sondage.model';
import { questionDeTest, sectionDeTest } from '../../testing/donnees-test';
import { cleReponse, creerFormulaireReponses, messageReponse, reponsesAEnvoyer, reponseVide } from './reponses';

function controle(question: QuestionResponse) {
  return creerFormulaireReponses([sectionDeTest({ questions: [question] })]).controls[cleReponse(question)];
}

describe('Règles des réponses (ValidateurReponse du backend)', () => {
  it('réponse vide : null, texte d’espaces, liste ou objet vides', () => {
    expect([null, '  ', [], {}].every(reponseVide)).toBe(true);
    expect([false, 0, 'a', ['x'], { l: 'c' }].some(reponseVide)).toBe(false);
  });

  it('obligatoire : une réponse vide est refusée, « non » (false) est une réponse', () => {
    const c = controle(questionDeTest({ type: 'OUI_NON', obligatoire: true, options: [] }));
    expect(messageReponse(c)).toBe('Cette question est obligatoire.');
    c.setValue(false);
    expect(c.valid).toBe(true);
  });

  it('texte : longueur maximale de la question', () => {
    const c = controle(questionDeTest({ type: 'TEXTE_COURT', options: [], configuration: { longueurMax: 5 } }));
    c.setValue('123456');
    expect(messageReponse(c)).toBe('5 caractères au plus.');
  });

  it('numérique : bornes et décimales', () => {
    const c = controle(questionDeTest({ type: 'NUMERIQUE', options: [], configuration: { min: 18, max: 99, decimales: 1 } }));
    c.setValue(12);
    expect(messageReponse(c)).toBe('La valeur doit être comprise entre 18 et 99.');
    c.setValue(20.25);
    expect(messageReponse(c)).toBe('1 décimale au plus.');
    c.setValue(20.5);
    expect(c.valid).toBe(true);
    const entier = controle(questionDeTest({ type: 'NUMERIQUE', options: [], configuration: { decimales: 0 } }));
    entier.setValue(1.5);
    expect(messageReponse(entier)).toBe('La réponse doit être un nombre entier.');
  });

  it('échelle : note entière dans l’étendue', () => {
    const c = controle(questionDeTest({ type: 'ECHELLE', options: [], configuration: { min: 1, max: 5 } }));
    c.setValue(6);
    expect(c.invalid).toBe(true);
    c.setValue(5);
    expect(c.valid).toBe(true);
  });

  it('date : entre dateMin et dateMax', () => {
    const c = controle(
      questionDeTest({ type: 'DATE', options: [], configuration: { dateMin: '2026-01-01', dateMax: '2026-12-31' } }),
    );
    c.setValue('2025-12-31');
    expect(messageReponse(c)).toContain('ou après');
    c.setValue('2027-01-01');
    expect(messageReponse(c)).toContain('ou avant');
    c.setValue('2026-06-15');
    expect(c.valid).toBe(true);
  });

  it('matrice : une grille commencée doit être complète', () => {
    const c = controle(
      questionDeTest({ type: 'MATRICE', options: [], configuration: { lignes: ['Prix', 'Accueil'], colonnes: ['Bon', 'Mauvais'] } }),
    );
    expect(c.valid).toBe(true);
    c.setValue({ Prix: 'Bon' });
    expect(messageReponse(c)).toBe('Choisissez une réponse pour chaque ligne.');
    c.setValue({ Prix: 'Bon', Accueil: 'Mauvais' });
    expect(c.valid).toBe(true);
  });

  it('réponses à envoyer : questions répondues seulement, textes nettoyés', () => {
    const q1 = questionDeTest({ id: 1, type: 'TEXTE_COURT', options: [], configuration: { longueurMax: 255 } });
    const q2 = questionDeTest({ id: 2, type: 'OUI_NON', options: [] });
    const q3 = questionDeTest({ id: 3 });
    const sections = [sectionDeTest({ questions: [q1, q2, q3] })];
    const formulaire = creerFormulaireReponses(sections);
    formulaire.controls['q1'].setValue('  Dakar  ');
    formulaire.controls['q2'].setValue(false);
    expect(reponsesAEnvoyer(sections, formulaire)).toEqual([
      { questionId: 1, valeur: 'Dakar' },
      { questionId: 2, valeur: false },
    ]);
  });
});
