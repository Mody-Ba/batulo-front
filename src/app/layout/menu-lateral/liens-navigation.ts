import { Role } from '../../core/models/role.model';

export interface LienNavigation {
  /** Clé de traduction du libellé. */
  libelle: string;
  lien: string;
  /** Icône Material, décorative. */
  icone: string;
  /** Actif seulement sur cette adresse exacte (pas sur ses sous-pages). */
  exact?: boolean;
  /** Compteur affiché à côté du libellé (messages non lus, notifications non lues). */
  compteur?: 'messagerie' | 'notifications';
}

/**
 * Entrées du menu latéral par rôle (affichage seulement : le serveur protège les données).
 * Toutes les rubriques mènent à leur page (F8 : messagerie et notifications).
 */
export const LIENS_PAR_ROLE: Record<Role, readonly LienNavigation[]> = {
  SUPER_ADMIN: [
    { libelle: 'menu.tableauDeBord', lien: '/super-admin', icone: 'dashboard', exact: true },
    { libelle: 'menu.admins', lien: '/super-admin/admins', icone: 'business' },
    { libelle: 'menu.abonnements', lien: '/super-admin/abonnements', icone: 'card_membership' },
    { libelle: 'menu.demandesAbonnement', lien: '/super-admin/demandes-abonnement', icone: 'upgrade' },
    { libelle: 'menu.messagerie', lien: '/messagerie', icone: 'forum', compteur: 'messagerie' },
    { libelle: 'menu.notifications', lien: '/notifications', icone: 'notifications', compteur: 'notifications' },
  ],
  ADMIN: [
    { libelle: 'menu.tableauDeBord', lien: '/admin', icone: 'dashboard', exact: true },
    { libelle: 'menu.abonnement', lien: '/admin/abonnement', icone: 'card_membership' },
    { libelle: 'menu.gestionnaires', lien: '/admin/gestionnaires', icone: 'group' },
    { libelle: 'menu.sondages', lien: '/sondages', icone: 'ballot' },
    { libelle: 'menu.statistiquesRecues', lien: '/admin/statistiques-recues', icone: 'insights' },
    { libelle: 'menu.apparence', lien: '/apparence', icone: 'palette' },
    { libelle: 'menu.messagerie', lien: '/messagerie', icone: 'forum', compteur: 'messagerie' },
    { libelle: 'menu.notifications', lien: '/notifications', icone: 'notifications', compteur: 'notifications' },
  ],
  GESTIONNAIRE: [
    { libelle: 'menu.tableauDeBord', lien: '/gestionnaire', icone: 'dashboard', exact: true },
    { libelle: 'menu.mesSondages', lien: '/sondages', icone: 'ballot' },
    { libelle: 'menu.statistiquesEnvoyees', lien: '/gestionnaire/statistiques-envoyees', icone: 'outbox' },
    { libelle: 'menu.apparence', lien: '/apparence', icone: 'palette' },
    { libelle: 'menu.messagerie', lien: '/messagerie', icone: 'forum', compteur: 'messagerie' },
    { libelle: 'menu.notifications', lien: '/notifications', icone: 'notifications', compteur: 'notifications' },
  ],
};
