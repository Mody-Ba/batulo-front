import { StatutAbonnement } from './abonnement.model';
import { Role } from './role.model';
import { UtilisateurResponse } from './utilisateur.model';

/** POST /api/auth/connexion */
export interface ConnexionRequest {
  courriel: string;
  motDePasse: string;
}

/** Réponse de /connexion, /rafraichir et /changer-mot-de-passe. */
export interface ConnexionResponse {
  /** Jeton d'accès (15 min), en-tête Authorization: Bearer ... */
  jeton: string;
  typeJeton: string;
  /** Durée de validité du jeton d'accès, en secondes. */
  expireDans: number;
  /** Usage unique : le réutiliser ferme toutes les sessions du compte. */
  jetonRafraichissement: string;
  role: Role;
  /** Null pour le super admin. */
  statutAbonnement: StatutAbonnement | null;
  motDePasseTemporaire: boolean;
  utilisateur: UtilisateurResponse;
}

/** POST /api/auth/rafraichir et /api/auth/deconnexion */
export interface JetonRafraichissementRequest {
  jetonRafraichissement: string;
}

/** GET /api/auth/moi */
export interface ProfilResponse {
  utilisateur: UtilisateurResponse;
  statutAbonnement: StatutAbonnement | null;
}

/** POST /api/auth/changer-mot-de-passe (renvoie de nouveaux jetons) */
export interface ChangementMotDePasseRequest {
  motDePasseActuel: string;
  nouveauMotDePasse: string;
  confirmationMotDePasse: string;
}

/** POST /api/auth/mot-de-passe-oublie */
export interface MotDePasseOublieRequest {
  courriel: string;
}

/** POST /api/auth/reinitialiser-mot-de-passe */
export interface ReinitialisationMotDePasseRequest {
  /** Paramètre « jeton » du lien reçu par courriel. */
  jeton: string;
  nouveauMotDePasse: string;
  confirmationMotDePasse: string;
}

export interface MessageResponse {
  message: string;
}
