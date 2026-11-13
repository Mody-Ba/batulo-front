import { FormArray } from '@angular/forms';
import { QuestionResponse, TypeQuestion } from '../../../../core/models/sondage.model';
import { messageErreurListe } from '../../../../core/utils/regles-question';
import {
  appliquerReponse,
  changerType,
  creerControleOption,
  creerControleTexte,
  creerFormulaireQuestion,
  FormulaireQuestion,
  optionsPerdues,
  requeteQuestion,
} from './formulaires-types';

function question(modifs: Partial<QuestionResponse> = {}): QuestionResponse {
  return {
    id: 5,
    libelle: 'Votre âge ?',
    aide: null,
    type: 'NUMERIQUE',
    obligatoire: true,
    ordre: 1,
    configuration: { min: 18, max: 99, decimales: 0 },
    options: [],
    estCritere: false,
    critereConfig: null,
    ...modifs,
  };
}

/** Formulaire d'une nouvelle question passée au type donné, libellé rempli. */
function nouvelle(type: TypeQuestion): FormulaireQuestion {
  const formulaire = creerFormulaireQuestion(null);
  formulaire.controls.libelle.setValue('Question');
  changerType(formulaire, type);
  return formulaire;
}

describe('Formulaires des questions (règles du backend)', () => {
  it('nouvelle question : choix unique avec deux options, invalide tant que le libellé est vide', () => {
    const formulaire = creerFormulaireQuestion(null);
    expect(formulaire.controls.type.value).toBe('CHOIX_UNIQUE');
    expect(formulaire.controls.options.length).toBe(2);
    expect(formulaire.valid).toBe(false);
    formulaire.controls.libelle.setValue('   ');
    expect(formulaire.controls.libelle.hasError('required')).toBe(true);
    formulaire.controls.libelle.setValue('Votre secteur');
    expect(formulaire.valid).toBe(true);
  });

  it('requête de chacun des 10 types : seulement les clés acceptées par le backend', () => {
    const attendu: Record<TypeQuestion, unknown> = {
      CHOIX_UNIQUE: {},
      CHOIX_MULTIPLE: {},
      CLASSEMENT: {},
      OUI_NON: {},
      TEXTE_COURT: { longueurMax: 255 },
      TEXTE_LONG: { longueurMax: 2000 },
      ECHELLE: { min: 1, max: 5 },
      NUMERIQUE: { decimales: 0 },
      DATE: {},
      MATRICE: { lignes: ['Ligne 1'], colonnes: ['Colonne 1', 'Colonne 2'] },
    };
    for (const [type, configuration] of Object.entries(attendu) as [TypeQuestion, unknown][]) {
      const formulaire = nouvelle(type);
      expect(formulaire.valid, type).toBe(true);
      const requete = requeteQuestion(formulaire);
      expect(requete.type).toBe(type);
      expect(requete.configuration, type).toEqual(configuration);
      const avecOptions = ['CHOIX_UNIQUE', 'CHOIX_MULTIPLE', 'CLASSEMENT'].includes(type);
      expect(requete.options.length, type).toBe(avecOptions ? 2 : 0);
    }
  });

  it('libellé et aide nettoyés ; aide vide envoyée comme null ; option : id et valeur seulement si connus', () => {
    const formulaire = nouvelle('CHOIX_UNIQUE');
    formulaire.patchValue({ libelle: '  Secteur  ', aide: '   ' });
    formulaire.controls.options.at(0).patchValue({ id: 12, libelle: ' Agriculture ', valeur: 'agri' });
    const requete = requeteQuestion(formulaire);
    expect(requete.libelle).toBe('Secteur');
    expect(requete.aide).toBeNull();
    expect(requete.options).toEqual([{ id: 12, libelle: 'Agriculture', valeur: 'agri' }, { libelle: 'Option 2' }]);
  });

  it('options : au moins 2, valeurs uniques', () => {
    const formulaire = nouvelle('CHOIX_MULTIPLE');
    const options = formulaire.controls.options;
    options.removeAt(1);
    expect(messageErreurListe(options, 'options')).toBe('Ajoutez au moins 2 options.');
    options.push(creerControleOption({ libelle: 'B', valeur: 'x' }));
    options.at(0).controls.valeur.setValue('x');
    expect(messageErreurListe(options, 'options')).toBe('La valeur « x » est utilisée par deux options.');
    options.at(0).controls.valeur.setValue('y');
    expect(options.valid).toBe(true);
  });

  it('texte court : longueur maximale entière de 1 à 255 ; texte long jusqu’à 5000', () => {
    const court = nouvelle('TEXTE_COURT').controls.configuration.controls['longueurMax'];
    for (const [valeur, valide] of [[0, false], [256, false], [12.5, false], [null, false], [255, true]] as const) {
      court.setValue(valeur);
      expect(court.valid, String(valeur)).toBe(valide);
    }
    const long = nouvelle('TEXTE_LONG').controls.configuration.controls['longueurMax'];
    long.setValue(5000);
    expect(long.valid).toBe(true);
    long.setValue(5001);
    expect(long.valid).toBe(false);
  });

  it('échelle : 1 à 5 ou 1 à 10, libellés des extrêmes facultatifs (vides : absents)', () => {
    const formulaire = nouvelle('ECHELLE');
    formulaire.controls.configuration.patchValue({ max: 10, libelleMin: ' Pas du tout ', libelleMax: '' });
    expect(requeteQuestion(formulaire).configuration).toEqual({ min: 1, max: 10, libelleMin: 'Pas du tout' });
  });

  it('numérique : min ≤ max, décimales de 0 à 4', () => {
    const formulaire = nouvelle('NUMERIQUE');
    const configuration = formulaire.controls.configuration;
    configuration.patchValue({ min: 10, max: 5 });
    expect(configuration.hasError('bornesInversees')).toBe(true);
    configuration.patchValue({ max: 10, decimales: 5 });
    expect(configuration.valid).toBe(false);
    configuration.patchValue({ decimales: 2 });
    expect(configuration.valid).toBe(true);
    expect(requeteQuestion(formulaire).configuration).toEqual({ min: 10, max: 10, decimales: 2 });
  });

  it('date : bornes facultatives, la première avant ou égale à la seconde', () => {
    const formulaire = nouvelle('DATE');
    const configuration = formulaire.controls.configuration;
    configuration.patchValue({ dateMin: '2026-12-31', dateMax: '2026-01-01' });
    expect(configuration.hasError('bornesInversees')).toBe(true);
    configuration.patchValue({ dateMin: '2026-01-01', dateMax: '' });
    expect(configuration.valid).toBe(true);
    expect(requeteQuestion(formulaire).configuration).toEqual({ dateMin: '2026-01-01' });
  });

  it('matrice : 1 à 30 lignes, 2 à 10 colonnes, textes non vides et sans doublon (majuscules ignorées)', () => {
    const configuration = nouvelle('MATRICE').controls.configuration;
    const colonnes = configuration.controls['colonnes'] as FormArray;
    colonnes.removeAt(1);
    expect(messageErreurListe(colonnes, 'colonnes')).toBe('De 2 à 10 colonnes.');
    colonnes.push(creerControleTexte('colonne 1'));
    expect(messageErreurListe(colonnes, 'colonnes')).toBe('« colonne 1 » apparaît deux fois.');
    colonnes.at(1).setValue('Colonne 2');
    expect(colonnes.valid).toBe(true);
    (configuration.controls['lignes'] as FormArray).at(0).setValue(' ');
    expect(configuration.valid).toBe(false);
  });

  it('changer de type : options gardées entre types à options, retirées sinon (avec avertissement)', () => {
    const formulaire = nouvelle('CHOIX_UNIQUE');
    formulaire.controls.options.at(0).controls.libelle.setValue('Agriculture');
    expect(optionsPerdues(formulaire, 'CLASSEMENT')).toBe(false);
    changerType(formulaire, 'CLASSEMENT');
    expect(formulaire.controls.options.at(0).controls.libelle.value).toBe('Agriculture');

    expect(optionsPerdues(formulaire, 'NUMERIQUE')).toBe(true);
    changerType(formulaire, 'NUMERIQUE');
    expect(formulaire.controls.options.length).toBe(0);
    expect(formulaire.valid).toBe(true);

    changerType(formulaire, 'CHOIX_MULTIPLE');
    expect(formulaire.controls.options.length).toBe(2);
  });

  it('question enregistrée : formulaire repris tel quel, requête identique à ce qui est enregistré', () => {
    const formulaire = creerFormulaireQuestion(question({ aide: 'En années' }));
    expect(requeteQuestion(formulaire)).toEqual({
      libelle: 'Votre âge ?',
      aide: 'En années',
      type: 'NUMERIQUE',
      obligatoire: true,
      configuration: { min: 18, max: 99, decimales: 0 },
      options: [],
    });
  });

  it('après la création : ids et valeurs générées reportés dans les options, sans toucher au reste', () => {
    const formulaire = nouvelle('CHOIX_UNIQUE');
    formulaire.controls.options.at(0).controls.libelle.setValue('Maïs');
    appliquerReponse(
      formulaire,
      question({
        type: 'CHOIX_UNIQUE',
        configuration: {},
        options: [
          { id: 31, libelle: 'Maïs', valeur: 'mais', ordre: 1 },
          { id: 32, libelle: 'Option 2', valeur: 'option_2', ordre: 2 },
        ],
      }),
    );
    expect(requeteQuestion(formulaire).options).toEqual([
      { id: 31, libelle: 'Maïs', valeur: 'mais' },
      { id: 32, libelle: 'Option 2', valeur: 'option_2' },
    ]);
  });
});
