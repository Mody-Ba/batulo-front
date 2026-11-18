/**
 * Personnalisation de l'entreprise (phase 4, étape 2) : logo, couleur principale et nom affiché sur les formulaires.
 * Copie des records du backend (PersonnalisationResponse, LogoInfoResponse, PersonnalisationRequest, ApparenceResponse).
 */

/** GET /api/public/logos/{jeton} : URL publique, régénérée à chaque remplacement. */
export interface LogoInfoResponse {
  url: string;
  /** image/png ou image/jpeg. */
  typeMime: string;
  /** En octets. */
  taille: number;
  largeur: number;
  hauteur: number;
  dateModification: string;
}

/**
 * GET /api/entreprise/personnalisation (admin et gestionnaires) ; réponse des écritures (admin). Champs vides absents
 * du JSON (NON_NULL).
 */
export interface PersonnalisationResponse {
  /** Nom de l'entreprise (compte). */
  nomEntreprise: string;
  /** Nom affiché saisi par l'admin ; absent : le nom de l'entreprise est utilisé. */
  nomAffiche?: string | null;
  /** Nom réellement affiché aux répondants et dans les rapports. */
  nomEffectif: string;
  /** Couleur saisie (#RRGGBB) ; absente : couleur Batulo par défaut. */
  couleurPrincipale?: string | null;
  /** Couleur réellement utilisée (#RRGGBB). */
  couleurEffective: string;
  /** #FFFFFF ou #000000 : texte lisible sur la couleur effective (contraste WCAG). */
  couleurTexte: string;
  /** Absent : pas de logo. */
  logo?: LogoInfoResponse | null;
}

/** PUT /api/admin/personnalisation. Champ absent : inchangé ; "" : effacé (valeur par défaut). 400 COULEUR_INVALIDE. */
export interface PersonnalisationRequest {
  nomAffiche?: string;
  couleurPrincipale?: string;
}

/** Apparence d'un formulaire (public et aperçu) : valeurs effectives, défauts compris, et rien d'autre. */
export interface ApparenceResponse {
  /** Nom affiché, ou nom de l'entreprise. */
  nomAffiche: string;
  /** URL absolue du logo ; absente si l'entreprise n'en a pas. */
  logoUrl?: string | null;
  /** #RRGGBB (couleur de l'entreprise ou couleur Batulo par défaut). */
  couleurPrincipale: string;
  /** #FFFFFF ou #000000. */
  couleurTexte: string;
}

/** batulo.personnalisation.couleur-defaut du backend (primaire du thème Batulo, azure ton 40). */
export const COULEUR_DEFAUT = '#005CBB';
/** PersonnalisationRequest.nomAffiche : 150 caractères au plus. */
export const NOM_AFFICHE_MAX = 150;
/** batulo.personnalisation.logo-taille-max : 1 Mo. */
export const LOGO_TAILLE_MAX = 1024 * 1024;
/** Dimensions maximales du logo (LOGO_DIMENSIONS). */
export const LOGO_DIMENSION_MAX = 2000;
