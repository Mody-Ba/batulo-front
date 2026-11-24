import { TexteManquant } from './traduction.model';

/** Erreur d'une question, seulement pour les réponses à un sondage (formulaire public). */
export interface ErreurQuestion {
  questionId: number;
  message: string;
}

/** Format unique des erreurs de l'API Batulo (ErrorResponse) : code stable + message lisible. */
export interface ErreurApi {
  code: string;
  message: string;
  erreurs?: ErreurQuestion[];
  /** Seulement pour TRADUCTIONS_INCOMPLETES (publication refusée) : textes non traduits. */
  manquants?: TexteManquant[];
}

/** Codes d'erreur du backend utilisés par le front (liste non exhaustive). */
export const CODES_ERREUR = {
  NON_AUTHENTIFIE: 'NON_AUTHENTIFIE',
  VALIDATION: 'VALIDATION',
  MOT_DE_PASSE_TEMPORAIRE: 'MOT_DE_PASSE_TEMPORAIRE',
  ABONNEMENT_EN_ATTENTE_PAIEMENT: 'ABONNEMENT_EN_ATTENTE_PAIEMENT',
  ABONNEMENT_DESACTIVE: 'ABONNEMENT_DESACTIVE',
  ABONNEMENT_EXPIRE: 'ABONNEMENT_EXPIRE',
  JETON_INVALIDE: 'JETON_INVALIDE',
} as const;
