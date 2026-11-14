import { TypeQuestion } from './sondage.model';

/** Granularité de la répartition des dates (absente : choisie par le backend selon l'écart). */
export type GranulariteDate = 'JOUR' | 'MOIS';

/**
 * Périmètre d'analyse, commun aux statistiques, textes, tableau croisé, exports et envoi. `criteres` :
 * « cle:valeur » ; OU entre valeurs d'une même clé, ET entre clés.
 */
export interface FiltresStatistiques {
  /** true : toutes les versions du sondage (lignée) ; false : la version affichée. */
  lignee: boolean;
  /** AAAA-MM-JJ, inclus. */
  du: string | null;
  au: string | null;
  granularite: GranulariteDate | null;
  criteres: string[];
}

export const FILTRES_PAR_DEFAUT: FiltresStatistiques = {
  lignee: false,
  du: null,
  au: null,
  granularite: null,
  criteres: [],
};

/** GET .../statistiques/criteres (et `criteres` des statistiques) */
export interface CritereResponse {
  /** Clé stable de la question (recopiée dans les versions). */
  cle: string;
  questionId: number;
  libelle: string;
  type: TypeQuestion;
  /** Valeurs présentes : options, oui/non, tranches (t1..tN), mois ou années. */
  valeurs: { valeur: string; libelle: string }[];
}

export interface OptionStat {
  valeur: string;
  libelle: string;
  nombre: number;
  /** Sur les répondants à la question. */
  pourcentage: number;
}

/** Absents du JSON quand ils sont vides (JsonInclude NON_NULL) : tester avec `!= null`. */
export interface ClasseNumerique {
  /** Valeur exacte (jusqu'à 20 valeurs distinctes), ou absente pour une tranche [de ; a[ (la dernière inclut a). */
  valeur?: number | null;
  de?: number | null;
  a?: number | null;
  nombre: number;
  pourcentage: number;
}

export interface StatNumerique {
  moyenne?: number | null;
  mediane?: number | null;
  min?: number | null;
  max?: number | null;
  distribution: ClasseNumerique[];
}

export interface StatDates {
  min: string | null;
  max: string | null;
  granularite: GranulariteDate;
  /** periode : AAAA-MM-JJ (JOUR) ou AAAA-MM (MOIS). */
  repartition: { periode: string; nombre: number }[];
}

export interface RangStat {
  valeur: string;
  libelle: string;
  rangMoyen: number | null;
  nombrePremier: number;
}

export interface CelluleStat {
  colonne: string;
  nombre: number;
  pourcentage: number;
}

export interface StatMatrice {
  colonnes: string[];
  lignes: { ligne: string; nombre: number; cellules: CelluleStat[] }[];
}

export interface Texte {
  texte: string;
  dateSoumission: string;
}

/** Page de textes (bloc `textes` des statistiques, et GET .../textes) */
export interface PageTextes {
  contenu: Texte[];
  page: number;
  taille: number;
  totalElements: number;
  totalPages: number;
}

/** Statistiques d'une question : un seul bloc présent, selon le type (les autres sont absents du JSON). */
export interface QuestionStat {
  questionId: number;
  cle: string;
  section: string;
  libelle: string;
  type: TypeQuestion;
  nombreRepondants: number;
  sansReponse: number;
  /** Moins de répondants que le seuil (5) : à interpréter avec prudence. */
  petitEffectif: boolean;
  /** CHOIX_UNIQUE, CHOIX_MULTIPLE, OUI_NON */
  options?: OptionStat[] | null;
  /** ECHELLE, NUMERIQUE */
  numerique?: StatNumerique | null;
  /** DATE */
  dates?: StatDates | null;
  /** CLASSEMENT, du mieux classé au moins bien classé */
  classement?: RangStat[] | null;
  /** MATRICE */
  matrice?: StatMatrice | null;
  /** TEXTE_COURT, TEXTE_LONG : première page, les plus récents d'abord */
  textes?: PageTextes | null;
}

/** GET /api/sondages/{id}/statistiques et GET /api/statistiques-recues/{envoiId} */
export interface StatistiquesResponse {
  sondageId: number;
  titre: string;
  lignee: boolean;
  /** Versions incluses. */
  versions: number[];
  du: string | null;
  au: string | null;
  criteres: CritereResponse[];
  resume: {
    nombreReponses: number;
    petitEffectif: boolean;
    premiereReponse: string | null;
    derniereReponse: string | null;
  };
  questions: QuestionStat[];
}

