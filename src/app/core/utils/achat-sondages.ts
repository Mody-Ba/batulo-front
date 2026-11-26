import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { CreditsResponse, FormuleResponse, StatutAbonnement } from '../models/abonnement.model';

/** Bornes d'un achat (quantiteMin et quantiteMax de /formules), valeurs du backend si elles manquent. */
export const REGLES_ACHAT = { quantiteMin: 1, quantiteMax: 1000 } as const;

export interface BornesAchat {
  min: number;
  max: number;
}

/** Bornes de l'offre d'achat lue dans /formules. */
export function bornesAchat(offre: Pick<FormuleResponse, 'quantiteMin' | 'quantiteMax'> | null | undefined): BornesAchat {
  return {
    min: offre?.quantiteMin ?? REGLES_ACHAT.quantiteMin,
    max: offre?.quantiteMax ?? REGLES_ACHAT.quantiteMax,
  };
}

/** Quantité acceptée par le serveur : entier entre les bornes (400 QUANTITE_INVALIDE sinon). */
export function quantiteValide(quantite: unknown, bornes: BornesAchat = bornesAchat(null)): quantite is number {
  return typeof quantite === 'number' && Number.isInteger(quantite) && quantite >= bornes.min && quantite <= bornes.max;
}

/**
 * Total affiché d'un achat (le serveur calcule le montant facturé) : quantité × prix d'un sondage, au centime près
 * (calcul en centimes, sans erreur d'arrondi des nombres à virgule : 1000 × 4,99 = 4990) ; en MRU, des entiers.
 * Null si la quantité n'est pas valide ou le prix inconnu.
 */
export function totalAchat(
  prixUnitaire: number | null | undefined,
  quantite: unknown,
  devise: string | null | undefined,
  bornes: BornesAchat = bornesAchat(null),
): number | null {
  if (prixUnitaire == null || !Number.isFinite(prixUnitaire) || !quantiteValide(quantite, bornes)) {
    return null;
  }
  if (devise?.toUpperCase() === 'MRU') {
    return Math.round(prixUnitaire * quantite);
  }
  return (Math.round(prixUnitaire * 100) * quantite) / 100;
}

/** Validateur du champ « nombre de sondages » ; bornes relues à chaque validation (elles viennent de l'API). */
export function validateurQuantite(bornes: () => BornesAchat): ValidatorFn {
  return (controle: AbstractControl): ValidationErrors | null => {
    const valeur = controle.value as number | null | '';
    if (valeur === null || valeur === '' || Number.isNaN(valeur)) {
      return { quantiteRequise: true };
    }
    const { min, max } = bornes();
    if (!Number.isInteger(valeur)) {
      return { quantiteEntiere: true };
    }
    if (valeur < min) {
      return { quantiteMin: { min } };
    }
    if (valeur > max) {
      return { quantiteMax: { max } };
    }
    return null;
  };
}

/** Abonnement en cours : publication illimitée, aucun solde à montrer. */
export function abonnementIllimite(statut: StatutAbonnement | null | undefined): boolean {
  return statut === 'ACTIF' || statut === 'EXPIRE_BIENTOT';
}

/**
 * Solde à afficher (« Sondages disponibles : X ») : seulement sans abonnement en cours et pour une entreprise qui a
 * déjà acheté des sondages ; null sinon (un abonné publie sans limite).
 */
export function soldeAAfficher(statut: StatutAbonnement | null | undefined, credits: CreditsResponse | null | undefined): number | null {
  if (abonnementIllimite(statut) || !credits?.compteCredits) {
    return null;
  }
  return credits.solde;
}
