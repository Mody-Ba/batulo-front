import { Role } from './role.model';

/** UtilisateurResponse du backend (dates en ISO 8601). */
export interface UtilisateurResponse {
  id: number;
  prenom: string;
  nom: string;
  courriel: string;
  role: Role;
  /** Null pour le super admin. */
  entrepriseId: number | null;
  entreprise: string | null;
  actif: boolean;
  /** true : mot de passe généré par le serveur, à changer avant tout accès. */
  motDePasseTemporaire: boolean;
  /** Fin de validité du mot de passe temporaire (24 h) ; null s'il n'y en a pas. */
  motDePasseTemporaireExpireLe: string | null;
  peutCreerSondages: boolean;
  dateCreation: string;
}
