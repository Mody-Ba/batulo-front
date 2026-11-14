import { NotificationResponse } from '../../core/models/notification.model';
import { Role } from '../../core/models/role.model';

export interface LienNotification {
  commandes: string[];
  queryParams?: Record<string, string>;
  libelle: string;
}

/**
 * Page de l'élément concerné par une notification, selon son type et le rôle de la personne. Pour l'instant la page
 * de la rubrique (la notification n'a pas encore de référence vers l'élément précis) ; null s'il n'y en a pas.
 */
export function lienNotification(notification: Pick<NotificationResponse, 'type'>, role: Role | null): LienNotification | null {
  const superAdmin = role === 'SUPER_ADMIN';
  switch (notification.type) {
    case 'NOUVELLE_INSCRIPTION':
      return superAdmin ? { commandes: ['/super-admin/admins'], libelle: 'Voir les admins' } : null;
    case 'PAIEMENT_RECU':
    case 'ABONNEMENT_EXPIRE_BIENTOT':
    case 'ABONNEMENT_EXPIRE':
      if (superAdmin) {
        return { commandes: ['/super-admin/abonnements'], libelle: 'Voir les abonnements' };
      }
      return role === 'ADMIN' ? { commandes: ['/admin/abonnement'], libelle: 'Voir mon abonnement' } : null;
    case 'SONDAGE_ASSIGNE':
    case 'SONDAGE_DESASSIGNE':
      return role === 'ADMIN' || role === 'GESTIONNAIRE' ? { commandes: ['/sondages'], libelle: 'Voir les sondages' } : null;
    case 'NOUVEAU_MESSAGE':
      return { commandes: ['/messagerie'], libelle: 'Ouvrir la messagerie' };
    case 'STATISTIQUES_RECUES':
      return role === 'ADMIN' ? { commandes: ['/admin/statistiques-recues'], libelle: 'Voir les statistiques reçues' } : null;
    case 'DEMANDE_ABONNEMENT':
      return superAdmin
        ? { commandes: ['/super-admin/demandes-abonnement'], queryParams: { statut: 'EN_ATTENTE' }, libelle: 'Voir les demandes' }
        : null;
    case 'DEMANDE_ABONNEMENT_TRAITEE':
      return role === 'ADMIN' ? { commandes: ['/admin/abonnement/demandes'], libelle: 'Voir mes demandes' } : null;
    default:
      return null;
  }
}
