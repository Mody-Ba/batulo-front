import { AbstractControl, FormControl, FormGroup, ValidationErrors, ValidatorFn } from '@angular/forms';
import {
  ConfigurationDate,
  ConfigurationEchelle,
  ConfigurationMatrice,
  ConfigurationNumerique,
  ConfigurationTexte,
  QuestionResponse,
  SectionResponse,
} from '../../core/models/sondage.model';

/**
 * Réponses d'un répondant (aperçu F5b, formulaire public F6), mêmes règles que ValidateurReponse du backend.
 * Valeur d'une réponse selon le type : CHOIX_UNIQUE "valeur" ; CHOIX_MULTIPLE et CLASSEMENT ["valeur", ...] ;
 * OUI_NON true/false ; ECHELLE et NUMERIQUE un nombre ; TEXTE_* un texte ; DATE "AAAA-MM-JJ" ;
 * MATRICE { ligne: colonne }. null (ou vide) : pas de réponse.
 */
export type ValeurReponse = string | string[] | boolean | number | Record<string, string> | null;

export type FormulaireReponses = FormGroup<Record<string, FormControl<ValeurReponse>>>;

/** Une réponse à envoyer (ReponseQuestionRequest du backend). */
export interface ReponseQuestionRequest {
  questionId: number;
  valeur: ValeurReponse;
}

/** Nom du contrôle d'une question dans le formulaire des réponses. */
export function cleReponse(question: Pick<QuestionResponse, 'id'>): string {
  return `q${question.id}`;
}

/** Pas de réponse : null, texte vide, liste ou objet vides. */
export function reponseVide(valeur: unknown): boolean {
  if (valeur === null || valeur === undefined) {
    return true;
  }
  if (typeof valeur === 'string') {
    return valeur.trim() === '';
  }
  if (Array.isArray(valeur)) {
    return valeur.length === 0;
  }
  if (typeof valeur === 'object') {
    return Object.keys(valeur).length === 0;
  }
  return false;
}

const requise: ValidatorFn = (c) => (reponseVide(c.value) ? { requise: true } : null);

function longueurMax(max: number): ValidatorFn {
  return (c) => (typeof c.value === 'string' && c.value.length > max ? { longueurMax: { max } } : null);
}

function nombre(config: Partial<ConfigurationNumerique>): ValidatorFn {
  return (c: AbstractControl): ValidationErrors | null => {
    const valeur = c.value;
    if (valeur === null || valeur === '') {
      return null;
    }
    if (typeof valeur !== 'number' || !Number.isFinite(valeur)) {
      return { nombre: true };
    }
    const decimales = config.decimales ?? 0;
    const texte = String(valeur);
    const partieDecimale = texte.includes('.') ? texte.split('.')[1].length : 0;
    if (partieDecimale > decimales) {
      return { decimales: { max: decimales } };
    }
    if ((config.min !== undefined && valeur < config.min) || (config.max !== undefined && valeur > config.max)) {
      return { bornes: { min: config.min ?? null, max: config.max ?? null } };
    }
    return null;
  };
}

function date(config: Partial<ConfigurationDate>): ValidatorFn {
  return (c) => {
    const valeur = c.value;
    if (typeof valeur !== 'string' || valeur === '') {
      return null;
    }
    if (config.dateMin && valeur < config.dateMin) {
      return { dateMin: { date: config.dateMin } };
    }
    if (config.dateMax && valeur > config.dateMax) {
      return { dateMax: { date: config.dateMax } };
    }
    return null;
  };
}

/** Une grille commencée doit être complète : une colonne pour chaque ligne. */
function matriceComplete(config: Partial<ConfigurationMatrice>): ValidatorFn {
  return (c) => {
    const valeur = (c.value ?? {}) as Record<string, string>;
    if (reponseVide(valeur)) {
      return null;
    }
    const manquantes = (config.lignes ?? []).filter((ligne) => !valeur[ligne]);
    return manquantes.length ? { matriceIncomplete: { lignes: manquantes } } : null;
  };
}

/** Règles de saisie d'une question. */
export function validateursReponse(question: QuestionResponse): ValidatorFn[] {
  const validateurs: ValidatorFn[] = question.obligatoire ? [requise] : [];
  switch (question.type) {
    case 'TEXTE_COURT':
    case 'TEXTE_LONG': {
      const max = (question.configuration as Partial<ConfigurationTexte>).longueurMax;
      if (max) {
        validateurs.push(longueurMax(max));
      }
      break;
    }
    case 'NUMERIQUE':
      validateurs.push(nombre(question.configuration as Partial<ConfigurationNumerique>));
      break;
    case 'ECHELLE': {
      const c = question.configuration as Partial<ConfigurationEchelle>;
      validateurs.push(nombre({ min: c.min ?? 1, max: c.max ?? 5, decimales: 0 }));
      break;
    }
    case 'DATE':
      validateurs.push(date(question.configuration as Partial<ConfigurationDate>));
      break;
    case 'MATRICE':
      validateurs.push(matriceComplete(question.configuration as Partial<ConfigurationMatrice>));
      break;
  }
  return validateurs;
}

/** Un contrôle par question, sans réponse au départ. */
export function creerFormulaireReponses(sections: readonly SectionResponse[]): FormulaireReponses {
  const controles: Record<string, FormControl<ValeurReponse>> = {};
  for (const question of sections.flatMap((s) => s.questions)) {
    controles[cleReponse(question)] = new FormControl<ValeurReponse>(null, validateursReponse(question));
  }
  return new FormGroup(controles);
}

/** Réponses à envoyer : les questions répondues seulement, textes nettoyés. */
export function reponsesAEnvoyer(
  sections: readonly SectionResponse[],
  formulaire: FormulaireReponses,
): ReponseQuestionRequest[] {
  return sections
    .flatMap((s) => s.questions)
    .map((question) => {
      const valeur = formulaire.controls[cleReponse(question)]?.value ?? null;
      return { questionId: question.id, valeur: typeof valeur === 'string' ? valeur.trim() : valeur };
    })
    .filter((reponse) => !reponseVide(reponse.valeur));
}

/** Message de la première erreur d'une réponse, ou null. */
export function messageReponse(controle: AbstractControl): string | null {
  const e = controle.errors;
  if (!e) {
    return null;
  }
  if (e['requise']) {
    return 'Cette question est obligatoire.';
  }
  if (e['longueurMax']) {
    return `${e['longueurMax'].max} caractères au plus.`;
  }
  if (e['nombre']) {
    return 'La réponse doit être un nombre.';
  }
  if (e['decimales']) {
    const max = e['decimales'].max;
    return max === 0 ? 'La réponse doit être un nombre entier.' : `${max} décimale${max > 1 ? 's' : ''} au plus.`;
  }
  if (e['bornes']) {
    const { min, max } = e['bornes'];
    if (min !== null && max !== null) {
      return `La valeur doit être comprise entre ${min} et ${max}.`;
    }
    return min !== null ? `La valeur doit être au moins ${min}.` : `La valeur doit être au plus ${max}.`;
  }
  if (e['dateMin']) {
    return `La date doit être le ${formaterDate(e['dateMin'].date)} ou après.`;
  }
  if (e['dateMax']) {
    return `La date doit être le ${formaterDate(e['dateMax'].date)} ou avant.`;
  }
  if (e['matriceIncomplete']) {
    return 'Choisissez une réponse pour chaque ligne.';
  }
  return null;
}

/** « 2026-03-05 » -> « 5 mars 2026 ». */
export function formaterDate(iso: string): string {
  const [annee, mois, jour] = iso.split('-').map(Number);
  return new Date(annee, mois - 1, jour).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' });
}