/** Questions qu'on peut croiser avec un critère. */
export const TYPES_CROISABLES: ReadonlySet<TypeQuestion> = new Set<TypeQuestion>([
  'CHOIX_UNIQUE',
  'CHOIX_MULTIPLE',
  'OUI_NON',
  'ECHELLE',
  'NUMERIQUE',
]);

/** Cellule d'un tableau croisé (schéma OpenAPI CelluleCroisement). */
export interface CelluleCroisement {
  /** null : colonne « Non renseigné ». */
  colonne: string | null;
  nombre: number;
  /** Part de la ligne. */
  pourcentageLigne: number;
  /** Part des répondants de la colonne. */
  pourcentageColonne: number;
  petitEffectif: boolean;
}

/** GET .../statistiques/croisement (champs vides absents du JSON) */
export interface CroisementResponse {
  question: { cle: string; libelle: string; type: TypeQuestion };
  par: { cle: string; libelle: string; type: TypeQuestion };
  criteres: CritereResponse[];
  /** valeur null : répondants qui n'ont pas renseigné le critère (« Non renseigné »). */
  colonnes: { valeur: string | null; libelle: string; nombreRepondants: number; petitEffectif: boolean }[];
  /** CHOIX_UNIQUE, CHOIX_MULTIPLE, OUI_NON, ECHELLE : une ligne par modalité, cellules dans l'ordre des colonnes. */
  lignes?: { valeur: string; libelle: string; total: number; cellules: CelluleCroisement[] }[];
  /** ECHELLE, NUMERIQUE : statistiques par colonne. */
  numerique?: {
    colonne: string | null;
    nombre: number;
    moyenne?: number | null;
    mediane?: number | null;
    min?: number | null;
    max?: number | null;
    petitEffectif: boolean;
  }[];
}

/** Une réponse (GET .../reponses) : valeurs telles qu'envoyées (codes d'options, objet de matrice...). */
export interface ReponseResponse {
  id: number;
  /** Id de la version qui a reçu la réponse (pour relire son contenu : libellés des options). */
  sondageId: number;
  /** Numéro de cette version dans la lignée. */
  version: number;
  dateSoumission: string;
  valeurs: { questionId: number; libelle: string; type: TypeQuestion; valeur: unknown }[];
}

/** POST /api/sondages/{id}/envois-statistiques (gestionnaire, sondage terminé) */
export interface EnvoiStatistiqueRequest {
  commentaire: string | null;
  lignee: boolean;
  du: string | null;
  au: string | null;
  critere: string[];
  granulariteDate: GranulariteDate | null;
}

/** Envoi de statistiques (reçu par l'admin, ou envoyé par le gestionnaire). */
export interface EnvoiStatistiqueResponse {
  id: number;
  sondageId: number;
  sondageTitre: string;
  version: number;
  lignee: boolean;
  du: string | null;
  au: string | null;
  granulariteDate: GranulariteDate | null;
  criteres: string[];
  gestionnaireId: number | null;
  /** Gardé si le gestionnaire est supprimé. */
  expediteurNom: string;
  commentaire: string | null;
  dateEnvoi: string;
  /** null : pas encore ouvert par l'admin. */
  consulteLe: string | null;
}

/** Formats des exports. */
export type FormatExport = 'CSV' | 'XLSX' | 'PDF';
export type ValeursExport = 'LIBELLES' | 'CODES';
export type SeparateurDecimal = 'VIRGULE' | 'POINT';

/** Période d'un envoi en clair. */
export function resumeEnvoi(envoi: EnvoiStatistiqueResponse): string {
  const parties = [envoi.lignee ? 'toutes les versions' : `version ${envoi.version}`];
  if (envoi.du || envoi.au) {
    parties.push(`du ${envoi.du ?? 'début'} au ${envoi.au ?? 'dernier jour'}`);
  }
  if (envoi.criteres.length) {
    parties.push(`${envoi.criteres.length} critère${envoi.criteres.length > 1 ? 's' : ''}`);
  }
  return parties.join(' · ');
}
