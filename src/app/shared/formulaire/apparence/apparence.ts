import { ApparenceResponse, COULEUR_DEFAUT } from '../../../core/models/personnalisation.model';
import { environment } from '../../../../environments/environment';
import { couleurTexte, couleurValide, normaliserCouleur } from '../../../core/utils/couleur';

/** Variables CSS d'une couleur d'entreprise ; rien (couleurs Batulo, thème clair ou sombre) sans personnalisation. */
export type VariablesApparence = Record<'--bt-marque' | '--bt-sur-marque', string>;

/**
 * Variables à poser sur le conteneur du formulaire. Appliquées seulement si la couleur est au format #RRGGBB et diffère
 * de la couleur Batulo par défaut (#005CBB) : sinon le thème garde son bleu, y compris en thème sombre. Couleur de
 * texte : celle du backend si elle est valide, sinon recalculée (même règle de contraste WCAG).
 */
export function variablesApparence(apparence: Pick<ApparenceResponse, 'couleurPrincipale' | 'couleurTexte'> | null | undefined): VariablesApparence | null {
  const couleur = apparence?.couleurPrincipale;
  if (!couleurValide(couleur) || normaliserCouleur(couleur) === COULEUR_DEFAUT) {
    return null;
  }
  const texte = couleurValide(apparence?.couleurTexte) ? normaliserCouleur(apparence.couleurTexte) : couleurTexte(couleur);
  return { '--bt-marque': normaliserCouleur(couleur), '--bt-sur-marque': texte };
}

/** Seul chemin de logo accepté : la route publique du backend suivie de son jeton (lettres, chiffres, tirets). */
const CHEMIN_LOGO = /^\/api\/public\/logos\/[A-Za-z0-9-]+$/;

/**
 * URL de logo à afficher. Le backend renvoie une URL absolue construite avec son APP_BASE_URL, qui peut désigner le
 * front (ex. http://localhost:4200) plutôt que l'API : l'hôte reçu est donc ignoré, seul le chemin
 * /api/public/logos/{jeton} est gardé et préfixé par environment.apiUrl (http://localhost:8090 avec npm start, vide
 * avec start:reseau et son proxy, l'API en production). Tout autre chemin, schéma ou caractère (javascript:, data:,
 * ../, requête…) est refusé. Exception : l'aperçu local d'un fichier choisi (blob: de cette page).
 */
export function urlLogoSure(url: string | null | undefined, apiUrl: string = environment.apiUrl): string | null {
  if (!url) {
    return null;
  }
  try {
    const origine = globalThis.location?.origin ?? 'http://localhost';
    const lue = new URL(url, origine);
    if (lue.protocol === 'blob:') {
      return new URL(lue.pathname).origin === origine ? lue.href : null;
    }
    if (lue.protocol !== 'http:' && lue.protocol !== 'https:') {
      return null;
    }
    if (lue.search || lue.hash || !CHEMIN_LOGO.test(lue.pathname)) {
      return null;
    }
    return `${apiUrl.replace(/\/+$/, '')}${lue.pathname}`;
  } catch {
    return null;
  }
}
