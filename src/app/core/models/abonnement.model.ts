import { libelles } from '../i18n/traduire';

/** Statut effectif de l'abonnement d'une entreprise (enum StatutAbonnement du backend). */
export type StatutAbonnement =
  | 'EN_ATTENTE_PAIEMENT'
  | 'ACTIF'
  | 'EXPIRE_BIENTOT'
  | 'EXPIRE'
  | 'DESACTIVE';

export const LIBELLES_STATUT_ABONNEMENT = libelles<StatutAbonnement>('statutsAbonnement', [
  'EN_ATTENTE_PAIEMENT',
  'ACTIF',
  'EXPIRE_BIENTOT',
  'EXPIRE',
  'DESACTIVE',
]);

/** Formules d'abonnement (enum Formule du backend). */
export type Formule = 'MENSUEL' | 'ANNUEL';

export const FORMULES: readonly Formule[] = ['MENSUEL', 'ANNUEL'];

export const LIBELLES_FORMULE = libelles<Formule>('formules', ['MENSUEL', 'ANNUEL']);

/** Offre choisie à l'inscription (enum Offre du backend). */
export type Offre = Formule | 'ACHAT_SONDAGES';

/** Nature d'un paiement ou d'un élément de /formules (enum TypePaiement du backend). */
export type TypePaiement = 'ABONNEMENT' | 'ACHAT_SONDAGES';

export const LIBELLES_TYPE_PAIEMENT = libelles<TypePaiement>('typesPaiement', ['ABONNEMENT', 'ACHAT_SONDAGES']);

/**
 * Sondages achetés à l'unité (CreditsResponse), sans date limite. compteCredits : l'entreprise a déjà acheté ; elle
 * utilise alors Batulo sans abonnement actif (seule la publication d'un nouveau sondage demande un crédit).
 */
export interface CreditsResponse {
  solde: number;
  totalAchete: number;
  totalUtilise: number;
  compteCredits: boolean;
}

/** Seuil d'alerte avant l'expiration (batulo.abonnement.jours-alerte-expiration du backend). */
export const JOURS_ALERTE_EXPIRATION = 7;

/**
 * GET /api/abonnements/formules (public) : les deux abonnements (type ABONNEMENT), puis l'achat de sondages
 * (type ACHAT_SONDAGES, formule null, prix et prixMobile d'UN sondage, quantiteMin et quantiteMax).
 */
export interface FormuleResponse {
  /** Null pour l'achat de sondages. */
  formule: Formule | null;
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
  /** Absent d'un backend plus ancien : abonnement. */
  type?: TypePaiement;
  /** Achat de sondages : quantité par achat ; null pour un abonnement. */
  quantiteMin?: number | null;
  quantiteMax?: number | null;
}

/** Élément de /formules qui est un abonnement (MENSUEL ou ANNUEL). */
export type FormuleAbonnement = FormuleResponse & { formule: Formule };

/** Les abonnements de /formules (sans l'achat de sondages). */
export function formulesAbonnement(formules: readonly FormuleResponse[]): FormuleAbonnement[] {
  return formules.filter((f): f is FormuleAbonnement => f.type !== 'ACHAT_SONDAGES' && f.formule != null);
}

/** L'offre d'achat de sondages de /formules, ou undefined si le serveur ne la propose pas. */
export function offreAchat(formules: readonly FormuleResponse[]): FormuleResponse | undefined {
  return formules.find((f) => f.type === 'ACHAT_SONDAGES');
}

/** Prestataire qui a encaissé un paiement (enum FournisseurPaiement du backend). */
export type FournisseurPaiement = 'STRIPE' | 'MOOSYL';

export const LIBELLES_FOURNISSEUR = libelles<FournisseurPaiement>('fournisseurs', ['STRIPE', 'MOOSYL']);

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
  /** Offre choisie à l'inscription (guide le premier paiement) ; null si aucune. */
  offreChoisie?: Offre | null;
  /** Nombre de sondages choisi à l'inscription avec ACHAT_SONDAGES. */
  nombreSondagesChoisi?: number | null;
  /** Sondages achetés (GET /moi, fiche du super admin) ; null dans les listes. */
  credits?: CreditsResponse | null;
}

/** GET /api/abonnements/paiements (paiements réussis seulement, du plus récent au plus ancien) */
export interface PaiementResponse {
  id: number;
  datePaiement: string;
  /** Null pour un achat de sondages. */
  formule: Formule | null;
  montant: number;
  devise: string;
  /** STRIPE (carte) ou MOOSYL (paiement mobile). */
  fournisseur: FournisseurPaiement;
  /** Absent d'un backend plus ancien : abonnement. */
  type?: TypePaiement;
  /** Nombre de sondages achetés ; null pour un abonnement. */
  quantite?: number | null;
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
  /** Null pour un achat de sondages. */
  formule: Formule | null;
  montant: number;
  /** « MRU ». */
  devise: string;
  /** Fin de validité de la session ; absente si Moosyl ne la donne pas. */
  expireLe?: string | null;
  type?: TypePaiement;
  /** Nombre de sondages achetés ; null pour un abonnement. */
  quantite?: number | null;
}

/** POST /api/abonnements/achat-sondages/intention et .../achat-sondages/paiement-mobile. 400 QUANTITE_INVALIDE. */
export interface AchatSondagesRequest {
  quantite: number;
}

/** GET /api/abonnements/paiement-mobile/{reference}. 404 PAIEMENT_INTROUVABLE. */
export interface StatutPaiementMobileResponse {
  reference: string;
  /** EN_ATTENTE : pas encore confirmé ; REUSSI : abonnement activé ; ECHOUE : refusé, annulé ou expiré. */
  statut: StatutPaiement;
  /** Null pour un achat de sondages. */
  formule: Formule | null;
  montant: number;
  devise: string;
  dateCreation: string;
  /** Absente tant que le paiement n'a pas réussi. */
  datePaiement?: string | null;
  abonnement: AbonnementResponse | null;
  type?: TypePaiement;
  quantite?: number | null;
  /** Solde de sondages (crédité une seule fois quand un achat réussit). */
  credits?: CreditsResponse | null;
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
  /** Null pour un achat de sondages. */
  formule: Formule | null;
  montant: number;
  devise: string;
  type?: TypePaiement;
  /** Nombre de sondages achetés ; null pour un abonnement. */
  quantite?: number | null;
}

/** POST /api/abonnements/paiement/confirmer (idempotent) */
export interface ConfirmationPaiementRequest {
  paymentIntentId: string;
}

export interface PaiementConfirmeResponse {
  message: string;
  abonnement: AbonnementResponse | null;
  type?: TypePaiement;
  quantite?: number | null;
  /** Solde de sondages après ce paiement. */
  credits?: CreditsResponse | null;
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
