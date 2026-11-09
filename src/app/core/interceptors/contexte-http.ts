import { HttpContextToken } from '@angular/common/http';

/**
 * Requête que l'intercepteur laisse passer telle quelle : pas de jeton ajouté, pas de
 * rafraîchissement ni de redirection sur 401/403 (rafraîchissement, déconnexion).
 */
export const SANS_AUTHENTIFICATION = new HttpContextToken<boolean>(() => false);
