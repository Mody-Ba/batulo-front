import { AbstractControl, FormControl, FormGroup, ValidationErrors, ValidatorFn } from '@angular/forms';
import {
  ConfigurationDate,
  ConfigurationEchelle,
  ConfigurationMatrice,
  ConfigurationNumerique,
  ConfigurationTexte,
  QuestionAffichee,
  SectionAffichee,
} from '../../core/models/sondage.model';
import { formaterNombre, localeIntl, traduire, traduirePluriel } from '../../core/i18n/traduire';

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
export function cleReponse(question: Pick<QuestionAffichee, 'id'>): string {
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
export function validateursReponse(question: QuestionAffichee): ValidatorFn[] {
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
export function creerFormulaireReponses(sections: readonly SectionAffichee[]): FormulaireReponses {
  const controles: Record<string, FormControl<ValeurReponse>> = {};
  for (const question of sections.flatMap((s) => s.questions)) {
    controles[cleReponse(question)] = new FormControl<ValeurReponse>(null, validateursReponse(question));
  }
  return new FormGroup(controles);
}

/** Réponses à envoyer : les questions répondues seulement, textes nettoyés. */
export function reponsesAEnvoyer(
  sections: readonly SectionAffichee[],
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
    return traduire('public.reponses.obligatoire');
  }
  if (e['longueurMax']) {
    return traduirePluriel('public.reponses.longueurMax', e['longueurMax'].max);
  }
  if (e['nombre']) {
    return traduire('public.reponses.nombre');
  }
  if (e['decimales']) {
    const max = e['decimales'].max;
    return max === 0 ? traduire('public.reponses.entier') : traduirePluriel('public.reponses.decimales', max);
  }
  if (e['bornes']) {
    const { min, max } = e['bornes'];
    if (min !== null && max !== null) {
      return traduire('public.reponses.entre', { min: formaterNombre(min), max: formaterNombre(max) });
    }
    return min !== null
      ? traduire('public.reponses.auMoins', { min: formaterNombre(min) })
      : traduire('public.reponses.auPlus', { max: formaterNombre(max) });
  }
  if (e['dateMin']) {
    return traduire('public.reponses.dateMin', { date: formaterDate(e['dateMin'].date) });
  }
  if (e['dateMax']) {
    return traduire('public.reponses.dateMax', { date: formaterDate(e['dateMax'].date) });
  }
  if (e['matriceIncomplete']) {
    return traduire('public.reponses.matrice');
  }
  if (e['serveur']) {
    // Refus du serveur (REPONSES_INVALIDES) : son message, en français (le serveur n'envoie pas de code par question).
    return String(e['serveur']);
  }
  return null;
}

/** « 2026-03-05 » -> « 5 mars 2026 » (« March 5, 2026 » en anglais), dans la langue courante. */
export function formaterDate(iso: string): string {
  const [annee, mois, jour] = iso.split('-').map(Number);
  return new Date(annee, mois - 1, jour).toLocaleDateString(localeIntl(), { day: 'numeric', month: 'long', year: 'numeric' });
}
