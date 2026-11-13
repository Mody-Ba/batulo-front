/** Statut calculé à partir des dates (StatutSondage du backend). Un brouillon est NON_COMMENCE et publie=false. */
export type StatutSondage = 'NON_COMMENCE' | 'EN_COURS' | 'TERMINE';

export const STATUTS_SONDAGE: readonly StatutSondage[] = ['NON_COMMENCE', 'EN_COURS', 'TERMINE'];

export const LIBELLES_STATUT_SONDAGE: Record<StatutSondage, string> = {
  NON_COMMENCE: 'Non commencé',
  EN_COURS: 'En cours',
  TERMINE: 'Terminé',
};

/** Libellé affiché : un sondage jamais publié est un brouillon, quel que soit son statut. */
export function libelleEtatSondage(sondage: { statut: StatutSondage; publie: boolean }): string {
  return sondage.publie ? LIBELLES_STATUT_SONDAGE[sondage.statut] : 'Brouillon';
}

/** Classe CSS de la pastille d'état. */
export function classeEtatSondage(sondage: { statut: StatutSondage; publie: boolean }): string {
  return sondage.publie ? `sondage-${sondage.statut}` : 'sondage-BROUILLON';
}

/** AuteurResponse */
export interface AuteurResponse {
  id: number;
  prenom: string;
  nom: string;
}

/** Gestionnaire assigné à la lignée (GestionnaireAssigneResponse). */
export interface GestionnaireAssigneResponse {
  id: number;
  prenom: string;
  nom: string;
  actif: boolean;
}

/** GET /api/sondages (éléments de la page) */
export interface SondageResumeResponse {
  id: number;
  titre: string;
  description: string | null;
  statut: StatutSondage;
  publie: boolean;
  datePublication: string | null;
  dateFermeture: string | null;
  version: number;
  estModele: boolean;
  creePar: AuteurResponse | null;
  nombreSections: number;
  nombreQuestions: number;
  /** Réponses reçues par cette version. */
  nombreReponses: number;
  /** Réponses reçues par toutes les versions de la lignée. */
  nombreReponsesLignee: number;
  /** Assignés de la lignée ; null pour un gestionnaire (réservé à l'admin). */
  gestionnairesAssignes: GestionnaireAssigneResponse[] | null;
  /** true si la lignée a un brouillon plus récent que cette version (nouvelle version en préparation). */
  brouillonEnPreparation: boolean;
  brouillonEnPreparationId: number | null;
  dateCreation: string;
  dateModification: string;
}

/** Relation d'un gestionnaire avec un sondage (RelationSondage du backend). */
export type RelationSondage = 'CREATEUR' | 'ASSIGNE';

export const LIBELLES_RELATION: Record<RelationSondage, string> = {
  CREATEUR: 'Créé par lui',
  ASSIGNE: 'Assigné',
};

/** GET /api/admin/gestionnaires/{id}/sondages (éléments de la page) */
export interface SondageGestionnaireResponse {
  id: number;
  titre: string;
  statut: StatutSondage;
  publie: boolean;
  version: number;
  relation: RelationSondage;
  dateModification: string;
}

/** GET /api/sondages/{id} et réponse de toutes les écritures de l'éditeur (le sondage complet). */
export interface SondageResponse {
  id: number;
  entrepriseId: number;
  titre: string;
  description: string | null;
  statut: StatutSondage;
  publie: boolean;
  datePublication: string | null;
  dateFermeture: string | null;
  version: number;
  sondageOrigineId: number | null;
  estModele: boolean;
  reponseUnique: boolean;
  creePar: AuteurResponse | null;
  dateCreation: string;
  dateModification: string;
  sections: SectionResponse[];
}

/** GET /api/sondages/{id}/versions (toute la lignée, de la plus ancienne à la plus récente) */
export interface VersionResponse {
  id: number;
  version: number;
  titre: string;
  statut: StatutSondage;
  publie: boolean;
  datePublication: string | null;
  dateFermeture: string | null;
  dateCreation: string;
}

/** GET /api/sondages/{id}/collecte */
export interface SuiviCollecteResponse {
  sondageId: number;
  version: number;
  statut: StatutSondage;
  collecteOuverte: boolean;
  /** Pourquoi la collecte est fermée ; null si elle est ouverte. */
  raisonFermeture: string | null;
  /** Réponses à cette version. */
  nombreReponses: number;
  /** Réponses à toutes les versions du sondage. */
  nombreReponsesTotal: number;
  derniereReponse: string | null;
}

// ---------------------------------------------------------------- Contenu d'un sondage (éditeur F5)

/** Types de questions (TypeQuestion du backend). */
export type TypeQuestion =
  | 'CHOIX_UNIQUE'
  | 'CHOIX_MULTIPLE'
  | 'OUI_NON'
  | 'TEXTE_COURT'
  | 'TEXTE_LONG'
  | 'ECHELLE'
  | 'CLASSEMENT'
  | 'NUMERIQUE'
  | 'DATE'
  | 'MATRICE';

/** Ordre du sélecteur de type. */
export const TYPES_QUESTION: readonly TypeQuestion[] = [
  'CHOIX_UNIQUE',
  'CHOIX_MULTIPLE',
  'OUI_NON',
  'TEXTE_COURT',
  'TEXTE_LONG',
  'ECHELLE',
  'CLASSEMENT',
  'NUMERIQUE',
  'DATE',
  'MATRICE',
];

