import { Formule, StatutAbonnement } from './abonnement.model';

/** Statut d'une demande d'augmentation d'abonnement (enum StatutDemande du backend). */
export type StatutDemande = 'EN_ATTENTE' | 'TRAITEE' | 'REFUSEE';

export const STATUTS_DEMANDE: readonly StatutDemande[] = ['EN_ATTENTE', 'TRAITEE', 'REFUSEE'];

export const LIBELLES_STATUT_DEMANDE: Record<StatutDemande, string> = {
  EN_ATTENTE: 'En attente',
  TRAITEE: 'Acceptée',
  REFUSEE: 'Refusée',
};

/** Statut lu dans l'URL (?statut=) ; null s'il est absent ou inconnu. */
export function statutDemandeValide(valeur: string | null | undefined): StatutDemande | null {
  return STATUTS_DEMANDE.find((statut) => statut === valeur) ?? null;
}

/**
 * Demande d'augmentation d'abonnement (AD-05, SA-07). Purement informative (RG-09) : acceptée, l'admin paie
 * lui-même la formule par le parcours Stripe habituel.
 */
export interface DemandeAbonnementResponse {
  id: number;
  entrepriseId: number;
  entreprise: string;
  adminId: number;
  adminNom: string;
  adminCourriel: string;
  formuleSouhaitee: Formule;
  /** Formule payée actuellement ; null si jamais payé. */
  formuleActuelle: Formule | null;
  statutAbonnement: StatutAbonnement;
  message: string;
  statut: StatutDemande;
  reponse: string | null;
  traiteeParNom: string | null;
  dateDemande: string;
  dateTraitement: string | null;
}

/**
 * PATCH /api/super-admin/demandes-abonnement/{id} : depuis EN_ATTENTE seulement (409 DEMANDE_DEJA_TRAITEE).
 * La réponse est postée dans la conversation avec Batulo et l'admin est notifié.
 */
export interface TraitementDemandeRequest {
  statut: Exclude<StatutDemande, 'EN_ATTENTE'>;
  /** Facultatif, 2000 caractères au plus. */
  reponse: string | null;
}

/** Longueur maximale de la réponse (TraitementDemandeRequest du backend). */
export const LONGUEUR_MAX_REPONSE_DEMANDE = 2000;

export interface FiltreDemandes {
  statut?: StatutDemande | null;
  page?: number;
  taille?: number;
}
