import { MessageInterneResponse } from '../../core/models/messagerie.model';
import { Role } from '../../core/models/role.model';

/** Lien d'un message automatique vers l'élément concerné, selon le rôle de la personne qui le lit. */
export interface LienMessage {
  commandes: (string | number)[];
  queryParams?: Record<string, string>;
  libelle: string;
}

/**
 * STATISTIQUES (referenceId = envoi) : l'admin ouvre les statistiques reçues ; le gestionnaire, ses envois.
 * DEMANDE_ABONNEMENT, REPONSE_DEMANDE (referenceId = demande) : l'admin, ses demandes ; le super admin, les demandes
 * en attente (la demande précise s'ouvrira quand le backend aura GET /api/super-admin/demandes-abonnement/{id}).
 */
export function lienMessage(message: MessageInterneResponse, role: Role | null): LienMessage | null {
  switch (message.type) {
    case 'STATISTIQUES':
      if (role === 'ADMIN' && message.referenceId !== null) {
        return { commandes: ['/admin/statistiques-recues', message.referenceId], libelle: 'Ouvrir les statistiques' };
      }
      return role === 'GESTIONNAIRE'
        ? { commandes: ['/gestionnaire/statistiques-envoyees'], libelle: 'Voir mes envois' }
        : null;
    case 'DEMANDE_ABONNEMENT':
    case 'REPONSE_DEMANDE':
      if (role === 'ADMIN') {
        return { commandes: ['/admin/abonnement/demandes'], libelle: 'Voir mes demandes' };
      }
      return role === 'SUPER_ADMIN'
        ? { commandes: ['/super-admin/demandes-abonnement'], libelle: 'Voir les demandes d’abonnement' }
        : null;
    default:
      return null;
  }
}
