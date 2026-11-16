/** Statut calculé à partir des dates (StatutSondage du backend). Un brouillon est NON_COMMENCE et publie=false. */
export type StatutSondage = 'NON_COMMENCE' | 'EN_COURS' | 'TERMINE';

export const STATUTS_SONDAGE: readonly StatutSondage[] = ['NON_COMMENCE', 'EN_COURS', 'TERMINE'];

export const LIBELLES_STATUT_SONDAGE: Record<StatutSondage, string> = {
  NON_COMMENCE: 'Non commencé',
  EN_COURS: 'En cours',
  TERMINE: 'Terminé',
};

/** État affiché d'un sondage : son statut, plus le brouillon (jamais publié) et le planifié (publié, pas ouvert). */
export type EtatSondage = 'BROUILLON' | 'PLANIFIE' | 'EN_COURS' | 'TERMINE';

export const LIBELLES_ETAT_SONDAGE: Record<EtatSondage, string> = {
  BROUILLON: 'Brouillon',
  PLANIFIE: 'Planifié',
  EN_COURS: 'En cours',
  TERMINE: 'Terminé',
};

export function etatSondage(sondage: { statut: StatutSondage; publie: boolean }): EtatSondage {
  if (!sondage.publie) {
    return 'BROUILLON';
  }
  return sondage.statut === 'NON_COMMENCE' ? 'PLANIFIE' : sondage.statut;
}

/** Libellé affiché partout : Brouillon, Planifié, En cours, Terminé. */
export function libelleEtatSondage(sondage: { statut: StatutSondage; publie: boolean }): string {
  return LIBELLES_ETAT_SONDAGE[etatSondage(sondage)];
}

/** Classe CSS de la pastille d'état. */
export function classeEtatSondage(sondage: { statut: StatutSondage; publie: boolean }): string {
  return `sondage-${etatSondage(sondage)}`;
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
  /** Page d'accueil du formulaire (absents si vides : JsonInclude NON_NULL). */
  objetEnquete?: string | null;
  texteConfidentialite?: string | null;
  consentementRequis?: boolean;
  texteConsentement?: string | null;
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
  /** Réponses reçues par cette version (pas par toute la lignée). */
  nombreReponses: number;
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

// ---------------------------------------------------------------- Conditions d'affichage (phase 4)

/** Combinaison des règles (CombinaisonCondition du backend) : toutes (ET) ou au moins une (OU). */
export type CombinaisonCondition = 'ET' | 'OU';

/** Opérateur d'une règle (OperateurCondition du backend). */
export type OperateurCondition =
  | 'EGAL'
  | 'DIFFERENT'
  | 'PARMI'
  | 'CONTIENT'
  | 'SUPERIEUR'
  | 'INFERIEUR'
  | 'ENTRE'
  | 'REPONDUE'
  | 'NON_REPONDUE';

/**
 * Valeur d'une règle : valeur d'option (jamais le libellé), true/false (OUI_NON), nombre, date « AAAA-MM-JJ »,
 * liste de valeurs d'options (PARMI), [min, max] (ENTRE) ; absente pour REPONDUE et NON_REPONDUE.
 */
export type ValeurCondition = string | number | boolean | (string | number)[];

/** RegleConditionRequest / RegleConditionResponse : la source est désignée par son id dans cette version. */
export interface RegleCondition {
  questionId: number;
  operateur: OperateurCondition;
  /** Absente pour REPONDUE et NON_REPONDUE. */
  valeur?: ValeurCondition | null;
}

/** ConditionRequest / ConditionResponse : la cible n'est affichée que si ses règles sont vérifiées. */
export interface ConditionAffichage {
  combinaison: CombinaisonCondition;
  /** 1 à 10 règles. */
  regles: RegleCondition[];
}

/** Nombre maximal de règles d'une condition (ConditionRequest). */
export const REGLES_CONDITION_MAX = 10;

/** Opérateurs permis selon le type de la source (OperateurCondition.permis du backend), dans l'ordre proposé. */
export function operateursPermis(type: TypeQuestion): OperateurCondition[] {
  const tous: OperateurCondition[] = ['REPONDUE', 'NON_REPONDUE'];
  switch (type) {
    case 'CHOIX_UNIQUE':
      return ['EGAL', 'DIFFERENT', 'PARMI', ...tous];
    case 'CHOIX_MULTIPLE':
      return ['CONTIENT', 'PARMI', ...tous];
    case 'OUI_NON':
      return ['EGAL', 'DIFFERENT', ...tous];
    case 'NUMERIQUE':
    case 'ECHELLE':
    case 'DATE':
      return ['EGAL', 'DIFFERENT', 'SUPERIEUR', 'INFERIEUR', 'ENTRE', ...tous];
    default:
      return tous;
  }
}

/** REPONDUE et NON_REPONDUE ne prennent pas de valeur. */
export function operateurSansValeur(operateur: OperateurCondition): boolean {
  return operateur === 'REPONDUE' || operateur === 'NON_REPONDUE';
}

/** Libellé d'un opérateur ; les dates disent « après » / « avant ». */
export function libelleOperateur(operateur: OperateurCondition, type: TypeQuestion): string {
  const date = type === 'DATE';
  switch (operateur) {
    case 'EGAL':
      return date ? 'est le' : 'est égal à';
    case 'DIFFERENT':
      return date ? 'n’est pas le' : 'est différent de';
    case 'PARMI':
      return type === 'CHOIX_MULTIPLE' ? 'contient au moins une de' : 'est l’une de';
    case 'CONTIENT':
      return 'contient';
    case 'SUPERIEUR':
      return date ? 'est après le' : 'est supérieur à';
    case 'INFERIEUR':
      return date ? 'est avant le' : 'est inférieur à';
    case 'ENTRE':
      return 'est entre';
    case 'REPONDUE':
      return 'a reçu une réponse';
    case 'NON_REPONDUE':
      return 'n’a pas reçu de réponse';
  }
}

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
  /** Condition d'affichage ; absente : toujours affichée (si sa section l'est). Posée par PUT .../condition. */
  condition?: ConditionAffichage | null;
}

