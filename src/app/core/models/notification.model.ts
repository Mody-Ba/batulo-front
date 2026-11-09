/** Types de notifications du tableau de bord (enum TypeNotification du backend). */
export type TypeNotification =
  | 'NOUVELLE_INSCRIPTION'
  | 'PAIEMENT_RECU'
  | 'ABONNEMENT_EXPIRE_BIENTOT'
  | 'ABONNEMENT_EXPIRE'
  | 'SONDAGE_ASSIGNE'
  | 'SONDAGE_DESASSIGNE'
  | 'NOUVEAU_MESSAGE'
  | 'STATISTIQUES_RECUES'
  | 'DEMANDE_ABONNEMENT'
  | 'DEMANDE_ABONNEMENT_TRAITEE';

/** Icône Material de chaque type (décorative). */
export const ICONES_NOTIFICATION: Record<TypeNotification, string> = {
  NOUVELLE_INSCRIPTION: 'person_add',
  PAIEMENT_RECU: 'payments',
  ABONNEMENT_EXPIRE_BIENTOT: 'schedule',
  ABONNEMENT_EXPIRE: 'event_busy',
  SONDAGE_ASSIGNE: 'assignment_ind',
  SONDAGE_DESASSIGNE: 'assignment_return',
  NOUVEAU_MESSAGE: 'mail',
  STATISTIQUES_RECUES: 'insights',
  DEMANDE_ABONNEMENT: 'upgrade',
  DEMANDE_ABONNEMENT_TRAITEE: 'task_alt',
};

/** GET /api/notifications (éléments de la page) */
export interface NotificationResponse {
  id: number;
  type: TypeNotification;
  titre: string;
  message: string;
  lue: boolean;
  dateCreation: string;
}

/** GET /api/notifications/non-lues/nombre */
export interface NombreNonLuesResponse {
  nonLues: number;
}

/** PATCH /api/notifications/lues */
export interface NotificationsMarqueesResponse {
  message: string;
  nombreMarquees: number;
}
