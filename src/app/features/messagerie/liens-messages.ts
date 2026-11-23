import { MessageInterneResponse } from '../../core/models/messagerie.model';
import { Role } from '../../core/models/role.model';
import { traduire } from '../../core/i18n/traduire';

/** Lien d'un message automatique vers l'élément concerné, selon le rôle de la personne qui le lit. */
export interface LienMessage {
  commandes: (string | number)[];
  queryParams?: Record<string, string>;
  libelle: string;
}

/**
 * STATISTIQUES (referenceId = envoi) : l'admin ouvre les statistiques reçues, le gestionnaire son envoi.
 * DEMANDE_ABONNEMENT, REPONSE_DEMANDE (referenceId = demande) : l'admin voit la demande dans « Mes demandes », le
 * super admin ouvre son détail (?demande= sur la liste des demandes).
 */
export function lienMessage(message: MessageInterneResponse, role: Role | null): LienMessage | null {
  switch (message.type) {
    case 'STATISTIQUES':
      if (role === 'ADMIN' && message.referenceId !== null) {
        return { commandes: ['/admin/statistiques-recues', message.referenceId], libelle: traduire('notifications.liens.ouvrirStatistiques') };
      }
      if (role === 'GESTIONNAIRE') {
        return message.referenceId !== null
          ? { commandes: ['/gestionnaire/statistiques-envoyees', message.referenceId], libelle: traduire('messagerie.liens.voirEnvoi') }
          : { commandes: ['/gestionnaire/statistiques-envoyees'], libelle: traduire('messagerie.liens.voirEnvois') };
      }
      return null;
    case 'DEMANDE_ABONNEMENT':
    case 'REPONSE_DEMANDE': {
      const demande = message.referenceId !== null ? { demande: String(message.referenceId) } : undefined;
      if (role === 'ADMIN') {
        return { commandes: ['/admin/abonnement/demandes'], queryParams: demande, libelle: traduire('messagerie.liens.voirDemande') };
      }
      return role === 'SUPER_ADMIN'
        ? { commandes: ['/super-admin/demandes-abonnement'], queryParams: demande, libelle: traduire('notifications.liens.ouvrirDemande') }
        : null;
    }
    default:
      return null;
  }
}
