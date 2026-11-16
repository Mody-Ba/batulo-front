import {
  ConditionAffichage,
  RegleCondition,
  SectionAffichee,
  ValeurCondition,
} from '../../core/models/sondage.model';
import { reponseVide, ValeurReponse } from './reponses';

/**
 * Seul évaluateur des conditions d'affichage côté front (aperçu, formulaire public, éditeur) : copie fidèle
 * d'EvaluateurConditions du backend, qui recalcule de toute façon la visibilité à l'envoi.
 *
 * - Les questions se parcourent dans l'ordre du formulaire : toute source est placée avant sa cible, sa visibilité et
 *   sa réponse sont donc connues. Une source masquée compte comme non répondue (sa réponse est ignorée).
 * - Une section masquée masque toutes ses questions.
 * - Sans réponse, une règle n'est vraie que pour NON_REPONDUE (DIFFERENT compris : « différent de Oui » suppose une
 *   réponse). Comparaisons sur des nombres (NUMERIQUE, ECHELLE) ou des dates ISO « AAAA-MM-JJ » (DATE) ; deux valeurs
 *   qui ne se comparent pas (types différents, texte qui n'est pas une date) rendent la règle fausse.
 */

/** Ids des sections et des questions affichées. */
export interface Visibilite {
  sections: ReadonlySet<number>;
  questions: ReadonlySet<number>;
}

/**
 * Visibilité de tout le formulaire pour des réponses données (par questionId). Une réponse vide (null, texte blanc,
 * liste ou objet vides) compte comme « pas de réponse », comme côté serveur où elle n'est pas envoyée.
 */
export function evaluerVisibilite(
  sections: readonly SectionAffichee[],
  reponseDe: (questionId: number) => ValeurReponse | undefined,
): Visibilite {
  const retenues = new Map<number, ValeurReponse>();
  const sectionsVisibles = new Set<number>();
  const questionsVisibles = new Set<number>();
  for (const section of sections) {
    if (!conditionVerifiee(section.condition, retenues)) {
      continue;
    }
    sectionsVisibles.add(section.id);
    for (const question of section.questions) {
      if (!conditionVerifiee(question.condition, retenues)) {
        continue;
      }
      questionsVisibles.add(question.id);
      const valeur = reponseDe(question.id);
      if (!reponseVide(valeur)) {
        retenues.set(question.id, typeof valeur === 'string' ? valeur.trim() : (valeur as ValeurReponse));
      }
    }
  }
  return { sections: sectionsVisibles, questions: questionsVisibles };
}

/** Condition absente ou vérifiée (ET : toutes les règles ; OU : au moins une). */
export function conditionVerifiee(
  condition: ConditionAffichage | null | undefined,
  retenues: ReadonlyMap<number, ValeurReponse>,
): boolean {
  if (!condition || condition.regles.length === 0) {
    return true;
  }
  const et = condition.combinaison !== 'OU';
  for (const regle of condition.regles) {
    const vraie = regleVerifiee(regle, retenues.get(regle.questionId));
    if (et && !vraie) {
      return false;
    }
    if (!et && vraie) {
      return true;
    }
  }
  return et;
}

/** @param reponse réponse retenue de la source ; absente si elle n'est pas répondue ou masquée */
export function regleVerifiee(regle: RegleCondition, reponse: ValeurReponse | undefined): boolean {
  const repondue = reponse !== undefined && reponse !== null;
  const valeur = regle.valeur ?? null;
  switch (regle.operateur) {
    case 'REPONDUE':
      return repondue;
    case 'NON_REPONDUE':
      return !repondue;
    case 'EGAL':
      return repondue && valeur !== null && egal(reponse, valeur);
    case 'DIFFERENT':
      return repondue && valeur !== null && !egal(reponse, valeur);
    case 'PARMI':
      return repondue && valeur !== null && parmi(reponse, valeur);
    case 'CONTIENT':
      return repondue && valeur !== null && contient(reponse, valeur);
    case 'SUPERIEUR':
      return repondue && valeur !== null && (comparer(reponse, valeur) ?? 0) > 0;
    case 'INFERIEUR':
      return repondue && valeur !== null && (comparer(reponse, valeur) ?? 0) < 0;
    case 'ENTRE':
      return repondue && valeur !== null && entre(reponse, valeur);
  }
}

type Valeur = ValeurReponse | ValeurCondition;

/** [min, max], bornes comprises. */
function entre(reponse: Valeur, bornes: Valeur): boolean {
  if (!Array.isArray(bornes) || bornes.length !== 2) {
    return false;
  }
  const min = comparer(reponse, bornes[0]);
  const max = comparer(reponse, bornes[1]);
  return min !== null && max !== null && min >= 0 && max <= 0;
}

function egal(reponse: Valeur, valeur: Valeur): boolean {
  if (typeof reponse === 'boolean' || typeof valeur === 'boolean') {
    return typeof reponse === 'boolean' && typeof valeur === 'boolean' && reponse === valeur;
  }
  if (typeof reponse === 'number' || typeof valeur === 'number') {
    return comparer(reponse, valeur) === 0;
  }
  if (typeof reponse === 'string' && typeof valeur === 'string') {
    const a = dateIso(reponse);
    const b = dateIso(valeur);
    return a !== null && b !== null ? a === b : reponse === valeur;
  }
  return false;
}

/** CHOIX_UNIQUE : l'option choisie est dans la liste ; CHOIX_MULTIPLE : l'une des options cochées y est. */
function parmi(reponse: Valeur, valeurs: Valeur): boolean {
  if (Array.isArray(reponse)) {
    return reponse.some((choisie) => contient(valeurs, choisie));
  }
  return contient(valeurs, reponse);
}

function contient(liste: Valeur, valeur: unknown): boolean {
  if (!Array.isArray(liste) || typeof valeur !== 'string') {
    return false;
  }
  return liste.some((element) => typeof element === 'string' && element === valeur);
}

/** Signe de la comparaison de deux nombres ou de deux dates ISO ; null s'ils ne se comparent pas. */
function comparer(reponse: unknown, valeur: unknown): number | null {
  if (typeof reponse === 'number' && typeof valeur === 'number') {
    return Math.sign(reponse - valeur);
  }
  const a = typeof reponse === 'string' ? dateIso(reponse) : null;
  const b = typeof valeur === 'string' ? dateIso(valeur) : null;
  return a !== null && b !== null ? Math.sign(a - b) : null;
}

/** « AAAA-MM-JJ » valide (comme LocalDate.parse) -> jours depuis l'époque ; sinon null. */
function dateIso(texte: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texte);
  if (!m) {
    return null;
  }
  const [annee, mois, jour] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(annee, mois - 1, jour));
  if (date.getUTCFullYear() !== annee || date.getUTCMonth() !== mois - 1 || date.getUTCDate() !== jour) {
    return null;
  }
  return date.getTime() / 86_400_000;
}
