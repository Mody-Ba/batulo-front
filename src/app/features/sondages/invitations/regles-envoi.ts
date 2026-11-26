import { messageLectureSeule } from '../../../core/services/auth.service';
import { traduire } from '../../../core/i18n/traduire';
import { dateEnClair } from '../../../core/i18n/formats.pipes';
import { DELAI_RELANCE_MS, InvitationResponse, ResumeInvitationsResponse } from '../../../core/models/invitation.model';
import { VersionResponse } from '../../../core/models/sondage.model';

/** Ouverture de la lignée pour l'envoi : une version publiée en cours ou planifiée (sinon 409 SONDAGE_NON_OUVERT). */
export type OuvertureEnvoi = 'ouvert' | 'jamais-publie' | 'termine';

export function ouvertureEnvoi(versions: readonly Pick<VersionResponse, 'publie' | 'statut'>[]): OuvertureEnvoi {
  const publiees = versions.filter((v) => v.publie);
  if (!publiees.length) {
    return 'jamais-publie';
  }
  return publiees.some((v) => v.statut !== 'TERMINE') ? 'ouvert' : 'termine';
}

/** Ce qui décide si l'envoi ou la relance sont possibles (affichage : le serveur décide). */
export interface ContexteEnvoi {
  ouverture: OuvertureEnvoi;
  lectureSeule: boolean;
  /** Après un 429 LIMITE_ENVOIS : envois bloqués jusqu'à cette heure (ms), pour cette visite. */
  limiteJusqua: number | null;
  resume: ResumeInvitationsResponse | null;
  /** Invités sélectionnés (vide : tous ceux qui sont concernés). */
  selection: readonly InvitationResponse[];
  maintenant: number;
}

/** Raison commune aux deux boutons, ou null. */
function raisonCommune(ctx: ContexteEnvoi): string | null {
  if (ctx.lectureSeule) {
    return messageLectureSeule();
  }
  if (ctx.ouverture === 'jamais-publie') {
    return traduire('invitations.envoi.nonPublie');
  }
  if (ctx.ouverture === 'termine') {
    return traduire('invitations.envoi.termine');
  }
  if (ctx.limiteJusqua !== null && ctx.limiteJusqua > ctx.maintenant) {
    return traduire('invitations.envoi.limite', { heure: dateEnClair(new Date(ctx.limiteJusqua).toISOString(), 'heure') });
  }
  return null;
}

/** Peut recevoir un premier envoi : jamais invité (un premier envoi en échec se retente). */
export function aInviter(i: InvitationResponse): boolean {
  return !i.envoiEnCours && (i.statut === 'A_INVITER' || (i.statut === 'EN_ECHEC' && !i.premierEnvoiLe));
}

/** Peut être relancé : déjà invité, sans réponse, ni révoqué, ni en cours d'envoi. */
export function aRelancer(i: InvitationResponse): boolean {
  return !i.envoiEnCours && !!i.premierEnvoiLe && (i.statut === 'INVITEE' || i.statut === 'OUVERTE' || i.statut === 'EN_ECHEC');
}

/** Moment où la relance redevient possible pour cet invité (24 h après le dernier envoi), en ms. */
export function relancePossibleLe(i: InvitationResponse): number {
  return i.dernierEnvoiLe ? new Date(i.dernierEnvoiLe).getTime() + DELAI_RELANCE_MS : 0;
}

/** Pourquoi « Envoyer les invitations » est impossible, ou null. */
export function raisonEnvoiImpossible(ctx: ContexteEnvoi): string | null {
  const commune = raisonCommune(ctx);
  if (commune) {
    return commune;
  }
  if (ctx.selection.length) {
    return ctx.selection.some(aInviter) ? null : traduire('invitations.envoi.selectionDejaInvitee');
  }
  if (ctx.resume && ctx.resume.aInviter === 0 && ctx.resume.enEchec === 0) {
    return traduire(ctx.resume.total === 0 ? 'invitations.envoi.aucunInvite' : 'invitations.envoi.tousInvites');
  }
  return null;
}

/**
 * Pourquoi « Relancer » est impossible, ou null. Le délai de 24 h n'est connu à l'avance que pour la sélection (pour
 * « tous », les invités hors de la page affichée sont ignorés par le serveur : DELAI_RELANCE dans le rapport).
 */
export function raisonRelanceImpossible(ctx: ContexteEnvoi): string | null {
  const commune = raisonCommune(ctx);
  if (commune) {
    return commune;
  }
  if (ctx.selection.length) {
    const candidats = ctx.selection.filter(aRelancer);
    if (!candidats.length) {
      return traduire('invitations.relance.selectionAucune');
    }
    const prochaine = Math.min(...candidats.map(relancePossibleLe));
    if (prochaine > ctx.maintenant) {
      return traduire('invitations.relance.delai', { date: dateEnClair(new Date(prochaine).toISOString(), 'jourHeure') });
    }
    return null;
  }
  if (ctx.resume && ctx.resume.invitees + ctx.resume.ouvertes + ctx.resume.enEchec === 0) {
    return traduire('invitations.relance.aucune');
  }
  return null;
}
