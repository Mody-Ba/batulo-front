import { Formule, StatutAbonnement } from './abonnement.model';
import { StatutSondage } from './sondage.model';

/**
 * GET /api/admin/tableau-de-bord (ADMIN, entreprise du jeton). Un sondage = une lignée, compté au statut de sa
 * dernière version publiée en cours ou terminée, sinon de son brouillon : les brouillons sont donc dans
 * NON_COMMENCE. Réponses : toutes versions confondues.
 */
export interface TableauDeBordResponse {
  /** Null si l'entreprise n'a pas d'abonnement. Statut recalculé à partir des dates. */
  abonnement: {
    formule: Formule | null;
    statut: StatutAbonnement;
    dateExpiration: string | null;
    joursRestants: number | null;
  } | null;
  gestionnaires: { actifs: number; desactives: number };
  sondages: Record<StatutSondage, number>;
  nombreTotalReponses: number;
}
