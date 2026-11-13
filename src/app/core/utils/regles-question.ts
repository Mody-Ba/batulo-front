import { AbstractControl, FormArray, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Règles du backend pour le contenu d'un sondage (ValidateurQuestion, SondageServiceImpl, records *Request),
 * vérifiées avant l'envoi. Le backend reste la référence : ses erreurs sont affichées sur la question envoyée.
 */
export const REGLES_SONDAGE = {
  titreMax: 200,
  descriptionMax: 5000,
  sectionsMax: 50,
  titreSectionMax: 200,
  questionsMaxParSection: 100,
  libelleQuestionMax: 500,
  aideMax: 500,
  optionsMin: 2,
  libelleOptionMax: 200,
  valeurOptionMax: 100,
  texteCourtMax: 255,
  texteLongMax: 5000,
  texteLongDefaut: 2000,
  decimalesMax: 4,
  /** Libellés d'échelle, lignes et colonnes de matrice. */
  libelleConfigMax: 200,
  matriceLignesMax: 30,
  matriceColonnesMin: 2,
  matriceColonnesMax: 10,
} as const;

/** Nombre entier (ou vide : la présence est vérifiée par Validators.required). Erreur « entier ». */
export const entier: ValidatorFn = (controle: AbstractControl): ValidationErrors | null => {
  const valeur = controle.value;
  return valeur === null || valeur === '' || Number.isInteger(valeur) ? null : { entier: true };
};

/**
 * Bornes d'un groupe : `min` ≤ `max` quand les deux sont renseignés. Erreur « bornesInversees » sur le groupe.
 * Fonctionne pour des nombres et pour des dates AAAA-MM-JJ (ordre lexicographique).
 */
export function bornesOrdonnees(cleMin: string, cleMax: string): ValidatorFn {
  return (groupe: AbstractControl): ValidationErrors | null => {
    const min = groupe.get(cleMin)?.value;
    const max = groupe.get(cleMax)?.value;
    const vide = (v: unknown) => v === null || v === undefined || v === '';
    return !vide(min) && !vide(max) && min > max ? { bornesInversees: true } : null;
  };
}

/**
 * Liste de textes (lignes ou colonnes d'une matrice) : de `min` à `max` éléments, sans doublon (sans tenir compte
 * des majuscules, comme le backend). Les textes vides sont signalés par chaque champ (required).
 * Erreurs : « nombreElements » { min, max, actuel }, « doublon » { texte }.
 */
export function listeTextes(min: number, max: number): ValidatorFn {
  return (controle: AbstractControl): ValidationErrors | null => {
    const textes = (controle as FormArray).controls.map((c) => String(c.value ?? '').trim());
    if (textes.length < min || textes.length > max) {
      return { nombreElements: { min, max, actuel: textes.length } };
    }
    const vus = new Set<string>();
    for (const texte of textes) {
      const cle = texte.toLowerCase();
      if (texte && vus.has(cle)) {
        return { doublon: { texte } };
      }
      vus.add(cle);
    }
    return null;
  };
}

/**
 * Options d'une question : au moins `min` (si la question en a), valeurs saisies uniques (comme le backend,
 * sensible aux majuscules). Erreurs : « optionsMin » { min }, « valeurEnDouble » { valeur }.
 */
export function optionsValides(min: () => number): ValidatorFn {
  return (controle: AbstractControl): ValidationErrors | null => {
    const options = (controle as FormArray).controls;
    const minimum = min();
    if (options.length < minimum) {
      return { optionsMin: { min: minimum } };
    }
    const vues = new Set<string>();
    for (const option of options) {
      const valeur = String(option.get('valeur')?.value ?? '').trim();
      if (valeur) {
        if (vues.has(valeur)) {
          return { valeurEnDouble: { valeur } };
        }
        vues.add(valeur);
      }
    }
    return null;
  };
}

/** Message d'une erreur de liste (options, lignes ou colonnes), ou null. */
export function messageErreurListe(controle: AbstractControl, element: string): string | null {
  const erreurs = controle.errors;
  if (!erreurs) {
    return null;
  }
  if (erreurs['optionsMin']) {
    return `Ajoutez au moins ${erreurs['optionsMin'].min} options.`;
  }
  if (erreurs['valeurEnDouble']) {
    return `La valeur « ${erreurs['valeurEnDouble'].valeur} » est utilisée par deux options.`;
  }
  if (erreurs['nombreElements']) {
    const { min, max } = erreurs['nombreElements'];
    return `De ${min} à ${max} ${element}.`;
  }
  if (erreurs['doublon']) {
    return `« ${erreurs['doublon'].texte} » apparaît deux fois.`;
  }
  return null;
}
