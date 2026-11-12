import { AbonnementResponse, JOURS_ALERTE_EXPIRATION, StatutAbonnement } from './abonnement.model';
import { UtilisateurResponse } from './utilisateur.model';

/** Ordre d'affichage des statuts d'abonnement (filtres et compteurs du super admin). */
export const STATUTS_ABONNEMENT: readonly StatutAbonnement[] = [
  'ACTIF',
  'EXPIRE_BIENTOT',
  'EXPIRE',
  'EN_ATTENTE_PAIEMENT',
  'DESACTIVE',
];

/** Statut lu dans l'URL (?statut=) ; null s'il est absent ou inconnu. */
export function statutAbonnementValide(valeur: string | null | undefined): StatutAbonnement | null {
  return STATUTS_ABONNEMENT.find((statut) => statut === valeur) ?? null;
}

/**
 * Abonnement qui expire dans 7 jours ou moins (à mettre en évidence). Le statut EXPIRE_BIENTOT du backend suffit
 * en général ; joursRestants couvre un statut pas encore recalculé. Un abonnement expiré ou désactivé n'en fait pas partie.
 */
export function expireBientot(abonnement: AbonnementResponse): boolean {
  if (abonnement.statut === 'EXPIRE_BIENTOT') {
    return true;
  }
  return (
    abonnement.statut === 'ACTIF' &&
    abonnement.joursRestants !== null &&
    abonnement.joursRestants <= JOURS_ALERTE_EXPIRATION
  );
}

/**
 * GET, PUT, PATCH .../activer|desactiver /api/super-admin/admins/{id} et POST /api/super-admin/admins.
 * 403 SUPER_ADMIN_PROTEGE pour le compte du super admin, 404 ADMIN_INTROUVABLE pour un autre id.
 */
export interface AdminDetailResponse {
  admin: UtilisateurResponse;
  /** Null seulement si l'entreprise n'a pas d'abonnement (ne devrait pas arriver). */
  abonnement: AbonnementResponse | null;
  nombreGestionnaires: number;
}

/** POST /api/super-admin/admins : mot de passe temporaire (24 h) envoyé par courriel, abonnement EN_ATTENTE_PAIEMENT. */
export interface CreationAdminRequest {
  prenom: string;
  nom: string;
  courriel: string;
  /** Facultatif. Par défaut : « Entreprise de Prénom Nom ». */
  nomEntreprise: string | null;
}

/** PUT /api/super-admin/admins/{id} (tous obligatoires). */
export interface ModificationAdminRequest {
  prenom: string;
  nom: string;
  courriel: string;
  nomEntreprise: string;
}

/** POST /api/super-admin/admins/{id}/mot-de-passe-temporaire (le mot de passe n'est jamais renvoyé). */
export interface MotDePasseTemporaireResponse {
  message: string;
  adminId: number;
  courriel: string;
  expireLe: string;
}

/** GET /api/super-admin/abonnements (expiration la plus proche d'abord, les jamais payés à la fin). */
export interface AbonnementAdminResponse {
  abonnement: AbonnementResponse;
  /** Null si l'entreprise n'a plus d'admin (ne devrait pas arriver). */
  adminId: number | null;
  adminPrenom: string | null;
  adminNom: string | null;
  adminCourriel: string | null;
}

export interface FiltreAbonnements {
  statut?: StatutAbonnement | null;
  page?: number;
  taille?: number;
}
