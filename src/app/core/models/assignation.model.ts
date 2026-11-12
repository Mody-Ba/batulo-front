import { AuteurResponse } from './sondage.model';

/**
 * Assignation d'un sondage à un gestionnaire. Elle porte sur la lignée : toutes les versions du
 * sondage partagent les mêmes assignations ; une copie n'en hérite pas.
 */
export interface AssignationResponse {
  gestionnaireId: number;
  prenom: string;
  nom: string;
  courriel: string;
  actif: boolean;
  dateAssignation: string;
  assignePar: AuteurResponse | null;
}

/** POST /api/sondages/{id}/assignations (un gestionnaire déjà assigné est ignoré) */
export interface AssignationRequest {
  gestionnaireIds: number[];
}
