import { Role } from '../../core/models/role.model';

export interface LienNavigation {
  libelle: string;
  lien: string;
  /** Icône Material, décorative. */
  icone: string;
  /** Actif seulement sur cette adresse exacte (pas sur ses sous-pages). */
  exact?: boolean;
}

/**
 * Entrées du menu latéral par rôle (affichage seulement : le serveur protège les données).
 * Les rubriques des étapes suivantes mènent à une page « Bientôt disponible ».
 */
export const LIENS_PAR_ROLE: Record<Role, readonly LienNavigation[]> = {
  SUPER_ADMIN: [
    { libelle: 'Tableau de bord', lien: '/super-admin', icone: 'dashboard', exact: true },
    { libelle: 'Admins et entreprises', lien: '/super-admin/admins', icone: 'business' },
    { libelle: 'Abonnements', lien: '/super-admin/abonnements', icone: 'card_membership' },
    { libelle: 'Demandes d’abonnement', lien: '/super-admin/demandes-abonnement', icone: 'upgrade' },
    { libelle: 'Messagerie', lien: '/messagerie', icone: 'forum' },
    { libelle: 'Notifications', lien: '/notifications', icone: 'notifications' },
  ],
  ADMIN: [
    { libelle: 'Tableau de bord', lien: '/admin', icone: 'dashboard', exact: true },
    { libelle: 'Abonnement', lien: '/admin/abonnement', icone: 'card_membership' },
    { libelle: 'Gestionnaires', lien: '/admin/gestionnaires', icone: 'group' },
    { libelle: 'Sondages', lien: '/sondages', icone: 'ballot' },
    { libelle: 'Statistiques reçues', lien: '/admin/statistiques-recues', icone: 'insights' },
    { libelle: 'Messagerie', lien: '/messagerie', icone: 'forum' },
    { libelle: 'Notifications', lien: '/notifications', icone: 'notifications' },
  ],
  GESTIONNAIRE: [
    { libelle: 'Tableau de bord', lien: '/gestionnaire', icone: 'dashboard', exact: true },
    { libelle: 'Mes sondages', lien: '/sondages', icone: 'ballot' },
    { libelle: 'Messagerie', lien: '/messagerie', icone: 'forum' },
    { libelle: 'Notifications', lien: '/notifications', icone: 'notifications' },
  ],
};
