import { Offre, StatutAbonnement } from './abonnement.model';
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
  /** Facultatif : offre choisie, enregistrée pour guider le premier paiement (aucun paiement n'est créé). */
  offre?: Offre;
  /** Obligatoire avec ACHAT_SONDAGES (1 à 1000, 400 QUANTITE_INVALIDE) ; ignoré sinon. */
  nombreSondages?: number;
}

/** 201 : entreprise, compte admin et abonnement EN_ATTENTE_PAIEMENT créés. */
export interface InscriptionResponse {
  message: string;
  utilisateur: UtilisateurResponse;
  abonnementId: number;
  statutAbonnement: StatutAbonnement;
  offre?: Offre | null;
  nombreSondages?: number | null;
}
