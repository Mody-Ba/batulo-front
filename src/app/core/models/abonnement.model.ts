/** Statut effectif de l'abonnement d'une entreprise (enum StatutAbonnement du backend). */
export type StatutAbonnement =
  | 'EN_ATTENTE_PAIEMENT'
  | 'ACTIF'
  | 'EXPIRE_BIENTOT'
  | 'EXPIRE'
  | 'DESACTIVE';

export const LIBELLES_STATUT_ABONNEMENT: Record<StatutAbonnement, string> = {
  EN_ATTENTE_PAIEMENT: 'En attente de paiement',
  ACTIF: 'Actif',
  EXPIRE_BIENTOT: 'Expire bientôt',
  EXPIRE: 'Expiré',
  DESACTIVE: 'Désactivé',
};

/** Formules d'abonnement (enum Formule du backend). */
export type Formule = 'MENSUEL' | 'ANNUEL';

export const FORMULES: readonly Formule[] = ['MENSUEL', 'ANNUEL'];

export const LIBELLES_FORMULE: Record<Formule, string> = {
  MENSUEL: 'Formule mensuelle',
  ANNUEL: 'Formule annuelle',
};

/** Seuil d'alerte avant l'expiration (batulo.abonnement.jours-alerte-expiration du backend). */
export const JOURS_ALERTE_EXPIRATION = 7;

/** GET /api/abonnements/formules (public) */
export interface FormuleResponse {
  formule: Formule;
  /** Ex. « Abonnement mensuel ». */
  libelle: string;
  prix: number;
  /** Ex. « CAD ». */
  devise: string;
  /** Ex. « 1 mois ». */
  duree: string;
}

/** GET /api/abonnements/moi (dates ISO 8601). 404 ABONNEMENT_INTROUVABLE s'il n'y en a pas. */
export interface AbonnementResponse {
  id: number;
  entrepriseId: number;
  entreprise: string;
  /** Null tant qu'aucune formule n'a été payée. */
  formule: Formule | null;
  /** Recalculé à partir des dates. */
  statut: StatutAbonnement;
  dateDebut: string | null;
  dateExpiration: string | null;
  /** Jours avant l'expiration (arrondi au jour supérieur), 0 si expiré, null si jamais payé. */
  joursRestants: number | null;
  /** Montant du dernier paiement. */
  montant: number | null;
  devise: string | null;
}

/** GET /api/abonnements/paiements (paiements réussis seulement, du plus récent au plus ancien) */
export interface PaiementResponse {
  id: number;
  datePaiement: string;
  formule: Formule;
  montant: number;
  devise: string;
}

/** POST /api/abonnements/paiement/intention */
export interface IntentionPaiementRequest {
  formule: Formule;
}

export interface IntentionPaiementResponse {
  /** À renvoyer à /paiement/confirmer une fois la carte validée. */
  paymentIntentId: string;
  /** Pour Stripe.js (confirmCardPayment) ; ne jamais le journaliser. */
  clientSecret: string;
  /** Clé publique Stripe (pk_test_...) pour initialiser Stripe.js. */
  clePublique: string;
  formule: Formule;
  montant: number;
  devise: string;
}

/** POST /api/abonnements/paiement/confirmer (idempotent) */
export interface ConfirmationPaiementRequest {
  paymentIntentId: string;
}

export interface PaiementConfirmeResponse {
  message: string;
  abonnement: AbonnementResponse;
}

/**
 * Abonnement à signaler : expiré, ou 7 jours ou moins avant l'expiration.
 * Le statut EXPIRE_BIENTOT du backend suffit en général ; joursRestants couvre un statut pas encore recalculé.
 */
export function abonnementEnAlerte(abonnement: AbonnementResponse | null): boolean {
  if (!abonnement) {
    return false;
  }
  if (abonnement.statut === 'EXPIRE' || abonnement.statut === 'EXPIRE_BIENTOT') {
    return true;
  }
  return (
    abonnement.statut === 'ACTIF' &&
    abonnement.joursRestants !== null &&
    abonnement.joursRestants <= JOURS_ALERTE_EXPIRATION
  );
}