/**
 * Question telle qu'affichée au répondant (aperçu et formulaire public, QuestionPubliqueResponse du backend) : sans
 * les réglages d'analyse internes.
 */
export type QuestionAffichee = Omit<QuestionResponse, 'estCritere' | 'critereConfig'>;

/** Section telle qu'affichée au répondant (SectionPubliqueResponse) ; une SectionResponse en est une. */
export interface SectionAffichee {
  id: number;
  titre: string;
  description: string | null;
  ordre: number;
  questions: QuestionAffichee[];
  /** Condition d'affichage ; absente : toujours affichée. Masquée, la section masque toutes ses questions. */
  condition?: ConditionAffichage | null;
}

export interface SectionResponse {
  id: number;
  titre: string;
  description: string | null;
  ordre: number;
  questions: QuestionResponse[];
  /** Condition d'affichage ; absente : toujours affichée. Masquée, la section masque toutes ses questions. */
  condition?: ConditionAffichage | null;
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

/** PUT /api/sondages/{id} (brouillon seulement) : tout l'en-tête, page d'accueil comprise. */
export interface SondageRequest {
  titre: string;
  description: string | null;
  /** true : une réponse par appareil (en ligne) ; false : collecte terrain. */
  reponseUnique: boolean;
  objetEnquete: string | null;
  texteConfidentialite: string | null;
  /** true : le répondant coche la case avant de commencer ; texteConsentement est alors obligatoire (400 TEXTE_CONSENTEMENT_REQUIS). */
  consentementRequis: boolean;
  texteConsentement: string | null;
}

/**
 * Page d'accueil du formulaire du répondant (sondage, aperçu, formulaire public) : objet de l'enquête, confidentialité,
 * case de consentement. Champs absents si vides.
 */
export interface PageAccueil {
  objetEnquete?: string | null;
  texteConfidentialite?: string | null;
  consentementRequis?: boolean;
  texteConsentement?: string | null;
}

/** Page d'accueil à montrer : un texte d'accueil ou le consentement (la description seule ne suffit pas). */
export function accueilNecessaire(page: PageAccueil): boolean {
  return !!(page.objetEnquete?.trim() || page.texteConfidentialite?.trim() || page.consentementRequis);
}

/** PUT du brouillon depuis le sondage enregistré, avec quelques réglages changés (rien d'autre n'est perdu). */
export function requeteSondage(sondage: SondageResponse, modifs: Partial<SondageRequest> = {}): SondageRequest {
  return {
    titre: sondage.titre,
    description: sondage.description,
    reponseUnique: sondage.reponseUnique,
    objetEnquete: sondage.objetEnquete ?? null,
    texteConfidentialite: sondage.texteConfidentialite ?? null,
    consentementRequis: sondage.consentementRequis ?? false,
    texteConsentement: sondage.texteConsentement ?? null,
    ...modifs,
  };
}

/** POST et PUT des sections. */
export interface SectionRequest {
  titre: string;
  description: string | null;
}

/**
 * PUT .../questions/{questionId}/section : vers une section du même sondage (brouillon seulement). Position à partir de
 * 1 dans la section d'arrivée, à la fin si absente. La question garde son id, ses options et son critère.
 */
export interface DeplacementQuestionRequest {
  sectionId: number;
  position?: number;
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

// ---------------------------------------------------------------- Cycle de vie (F5b)

/** POST .../publier (ouverture absente = maintenant) et PUT .../dates (ouverture absente = inchangée). */
export interface DatesSondageRequest {
  datePublication?: string | null;
  /** Absente : pas de fermeture prévue (fermeture manuelle). */
  dateFermeture?: string | null;
}

/** PUT .../modele */
export interface ModeleRequest {
  estModele: boolean;
}

/** Découpage d'un critère : NUMERIQUE { tranches } (absent : 5 tranches égales entre min et max) ; DATE { granularite }. */
export type GranulariteCritere = 'MOIS' | 'ANNEE';
export interface ConfigurationCritere {
  tranches?: number[];
  granularite?: GranulariteCritere;
}

/** Types qui peuvent être un critère d'analyse. */
export const TYPES_CRITERE: ReadonlySet<TypeQuestion> = new Set<TypeQuestion>([
  'CHOIX_UNIQUE',
  'OUI_NON',
  'NUMERIQUE',
  'DATE',
]);

/** PUT .../questions/{questionId}/critere : permis quel que soit le statut, même après publication. */
export interface CritereRequest {
  estCritere: boolean;
  /** Vide pour CHOIX_UNIQUE et OUI_NON. */
  critereConfig: ConfigurationCritere | null;
}

/** GET .../lien : le même pour toutes les versions (409 SONDAGE_BROUILLON avant la première publication). */
export interface LienSondageResponse {
  jeton: string;
  url: string;
}

/** GET .../apercu : le formulaire tel que le verra le répondant (brouillon compris). */
export interface ApercuResponse extends PageAccueil {
  id: number;
  titre: string;
  description: string | null;
  version: number;
  statut: StatutSondage;
  sections: SectionResponse[];
}
