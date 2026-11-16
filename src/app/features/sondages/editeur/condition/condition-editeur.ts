import {
  ConditionAffichage,
  libelleOperateur,
  QuestionResponse,
  RegleCondition,
  SectionResponse,
  SondageResponse,
  ValeurCondition,
} from '../../../../core/models/sondage.model';
import { formaterDate } from '../../../../shared/formulaire/reponses';

/** Question ou section qui reçoit une condition d'affichage. */
export type CibleCondition = { type: 'question'; questionId: number } | { type: 'section'; sectionId: number };

/** Question source proposée, avec sa section (groupes du sélecteur). */
export interface SourceCondition {
  question: QuestionResponse;
  section: SectionResponse;
  /** Rang de la section (1, 2…). */
  numeroSection: number;
  /** Rang de la question dans sa section (1, 2…), comme sur les cartes de l'éditeur. */
  numero: number;
}

/**
 * Sources permises (comme ValidateurConditions) : pour une question, les questions enregistrées placées AVANT elle
 * (sections précédentes, ou plus haut dans sa section) ; pour une section, les questions des sections précédentes.
 * Toute source étant avant sa cible, aucun cycle n'est possible.
 */
export function sourcesPossibles(sondage: SondageResponse, cible: CibleCondition): SourceCondition[] {
  const sources: SourceCondition[] = [];
  for (const [indexSection, section] of sondage.sections.entries()) {
    if (cible.type === 'section' && section.id === cible.sectionId) {
      return sources;
    }
    for (const [index, question] of section.questions.entries()) {
      if (cible.type === 'question' && question.id === cible.questionId) {
        return sources;
      }
      sources.push({ question, section, numeroSection: indexSection + 1, numero: index + 1 });
    }
  }
  return sources;
}

/** Valeur d'une règle telle que lue par l'auteur : libellé de l'option, Oui / Non, date en clair, nombre fr-CA. */
export function valeurEnClair(valeur: ValeurCondition | null | undefined, source: QuestionResponse | undefined): string {
  if (valeur === null || valeur === undefined) {
    return '';
  }
  if (Array.isArray(valeur)) {
    return valeur.map((v) => valeurEnClair(v, source)).join(', ');
  }
  if (typeof valeur === 'boolean') {
    return valeur ? 'Oui' : 'Non';
  }
  if (typeof valeur === 'number') {
    return valeur.toLocaleString('fr-CA');
  }
  if (source?.type === 'DATE' && /^\d{4}-\d{2}-\d{2}$/.test(valeur)) {
    return formaterDate(valeur);
  }
  return source?.options.find((o) => o.valeur === valeur)?.libelle ?? valeur;
}

/** « Avez-vous des enfants ? = Oui », « Âge entre 18 et 25 », « Canaux contient au moins une de : Radio, Télé ». */
export function regleEnClair(regle: RegleCondition, sondage: SondageResponse | null): string {
  const source = sondage?.sections.flatMap((s) => s.questions).find((q) => q.id === regle.questionId);
  const libelle = source?.libelle.trim() || 'Question introuvable';
  const type = source?.type ?? 'TEXTE_COURT';
  const valeur = regle.valeur;
  switch (regle.operateur) {
    case 'REPONDUE':
    case 'NON_REPONDUE':
      return `${libelle} ${libelleOperateur(regle.operateur, type)}`;
    case 'ENTRE': {
      const [min, max] = Array.isArray(valeur) ? valeur : [];
      return `${libelle} entre ${valeurEnClair(min, source)} et ${valeurEnClair(max, source)}`;
    }
    case 'PARMI':
      return `${libelle} ${libelleOperateur('PARMI', type)} : ${valeurEnClair(valeur, source)}`;
    case 'CONTIENT':
      return `${libelle} contient ${valeurEnClair(valeur, source)}`;
    default: {
      const symbole =
        type === 'DATE'
          ? libelleOperateur(regle.operateur, type)
          : { EGAL: '=', DIFFERENT: '≠', SUPERIEUR: '>', INFERIEUR: '<' }[regle.operateur];
      return `${libelle} ${symbole} ${valeurEnClair(valeur, source)}`;
    }
  }
}

/** Résumé d'une condition : règles reliées par « et » (ET) ou « ou » (OU). */
export function resumeCondition(condition: ConditionAffichage, sondage: SondageResponse | null): string {
  const lien = condition.combinaison === 'OU' ? ' ou ' : ' et ';
  return condition.regles.map((regle) => regleEnClair(regle, sondage)).join(lien);
}
