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

/**
 * GET /api/sondages/{id}. Les sections (questions, options) ne sont pas typées ici :
 * l'éditeur arrive à l'étape F5.
 */
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
  sections: unknown[];
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
