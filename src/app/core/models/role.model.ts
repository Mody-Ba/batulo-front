import { libelles } from '../i18n/traduire';

/** Rôles du jeton, identiques à l'enum Role du backend. */
export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'GESTIONNAIRE';

/** Libellés traduits (relus dans la langue courante à chaque lecture). */
export const LIBELLES_ROLE = libelles<Role>('roles', ['SUPER_ADMIN', 'ADMIN', 'GESTIONNAIRE']);

/** Page d'accueil de chaque rôle après la connexion. */
export const ACCUEIL_PAR_ROLE: Record<Role, string> = {
  SUPER_ADMIN: '/super-admin',
  ADMIN: '/admin',
  GESTIONNAIRE: '/gestionnaire',
};
