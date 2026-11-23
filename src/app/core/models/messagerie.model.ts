import { libelles } from '../i18n/traduire';
import { Role } from './role.model';

/** Type d'un message : écrit par une personne, ou posté automatiquement par Batulo. */
export type TypeMessage = 'TEXTE' | 'STATISTIQUES' | 'DEMANDE_ABONNEMENT' | 'REPONSE_DEMANDE';

/** Côté de la conversation qui a écrit (lu / non lu par côté). */
export type CoteConversation = 'ADMIN' | 'GESTIONNAIRE' | 'PLATEFORME';

export const LIBELLES_TYPE_MESSAGE = libelles<Exclude<TypeMessage, 'TEXTE'>>('typesMessage', [
  'STATISTIQUES',
  'DEMANDE_ABONNEMENT',
  'REPONSE_DEMANDE',
]);

/** Longueur maximale d'un message (MessageRequest du backend). */
export const MESSAGE_MAX = 5000;

/**
 * Interlocuteur d'une conversation. Pour l'admin, la conversation avec Batulo (boîte partagée des super admins) a un
 * interlocuteur { id: null, prenom: « Batulo », role: SUPER_ADMIN } ; le super admin voit l'admin (et son entreprise).
 */
export interface Interlocuteur {
  id: number | null;
  prenom: string;
  nom: string;
  role: Role;
  entreprise: string | null;
}

/** GET /api/messagerie/conversations (éléments) et POST (ouvrir ou retrouver) */
export interface ConversationResponse {
  id: number;
  interlocuteur: Interlocuteur;
  dernierMessage: {
    extrait: string;
    dateEnvoi: string;
    expediteurNom: string;
    type: TypeMessage;
    /** Envoyé par l'interlocuteur (et non par soi). */
    recu: boolean;
  } | null;
  nonLus: number;
  dernierMessageLe: string | null;
}

/**
 * POST /api/messagerie/conversations. Admin : un de ses gestionnaires, ou absent pour Batulo ; gestionnaire : absent
 * (son admin) ; super admin : un admin. Sinon 404 INTERLOCUTEUR_INTROUVABLE.
 */
export interface OuvertureConversationRequest {
  interlocuteurId?: number | null;
}

/** GET .../messages (les plus récents d'abord) et POST .../messages */
export interface MessageInterneResponse {
  id: number;
  conversationId: number;
  type: TypeMessage;
  /** Élément concerné par un message automatique : envoi de statistiques ou demande d'abonnement. */
  referenceId: number | null;
  contenu: string;
  expediteurId: number | null;
  expediteurNom: string;
  cote: CoteConversation;
  /** Envoyé par l'interlocuteur (et non par soi). */
  recu: boolean;
  dateEnvoi: string;
  luLe: string | null;
}

/** Nom affiché d'un interlocuteur (« Batulo » pour la boîte partagée). */
export function nomInterlocuteur(interlocuteur: Interlocuteur): string {
  return `${interlocuteur.prenom} ${interlocuteur.nom}`.trim();
}

/** La conversation de l'admin avec Batulo (boîte partagée des super admins). */
export function estConversationBatulo(conversation: Pick<ConversationResponse, 'interlocuteur'>): boolean {
  return conversation.interlocuteur.role === 'SUPER_ADMIN';
}
