import { NotificationResponse } from '../../core/models/notification.model';
import { Role } from '../../core/models/role.model';

export interface LienNotification {
  commandes: (string | number)[];
  queryParams?: Record<string, string>;
  libelle: string;
}

/**
 * Élément concerné par une notification, selon son type et le rôle : l'élément précis quand la notification porte
 * sa référence (referenceId, conversationId), sinon la page de la rubrique (anciennes notifications) ; null s'il n'y
 * en a pas. Un abonnement n'a pas de page à lui : la liste de la rubrique.
 */
export function lienNotification(
  notification: Pick<NotificationResponse, 'type' | 'referenceId' | 'conversationId'>,
  role: Role | null,
): LienNotification | null {
  const superAdmin = role === 'SUPER_ADMIN';
  const ref = notification.referenceId ?? null;
  switch (notification.type) {
    case 'NOUVELLE_INSCRIPTION':
      return superAdmin
        ? { commandes: ['/super-admin/admins'], queryParams: { statut: 'EN_ATTENTE_PAIEMENT' }, libelle: 'Voir les inscriptions' }
        : null;
    case 'PAIEMENT_RECU':
    case 'ABONNEMENT_EXPIRE_BIENTOT':
    case 'ABONNEMENT_EXPIRE':
      if (superAdmin) {
        return { commandes: ['/super-admin/abonnements'], libelle: 'Voir les abonnements' };
      }
      return role === 'ADMIN' ? { commandes: ['/admin/abonnement'], libelle: 'Voir mon abonnement' } : null;
    case 'SONDAGE_ASSIGNE':
      if (ref !== null && (role === 'ADMIN' || role === 'GESTIONNAIRE')) {
        return { commandes: ['/sondages', ref], libelle: 'Ouvrir le sondage' };
      }
      return role === 'ADMIN' || role === 'GESTIONNAIRE' ? { commandes: ['/sondages'], libelle: 'Voir les sondages' } : null;
    case 'SONDAGE_DESASSIGNE':
      // Le sondage n'est plus visible : la liste.
      return role === 'ADMIN' || role === 'GESTIONNAIRE' ? { commandes: ['/sondages'], libelle: 'Voir les sondages' } : null;
    case 'NOUVEAU_MESSAGE':
      return notification.conversationId != null
        ? { commandes: ['/messagerie', notification.conversationId], libelle: 'Ouvrir la conversation' }
        : { commandes: ['/messagerie'], libelle: 'Ouvrir la messagerie' };
    case 'STATISTIQUES_RECUES':
      if (role !== 'ADMIN') {
        return null;
      }
      return ref !== null
        ? { commandes: ['/admin/statistiques-recues', ref], libelle: 'Ouvrir les statistiques' }
        : { commandes: ['/admin/statistiques-recues'], libelle: 'Voir les statistiques reçues' };
    case 'DEMANDE_ABONNEMENT':
      if (!superAdmin) {
        return null;
      }
      return ref !== null
        ? { commandes: ['/super-admin/demandes-abonnement'], queryParams: { demande: String(ref) }, libelle: 'Ouvrir la demande' }
        : { commandes: ['/super-admin/demandes-abonnement'], queryParams: { statut: 'EN_ATTENTE' }, libelle: 'Voir les demandes' };
    case 'DEMANDE_ABONNEMENT_TRAITEE':
      if (role !== 'ADMIN') {
        return null;
      }
      return ref !== null
        ? { commandes: ['/admin/abonnement/demandes'], queryParams: { demande: String(ref) }, libelle: 'Voir la réponse' }
        : { commandes: ['/admin/abonnement/demandes'], libelle: 'Voir mes demandes' };
    default:
      return null;
  }
}
