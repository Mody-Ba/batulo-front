/** Rôles du jeton, identiques à l'enum Role du backend. */
export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'GESTIONNAIRE';

export const LIBELLES_ROLE: Record<Role, string> = {
  SUPER_ADMIN: 'Super administrateur',
  ADMIN: 'Administrateur',
  GESTIONNAIRE: 'Gestionnaire',
};

/** Page d'accueil de chaque rôle après la connexion. */
export const ACCUEIL_PAR_ROLE: Record<Role, string> = {
  SUPER_ADMIN: '/super-admin',
  ADMIN: '/admin',
  GESTIONNAIRE: '/gestionnaire',
};
