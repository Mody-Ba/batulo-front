import { UtilisateurResponse } from './utilisateur.model';

/**
 * Un gestionnaire est un UtilisateurResponse de rôle GESTIONNAIRE
 * (actif, motDePasseTemporaire, motDePasseTemporaireExpireLe, peutCreerSondages...).
 */
export type GestionnaireResponse = UtilisateurResponse;

/** Filtres de GET /api/admin/gestionnaires ; un filtre absent n'est pas envoyé. */
export interface FiltreGestionnaires {
  /** Prénom, nom ou courriel, sans tenir compte des majuscules ni des accents. */
  recherche?: string | null;
  /** true : actifs ; false : désactivés. */
  actif?: boolean | null;
  page?: number;
  taille?: number;
}

/** POST /api/admin/gestionnaires (mot de passe temporaire envoyé par courriel, jamais renvoyé ici) */
export interface CreationGestionnaireRequest {
  prenom: string;
  nom: string;
  courriel: string;
}

/** PUT /api/admin/gestionnaires/{id} */
export type ModificationGestionnaireRequest = CreationGestionnaireRequest;

/** PATCH /api/admin/gestionnaires/{id}/permission-sondages */
export interface PermissionSondagesRequest {
  peutCreerSondages: boolean;
}

export function nomComplet(personne: { prenom: string; nom: string }): string {
  return `${personne.prenom} ${personne.nom}`.trim();
}
