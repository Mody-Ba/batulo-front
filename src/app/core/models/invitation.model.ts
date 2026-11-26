import { libelles } from '../i18n/traduire';
import { LangueContenu } from './traduction.model';

/**
 * Statut calculé d'une invitation (StatutInvitation du backend), par priorité : REVOQUEE > A_REPONDU > OUVERTE >
 * EN_ECHEC > INVITEE > A_INVITER.
 */
export type StatutInvitation = 'A_INVITER' | 'INVITEE' | 'OUVERTE' | 'A_REPONDU' | 'REVOQUEE' | 'EN_ECHEC';

export const STATUTS_INVITATION: readonly StatutInvitation[] = ['A_INVITER', 'INVITEE', 'OUVERTE', 'A_REPONDU', 'EN_ECHEC', 'REVOQUEE'];

export const LIBELLES_STATUT_INVITATION = libelles<StatutInvitation>('statutsInvitation', STATUTS_INVITATION);

/** Limites d'InvitationRequest. */
export const REGLES_INVITATION = { prenomMax: 100, nomMax: 100, courrielMax: 254, telephoneMax: 30 } as const;

/** POST et PUT .../invitations : courriel obligatoire, unique dans la lignée (409 INVITE_EXISTANT). */
export interface InvitationRequest {
  prenom: string | null;
  nom: string | null;
  courriel: string;
  telephone: string | null;
  /** Langue préférée (courriel et formulaire si le sondage la propose) ; absente : langue principale. */
  langue: LangueContenu | null;
}

/** InvitationResponse : le lien personnel n'est jamais renvoyé. */
export interface InvitationResponse {
  id: number;
  prenom: string | null;
  nom: string | null;
  courriel: string;
  telephone: string | null;
  langue: LangueContenu | null;
  statut: StatutInvitation;
  /** Courriel en file (envoi en arrière-plan). */
  envoiEnCours: boolean;
  dateCreation: string;
  premierEnvoiLe: string | null;
  dernierEnvoiLe: string | null;
  derniereRelanceLe: string | null;
  nombreEnvois: number;
  echecEnvoiLe: string | null;
  ouverteLe: string | null;
  /** Arrondi au jour si les réponses sont anonymes. */
  reponduLe: string | null;
  revoqueeLe: string | null;
}

/** GET .../invitations/resume ; tauxReponse = répondus / envoyées hors révoquées (en %). */
export interface ResumeInvitationsResponse {
  total: number;
  aInviter: number;
  invitees: number;
  ouvertes: number;
  repondues: number;
  revoquees: number;
  enEchec: number;
  envoyees: number;
  tauxReponse: number;
}

/** POST .../envoyer et .../relancer : la sélection, ou absent : tous ceux qui sont concernés. */
export interface EnvoiInvitationsRequest {
  invitationIds?: number[];
}

/** Raisons d'ignorer un invité à l'envoi ou à la relance. */
export type RaisonIgnoree =
  | 'INTROUVABLE'
  | 'REVOQUEE'
  | 'A_REPONDU'
  | 'DEJA_INVITEE'
  | 'ENVOI_EN_COURS'
  | 'DELAI_RELANCE'
  | 'JAMAIS_INVITEE';

/** 202 : courriels mis en file (envoyés en arrière-plan) et invités ignorés. */
export interface RapportEnvoiResponse {
  enFile: number;
  ignorees: { invitationId: number; raison: RaisonIgnoree | string }[];
}

/** Raisons de refus d'une ligne (import CSV, reprise). */
export type RaisonRefus =
  | 'COURRIEL_MANQUANT'
  | 'COURRIEL_INVALIDE'
  | 'DOUBLON_FICHIER'
  | 'DEJA_INVITE'
  | 'LANGUE_INVALIDE'
  | 'TEXTE_TROP_LONG'
  | 'TELEPHONE_INVALIDE'
  | 'LIMITE_INVITES';

export interface LigneRefusee {
  ligne: number;
  courriel: string | null;
  raison: RaisonRefus | string;
  message: string | null;
}

/** Import CSV (POST .../import) et reprise (POST .../reprendre). */
export interface RapportImportResponse {
  acceptees: number;
  refusees: LigneRefusee[];
}

/** POST .../invitations/reprendre : n'importe quelle version d'un autre sondage visible de l'entreprise. */
export interface RepriseInvitationsRequest {
  sondageSourceId: number;
}

/** Formulaire public ouvert avec un lien personnel (`invitation` de FormulairePublicResponse). */
export interface InvitationPubliqueResponse {
  dejaRepondu: boolean;
  /** true : les réponses sont associées à la personne invitée. */
  reponsesNominatives: boolean;
}

/** Invité d'une réponse (mode nominatif seulement). */
export interface InviteResponse {
  invitationId: number;
  prenom: string | null;
  nom: string | null;
  courriel: string;
}

/** Nom affiché d'un invité : « Prénom Nom », sinon le courriel. */
export function nomInvite(invite: { prenom?: string | null; nom?: string | null; courriel: string }): string {
  return [invite.prenom, invite.nom].map((x) => x?.trim()).filter(Boolean).join(' ') || invite.courriel;
}

/** Délai minimal entre deux courriels à la même personne (DELAI_RELANCE). */
export const DELAI_RELANCE_MS = 24 * 3_600_000;

/** En-têtes du modèle CSV d'import (ordre libre côté serveur, sans majuscules ni accents). */
export const ENTETES_CSV_INVITES = ['prenom', 'nom', 'courriel', 'telephone', 'langue'] as const;
