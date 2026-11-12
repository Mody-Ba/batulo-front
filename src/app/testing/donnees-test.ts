import { AbonnementResponse } from '../core/models/abonnement.model';
import { DemandeAbonnementResponse } from '../core/models/demande-abonnement.model';
import { GestionnaireResponse } from '../core/models/gestionnaire.model';
import { SondageResumeResponse } from '../core/models/sondage.model';
import {
  AbonnementAdminResponse,
  AdminDetailResponse,
  AdminLigneResponse,
  CompteAdmin,
  TableauDeBordSuperAdminResponse,
} from '../core/models/super-admin.model';
import { TableauDeBordResponse } from '../core/models/tableau-de-bord.model';
import { UtilisateurResponse } from '../core/models/utilisateur.model';

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

export function adminDeTest(modifs: Partial<UtilisateurResponse> = {}): UtilisateurResponse {
  return {
    id: 3,
    prenom: 'Fatou',
    nom: 'Sow',
    courriel: 'fatou@test.local',
    role: 'ADMIN',
    entrepriseId: 1,
    entreprise: 'Entreprise Test',
    actif: true,
    motDePasseTemporaire: false,
    motDePasseTemporaireExpireLe: null,
    peutCreerSondages: true,
    dateCreation: '2026-10-01T12:00:00Z',
    ...modifs,
  };
}

export function adminDetailDeTest(modifs: Partial<AdminDetailResponse> = {}): AdminDetailResponse {
  return { admin: adminDeTest(), abonnement: abonnementDeTest(), nombreGestionnaires: 4, ...modifs };
}

export function abonnementAdminDeTest(modifs: Partial<AbonnementAdminResponse> = {}): AbonnementAdminResponse {
  return {
    abonnement: abonnementDeTest(),
    adminId: 3,
    adminPrenom: 'Fatou',
    adminNom: 'Sow',
    adminCourriel: 'fatou@test.local',
    ...modifs,
  };
}

export function demandeDeTest(modifs: Partial<DemandeAbonnementResponse> = {}): DemandeAbonnementResponse {
  return {
    id: 11,
    entrepriseId: 1,
    entreprise: 'Entreprise Test',
    adminId: 3,
    adminNom: 'Fatou Sow',
    adminCourriel: 'fatou@test.local',
    formuleSouhaitee: 'ANNUEL',
    formuleActuelle: 'MENSUEL',
    statutAbonnement: 'ACTIF',
    message: 'Pouvons-nous passer à l’annuel ?',
    statut: 'EN_ATTENTE',
    reponse: null,
    traiteeParNom: null,
    dateDemande: '2026-11-10T12:00:00Z',
    dateTraitement: null,
    ...modifs,
  };
}

export function compteAdminDeTest(modifs: Partial<CompteAdmin> = {}): CompteAdmin {
  return {
    id: 3,
    prenom: 'Fatou',
    nom: 'Sow',
    courriel: 'fatou@test.local',
    actif: true,
    entreprise: 'Entreprise Test',
    ...modifs,
  };
}

export function adminLigneDeTest(modifs: Partial<AdminLigneResponse> = {}): AdminLigneResponse {
  return {
    entreprise: { id: 1, nom: 'Entreprise Test', actif: true },
    admin: {
      id: 3,
      prenom: 'Fatou',
      nom: 'Sow',
      courriel: 'fatou@test.local',
      actif: true,
      motDePasseTemporaire: false,
      motDePasseTemporaireExpireLe: null,
      dateCreation: '2026-10-01T12:00:00Z',
    },
    abonnement: { formule: 'MENSUEL', statut: 'ACTIF', dateExpiration: '2026-12-01T12:00:00Z', joursRestants: 23 },
    nombreGestionnaires: 4,
    ...modifs,
  };
}

export function tableauDeBordSuperAdminDeTest(
  modifs: Partial<TableauDeBordSuperAdminResponse> = {},
): TableauDeBordSuperAdminResponse {
  return {
    entreprises: { total: 12, actif: 6, expireBientot: 2, expire: 1, enAttentePaiement: 2, desactive: 1 },
    demandesAugmentationEnAttente: 3,
    ...modifs,
  };
}
