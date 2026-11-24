import { Langue } from '../i18n/langues';
import { libelles } from '../i18n/traduire';

/**
 * Langue du contenu d'un sondage (énumération Langue du backend, code en minuscules). Mêmes codes que les langues de
 * l'interface.
 */
export type LangueContenu = Langue;

export const LANGUES_CONTENU: readonly LangueContenu[] = ['fr', 'en', 'ar'];

/** Nom de chaque langue dans la langue de l'interface (« Anglais », « English », « الإنجليزية »). */
export const LIBELLES_LANGUE = libelles<LangueContenu>('langues', LANGUES_CONTENU);

/** Deux langues supplémentaires au plus (LanguesRequest). */
export const LANGUES_SUPPLEMENTAIRES_MAX = 2;

/** PUT /api/sondages/{id}/langues (brouillon) : changer la principale ne change que l'étiquette. */
export interface LanguesRequest {
  languePrincipale: LangueContenu;
  /** Sans la principale, sans doublon ; [] : aucune (400 LANGUE_INVALIDE sinon). */
  languesSupplementaires: LangueContenu[];
}

/** Texte non traduit (schéma TexteNonTraduit). */
export interface TexteNonTraduit {
  cle: string;
  /** Texte dans la langue principale. */
  source: string;
}

/** GET /api/sondages/{id}/traductions : une entrée par langue supplémentaire. */
export interface CompletudeLangueResponse {
  langue: LangueContenu;
  traduits: number;
  total: number;
  complet: boolean;
  manquants: TexteNonTraduit[];
}

/** Élément d'un texte traduisible (TexteTraduction.element). */
export type ElementTraduisible = 'SONDAGE' | 'SECTION' | 'QUESTION' | 'OPTION' | 'LIGNE' | 'COLONNE';

/** Un texte traduisible, côte à côte (schéma TexteTraduction). */
export interface TexteTraduction {
  /** Clé à renvoyer : sondage.titre, section.3.titre, question.12.ligne.2, option.40.libelle… */
  cle: string;
  element: ElementTraduisible;
  /** titre, description, objetEnquete, texteConfidentialite, texteConsentement, libelle, aide, libelleMin, libelleMax, lignes, colonnes. */
  champ: string;
  sectionId: number | null;
  questionId: number | null;
  optionId: number | null;
  /** Texte dans la langue principale. */
  source: string;
  /** null si absente. */
  traduction: string | null;
  longueurMax: number;
}

/** GET et PUT /api/sondages/{id}/traductions/{langue} : textes dans l'ordre du formulaire. */
export interface TraductionsLangueResponse {
  sondageId: number;
  langue: LangueContenu;
  languePrincipale: LangueContenu;
  traduits: number;
  total: number;
  complet: boolean;
  textes: TexteTraduction[];
}

/** PUT /api/sondages/{id}/traductions/{langue} : un texte absent reste inchangé ; null ou "" l'efface. */
export interface TraductionsRequest {
  textes: { cle: string; traduction: string | null }[];
}

/** Texte manquant d'une publication refusée (400 TRADUCTIONS_INCOMPLETES, champ `manquants` de l'erreur). */
export interface TexteManquant {
  langue: LangueContenu;
  cle: string;
  source: string;
}

/** Langues proposées par un sondage, la principale d'abord. */
export function languesDuSondage(sondage: {
  languePrincipale?: LangueContenu | null;
  languesSupplementaires?: LangueContenu[] | null;
}): LangueContenu[] {
  const principale = sondage.languePrincipale ?? 'fr';
  return [principale, ...(sondage.languesSupplementaires ?? []).filter((l) => l !== principale)];
}
