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
  /** Prix en paiement mobile (Moosyl : Bankily, Masrvi, Sedad…), en MRU entiers. */
  prixMobile: number;
  /** Ex. « MRU ». */
  deviseMobile: string;
}

/** Prestataire qui a encaissé un paiement (enum FournisseurPaiement du backend). */
export type FournisseurPaiement = 'STRIPE' | 'MOOSYL';

export const LIBELLES_FOURNISSEUR: Record<FournisseurPaiement, string> = {
  STRIPE: 'Carte',
  MOOSYL: 'Mobile',
};

/** Moyen de paiement choisi à la souscription (?moyen= dans l'URL). */
export type MoyenPaiement = 'carte' | 'mobile';

/** Applications de paiement mobile mauritaniennes acceptées par Moosyl. */
export const APPLICATIONS_MOBILES = 'Bankily, Masrvi, Sedad';

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
  /** STRIPE (carte) ou MOOSYL (paiement mobile). */
  fournisseur: FournisseurPaiement;
}

/** Statut d'un paiement (enum StatutPaiement du backend). */
export type StatutPaiement = 'EN_ATTENTE' | 'REUSSI' | 'ECHOUE';

/** POST /api/abonnements/paiement-mobile (201). 503 PAIEMENT_MOBILE_NON_CONFIGURE, 502 MOOSYL_ERREUR. */
export interface PaiementMobileRequest {
  formule: Formule;
  /** Facultatif (8 chiffres) : sinon Moosyl le demande. Le front ne l'envoie pas. */
  telephone?: string;
}

export interface PaiementMobileResponse {
  /** Référence Batulo, renvoyée par Moosyl dans l'URL de retour (?reference=). */
  reference: string;
  /** Page de paiement Moosyl. */
  checkoutUrl: string;
  formule: Formule;
  montant: number;
  /** « MRU ». */
  devise: string;
  /** Fin de validité de la session ; absente si Moosyl ne la donne pas. */
  expireLe?: string | null;
}

/** GET /api/abonnements/paiement-mobile/{reference}. 404 PAIEMENT_INTROUVABLE. */
export interface StatutPaiementMobileResponse {
  reference: string;
  /** EN_ATTENTE : pas encore confirmé ; REUSSI : abonnement activé ; ECHOUE : refusé, annulé ou expiré. */
  statut: StatutPaiement;
  formule: Formule;
  montant: number;
  devise: string;
  dateCreation: string;
  /** Absente tant que le paiement n'a pas réussi. */
  datePaiement?: string | null;
  abonnement: AbonnementResponse;
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
