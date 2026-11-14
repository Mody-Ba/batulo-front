import { effacerLocal, ecrireLocal, lireLocal, nouvelUuid } from '../../../core/utils/stockage-local';
import { ReponsesParQuestion } from '../../../shared/formulaire/formulaire-sondage';

/** Un brouillon plus ancien est oublié. */
export const DUREE_BROUILLON_JOURS = 30;

export interface BrouillonReponses {
  enregistreLe: string;
  /** Section où reprendre. */
  section: number;
  /** Réponses par id de question (celles d'une autre version sont ignorées à la reprise). */
  reponses: ReponsesParQuestion;
}

const cle = (type: 'repondant' | 'brouillon' | 'repondu', jeton: string) => `batulo.${type}.${jeton}`;

/** Jetons tirés quand le navigateur refuse le stockage : stables pendant la visite de la page. */
const jetonsEnMemoire = new Map<string, string>();

/**
 * Mémoire du navigateur pour un sondage (le jeton du lien désigne la lignée) : jetonRepondant, brouillon, drapeau
 * « déjà répondu ». Tout passe par stockage-local (try/catch) : sans stockage, le formulaire marche quand même, on
 * perd seulement la reprise du brouillon et le drapeau.
 */
export const memoireRepondant = {
  /**
   * UUID de cet appareil pour CE sondage (un par lignée, jamais partagé entre sondages : le même UUID haché dans
   * plusieurs sondages permettrait de relier les réponses d'une même personne). Créé à la première demande.
   */
  jetonRepondant(jeton: string): string {
    const existant = lireLocal<string>(cle('repondant', jeton)) ?? jetonsEnMemoire.get(jeton);
    if (existant) {
      return existant;
    }
    const uuid = nouvelUuid();
    if (!ecrireLocal(cle('repondant', jeton), uuid)) {
      jetonsEnMemoire.set(jeton, uuid);
    }
    return uuid;
  },

  lireBrouillon(jeton: string, maintenant = Date.now()): BrouillonReponses | null {
    const brouillon = lireLocal<BrouillonReponses>(cle('brouillon', jeton));
    if (!brouillon || typeof brouillon.reponses !== 'object' || brouillon.reponses === null) {
      return null;
    }
    // Âge négatif toléré (horloge de l'appareil reculée) : seul un brouillon trop vieux ou illisible est oublié.
    const age = maintenant - new Date(brouillon.enregistreLe).getTime();
    if (Number.isNaN(age) || age > DUREE_BROUILLON_JOURS * 86_400_000) {
      effacerLocal(cle('brouillon', jeton));
      return null;
    }
    return brouillon;
  },

  ecrireBrouillon(jeton: string, section: number, reponses: ReponsesParQuestion): void {
    if (Object.keys(reponses).length === 0) {
      effacerLocal(cle('brouillon', jeton));
      return;
    }
    ecrireLocal(cle('brouillon', jeton), { enregistreLe: new Date().toISOString(), section, reponses });
  },

  effacerBrouillon(jeton: string): void {
    effacerLocal(cle('brouillon', jeton));
  },

  /** Sondage à réponse unique déjà envoyé depuis ce navigateur (le 409 DEJA_REPONDU du serveur reste la règle). */
  dejaRepondu(jeton: string): boolean {
    return lireLocal<{ le: string }>(cle('repondu', jeton)) !== null;
  },

  marquerRepondu(jeton: string): void {
    ecrireLocal(cle('repondu', jeton), { le: new Date().toISOString() });
  },
};
