import { NotificationResponse } from '../../core/models/notification.model';
import { Role } from '../../core/models/role.model';
import { traduire } from '../../core/i18n/traduire';

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
        ? { commandes: ['/super-admin/admins'], queryParams: { statut: 'EN_ATTENTE_PAIEMENT' }, libelle: traduire('notifications.liens.voirInscriptions') }
        : null;
    case 'PAIEMENT_RECU':
    case 'ABONNEMENT_EXPIRE_BIENTOT':
    case 'ABONNEMENT_EXPIRE':
      if (superAdmin) {
        return { commandes: ['/super-admin/abonnements'], libelle: traduire('notifications.liens.voirAbonnements') };
      }
      return role === 'ADMIN' ? { commandes: ['/admin/abonnement'], libelle: traduire('notifications.liens.voirMonAbonnement') } : null;
    case 'SONDAGE_ASSIGNE':
      if (ref !== null && (role === 'ADMIN' || role === 'GESTIONNAIRE')) {
        return { commandes: ['/sondages', ref], libelle: traduire('notifications.liens.ouvrirSondage') };
      }
      return role === 'ADMIN' || role === 'GESTIONNAIRE' ? { commandes: ['/sondages'], libelle: traduire('notifications.liens.voirSondages') } : null;
    case 'SONDAGE_DESASSIGNE':
      // Le sondage n'est plus visible : la liste.
      return role === 'ADMIN' || role === 'GESTIONNAIRE' ? { commandes: ['/sondages'], libelle: traduire('notifications.liens.voirSondages') } : null;
    case 'NOUVEAU_MESSAGE':
      return notification.conversationId != null
        ? { commandes: ['/messagerie', notification.conversationId], libelle: traduire('notifications.liens.ouvrirConversation') }
        : { commandes: ['/messagerie'], libelle: traduire('notifications.liens.ouvrirMessagerie') };
    case 'STATISTIQUES_RECUES':
      if (role !== 'ADMIN') {
        return null;
      }
      return ref !== null
        ? { commandes: ['/admin/statistiques-recues', ref], libelle: traduire('notifications.liens.ouvrirStatistiques') }
        : { commandes: ['/admin/statistiques-recues'], libelle: traduire('notifications.liens.voirStatistiquesRecues') };
    case 'DEMANDE_ABONNEMENT':
      if (!superAdmin) {
        return null;
      }
      return ref !== null
        ? { commandes: ['/super-admin/demandes-abonnement'], queryParams: { demande: String(ref) }, libelle: traduire('notifications.liens.ouvrirDemande') }
        : { commandes: ['/super-admin/demandes-abonnement'], queryParams: { statut: 'EN_ATTENTE' }, libelle: traduire('notifications.liens.voirDemandes') };
    case 'DEMANDE_ABONNEMENT_TRAITEE':
      if (role !== 'ADMIN') {
        return null;
      }
      return ref !== null
        ? { commandes: ['/admin/abonnement/demandes'], queryParams: { demande: String(ref) }, libelle: traduire('notifications.liens.voirReponse') }
        : { commandes: ['/admin/abonnement/demandes'], libelle: traduire('notifications.liens.voirMesDemandes') };
    default:
      return null;
  }
}
