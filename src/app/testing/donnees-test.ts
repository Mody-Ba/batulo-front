import { AbonnementResponse } from '../core/models/abonnement.model';

/** Données partagées par les tests unitaires. */
export function abonnementDeTest(modifs: Partial<AbonnementResponse> = {}): AbonnementResponse {
  return {
    id: 1,
    entrepriseId: 1,
    entreprise: 'Entreprise Test',
    formule: 'MENSUEL',
    statut: 'ACTIF',
    dateDebut: '2026-11-01T12:00:00Z',
    dateExpiration: '2026-12-01T12:00:00Z',
    joursRestants: 23,
    montant: 1,
    devise: 'cad',
    ...modifs,
  };
}
