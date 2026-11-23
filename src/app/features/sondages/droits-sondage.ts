import { Role } from '../../core/models/role.model';
import { SondageResponse } from '../../core/models/sondage.model';
import { UtilisateurResponse } from '../../core/models/utilisateur.model';
import { messageLectureSeule } from '../../core/services/auth.service';
import { traduire } from '../../core/i18n/traduire';

export const messageSondagePublie = (): string => traduire('sondages.droits.publie');
export const messageSondageFerme = (): string => traduire('sondages.droits.ferme');
export const messageReserveCreateur = (): string => traduire('sondages.droits.reserveCreateur');
export const messageSansPermission = (): string => traduire('sondages.droits.sansPermission');

export interface ContexteDroits {
  role: Role | null;
  utilisateur: UtilisateurResponse | null;
  /** Abonnement expiré (AuthService.lectureSeule). */
  lectureSeule: boolean;
}

/**
 * Pourquoi le contenu de ce sondage n'est pas modifiable par l'utilisateur, ou null s'il l'est. Affichage
 * seulement : le serveur décide (403 PERMISSION_SONDAGES_REQUISE, ACTION_RESERVEE_CREATEUR, 409 SONDAGE_PUBLIE).
 * Règles : brouillon ; abonnement non expiré ; admin, ou gestionnaire créateur de cette version avec la permission.
 */
export function raisonLectureSeule(
  sondage: Pick<SondageResponse, 'publie' | 'statut' | 'creePar'>,
  { role, utilisateur, lectureSeule }: ContexteDroits,
): string | null {
  if (sondage.publie) {
    return sondage.statut === 'TERMINE' ? messageSondageFerme() : messageSondagePublie();
  }
  if (lectureSeule) {
    return messageLectureSeule();
  }
  if (role === 'ADMIN') {
    return null;
  }
  if (role !== 'GESTIONNAIRE' || !utilisateur) {
    return messageReserveCreateur();
  }
  if (!utilisateur.peutCreerSondages) {
    return messageSansPermission();
  }
  return sondage.creePar?.id === utilisateur.id ? null : messageReserveCreateur();
}

/** Ce que l'utilisateur peut faire d'un sondage (affichage seulement : le serveur décide). */
export interface DroitsSondage {
  /** Modifier le contenu (brouillon seulement). */
  modifierContenu: boolean;
  /** Publier, fermer, nouvelle version, dates, modèle, critères : admin ou gestionnaire créateur avec la permission. */
  gerer: boolean;
  /** Dupliquer : admin, ou gestionnaire avec la permission qui voit le sondage (même seulement assigné). */
  dupliquer: boolean;
  /** Tous ceux qui voient le sondage. */
  previsualiser: boolean;
  /** Lien et QR code : sondage déjà publié, pour tous ceux qui le voient. */
  diffuser: boolean;
}

/**
 * Droits sur un sondage. Gérer ne dépend pas du statut (fermer un sondage publié, régler un critère après
 * publication) ; l'abonnement expiré interdit toute écriture (lecture seule côté backend).
 */
export function droitsSondage(
  sondage: Pick<SondageResponse, 'publie' | 'statut' | 'creePar'>,
  { role, utilisateur, lectureSeule }: ContexteDroits,
): DroitsSondage {
  const permission = role === 'ADMIN' || (role === 'GESTIONNAIRE' && !!utilisateur?.peutCreerSondages);
  const createur = role === 'ADMIN' || (!!utilisateur && sondage.creePar?.id === utilisateur.id);
  const ecriture = permission && !lectureSeule;
  return {
    modifierContenu: raisonLectureSeule(sondage, { role, utilisateur, lectureSeule }) === null,
    gerer: ecriture && createur,
    dupliquer: ecriture,
    previsualiser: true,
    diffuser: sondage.publie,
  };
}