export const LIBELLES_TYPE_QUESTION: Record<TypeQuestion, string> = {
  CHOIX_UNIQUE: 'Choix unique',
  CHOIX_MULTIPLE: 'Choix multiple',
  OUI_NON: 'Oui / Non',
  TEXTE_COURT: 'Texte court',
  TEXTE_LONG: 'Texte long',
  ECHELLE: 'Échelle',
  CLASSEMENT: 'Classement',
  NUMERIQUE: 'Nombre',
  DATE: 'Date',
  MATRICE: 'Grille (matrice)',
};

/** Icône Material de chaque type (décorative). */
export const ICONES_TYPE_QUESTION: Record<TypeQuestion, string> = {
  CHOIX_UNIQUE: 'radio_button_checked',
  CHOIX_MULTIPLE: 'check_box',
  OUI_NON: 'thumbs_up_down',
  TEXTE_COURT: 'short_text',
  TEXTE_LONG: 'notes',
  ECHELLE: 'linear_scale',
  CLASSEMENT: 'format_list_numbered',
  NUMERIQUE: 'pin',
  DATE: 'event',
  MATRICE: 'grid_on',
};

/** Types qui ont des options (au moins 2) ; les autres n'en ont aucune. */
export const TYPES_AVEC_OPTIONS: ReadonlySet<TypeQuestion> = new Set<TypeQuestion>([
  'CHOIX_UNIQUE',
  'CHOIX_MULTIPLE',
  'CLASSEMENT',
]);

/** ECHELLE : de 1 à 5 ou de 1 à 10, libellés des extrêmes facultatifs. */
export interface ConfigurationEchelle {
  min: 1;
  max: 5 | 10;
  libelleMin?: string;
  libelleMax?: string;
}

/** NUMERIQUE : bornes facultatives (min ≤ max), décimales de 0 à 4. */
export interface ConfigurationNumerique {
  min?: number;
  max?: number;
  decimales: number;
}

/** TEXTE_COURT (1 à 255) et TEXTE_LONG (1 à 5000, 2000 par défaut). */
export interface ConfigurationTexte {
  longueurMax: number;
}

/** DATE : bornes facultatives au format AAAA-MM-JJ (dateMin ≤ dateMax). */
export interface ConfigurationDate {
  dateMin?: string;
  dateMax?: string;
}

/** MATRICE : 1 à 30 lignes, 2 à 10 colonnes, textes non vides et sans doublon. */
export interface ConfigurationMatrice {
  lignes: string[];
  colonnes: string[];
}

/** Configuration normalisée renvoyée par le backend ({} pour les types sans configuration). */
export type ConfigurationQuestion =
  | Record<string, never>
  | ConfigurationEchelle
  | ConfigurationNumerique
  | ConfigurationTexte
  | ConfigurationDate
  | ConfigurationMatrice;

export interface OptionResponse {
  id: number;
  libelle: string;
  /** Code stable pour les statistiques, unique dans la question. */
  valeur: string;
  ordre: number;
}

export interface QuestionResponse {
  id: number;
  libelle: string;
  aide: string | null;
  type: TypeQuestion;
  obligatoire: boolean;
  ordre: number;
  configuration: ConfigurationQuestion;
  options: OptionResponse[];
  /** Réglages d'analyse (F5b) : jamais envoyés par l'éditeur, le backend les garde. */
  estCritere: boolean;
  critereConfig: unknown;
}

export interface SectionResponse {
  id: number;
  titre: string;
  description: string | null;
  ordre: number;
  questions: QuestionResponse[];
}

/** Option envoyée : `id` pour une option existante ; `valeur` absente = générée (nouvelle) ou gardée (existante). */
export interface OptionRequest {
  id?: number;
  libelle: string;
  valeur?: string;
}

/** POST .../sections/{sectionId}/questions et PUT .../questions/{questionId} (sans estCritere : inchangé). */
export interface QuestionRequest {
  libelle: string;
  aide: string | null;
  type: TypeQuestion;
  obligatoire: boolean;
  configuration: ConfigurationQuestion;
  options: OptionRequest[];
}

/** POST /api/sondages : vide, ou copie du contenu de `sondageSourceId` (description et réponse unique reprises). */
export interface CreationSondageRequest {
  titre: string;
  description?: string | null;
  sondageSourceId?: number | null;
  reponseUnique?: boolean;
}

/** PUT /api/sondages/{id} (brouillon seulement). */
export interface SondageRequest {
  titre: string;
  description: string | null;
  /** true : une réponse par appareil (en ligne) ; false : collecte terrain. */
  reponseUnique: boolean;
}

/** POST et PUT des sections. */
export interface SectionRequest {
  titre: string;
  description: string | null;
}

/** PUT .../sections/ordre et .../sections/{id}/questions/ordre : exactement tous les ids, une fois chacun. */
export interface OrdreRequest {
  ids: number[];
}

/** GET /api/sondages/formulaires : sondages de l'entreprise réutilisables, modèles d'abord. */
export interface FormulaireResponse {
  id: number;
  titre: string;
  estModele: boolean;
  statut: StatutSondage;
  version: number;
  nombreQuestions: number;
  dateCreation: string;
  dateModification: string;
}
