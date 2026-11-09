import { StatutAbonnement } from './abonnement.model';
import { UtilisateurResponse } from './utilisateur.model';

/** POST /api/auth/inscription (admin d'une entreprise) */
export interface InscriptionRequest {
  prenom: string;
  nom: string;
  courriel: string;
  motDePasse: string;
  confirmationMotDePasse: string;
  /** Facultatif. Par défaut : « Entreprise de Prénom Nom ». */
  nomEntreprise?: string;
}

/** 201 : entreprise, compte admin et abonnement EN_ATTENTE_PAIEMENT créés. */
export interface InscriptionResponse {
  message: string;
  utilisateur: UtilisateurResponse;
  abonnementId: number;
  statutAbonnement: StatutAbonnement;
}
