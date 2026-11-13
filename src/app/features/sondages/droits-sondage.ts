import { Role } from '../../core/models/role.model';
import { SondageResponse } from '../../core/models/sondage.model';
import { UtilisateurResponse } from '../../core/models/utilisateur.model';
import { MESSAGE_LECTURE_SEULE } from '../../core/services/auth.service';

export const MESSAGE_SONDAGE_PUBLIE =
  'Ce sondage est publié : son contenu est figé pour ne pas fausser les réponses. Pour le modifier, il faudra en ' +
  'créer une nouvelle version (bientôt disponible).';
export const MESSAGE_SONDAGE_FERME =
  'Ce sondage est fermé : son contenu ne se modifie plus. Pour le réutiliser, il faudra en créer une nouvelle ' +
  'version (bientôt disponible).';
export const MESSAGE_RESERVE_CREATEUR =
  'Vous pouvez consulter ce sondage, mais seuls son créateur et l’admin peuvent le modifier.';
export const MESSAGE_SANS_PERMISSION =
  'Votre admin ne vous a pas donné la permission de créer ou modifier des sondages.';

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
    return sondage.statut === 'TERMINE' ? MESSAGE_SONDAGE_FERME : MESSAGE_SONDAGE_PUBLIE;
  }
  if (lectureSeule) {
    return MESSAGE_LECTURE_SEULE;
  }
  if (role === 'ADMIN') {
    return null;
  }
  if (role !== 'GESTIONNAIRE' || !utilisateur) {
    return MESSAGE_RESERVE_CREATEUR;
  }
  if (!utilisateur.peutCreerSondages) {
    return MESSAGE_SANS_PERMISSION;
  }
  return sondage.creePar?.id === utilisateur.id ? null : MESSAGE_RESERVE_CREATEUR;
}
