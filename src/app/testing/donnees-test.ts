import { AbonnementResponse } from '../core/models/abonnement.model';
import { GestionnaireResponse } from '../core/models/gestionnaire.model';
import { SondageResumeResponse } from '../core/models/sondage.model';
import { TableauDeBordResponse } from '../core/models/tableau-de-bord.model';

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

export function gestionnaireDeTest(modifs: Partial<GestionnaireResponse> = {}): GestionnaireResponse {
  return {
    id: 7,
    prenom: 'Moussa',
    nom: 'Kane',
    courriel: 'moussa@test.local',
    role: 'GESTIONNAIRE',
    entrepriseId: 1,
    entreprise: 'Entreprise Test',
    actif: true,
    motDePasseTemporaire: false,
    motDePasseTemporaireExpireLe: null,
    peutCreerSondages: false,
    dateCreation: '2026-11-01T12:00:00Z',
    ...modifs,
  };
}

export function sondageResumeDeTest(modifs: Partial<SondageResumeResponse> = {}): SondageResumeResponse {
  return {
    id: 1,
    titre: 'Satisfaction',
    description: null,
    statut: 'EN_COURS',
    publie: true,
    datePublication: '2026-11-01T12:00:00Z',
    dateFermeture: null,
    version: 1,
    estModele: false,
    creePar: { id: 1, prenom: 'Awa', nom: 'Diop' },
    nombreSections: 1,
    nombreQuestions: 3,
    nombreReponses: 0,
    nombreReponsesLignee: 0,
    gestionnairesAssignes: [],
    brouillonEnPreparation: false,
    brouillonEnPreparationId: null,
    dateCreation: '2026-11-01T12:00:00Z',
    dateModification: '2026-11-01T12:00:00Z',
    ...modifs,
  };
}

export function tableauDeBordDeTest(modifs: Partial<TableauDeBordResponse> = {}): TableauDeBordResponse {
  return {
    abonnement: { formule: 'MENSUEL', statut: 'ACTIF', dateExpiration: '2026-12-01T12:00:00Z', joursRestants: 23 },
    gestionnaires: { actifs: 4, desactives: 1 },
    sondages: { NON_COMMENCE: 2, EN_COURS: 3, TERMINE: 5 },
    nombreTotalReponses: 125,
    ...modifs,
  };
}
