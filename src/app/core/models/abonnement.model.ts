/** Statut effectif de l'abonnement d'une entreprise (enum StatutAbonnement du backend). */
export type StatutAbonnement =
  | 'EN_ATTENTE_PAIEMENT'
  | 'ACTIF'
  | 'EXPIRE_BIENTOT'
  | 'EXPIRE'
  | 'DESACTIVE';

export const LIBELLES_STATUT_ABONNEMENT: Record<StatutAbonnement, string> = {
  EN_ATTENTE_PAIEMENT: 'En attente de paiement',
  ACTIF: 'Actif',
  EXPIRE_BIENTOT: 'Expire bientôt',
  EXPIRE: 'Expiré',
  DESACTIVE: 'Désactivé',
};
