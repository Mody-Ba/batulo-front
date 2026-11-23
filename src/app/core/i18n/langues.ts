/** Langues de l'interface (étape 3, partie 1) : le contenu saisi par les admins n'est pas traduit. */
export type Langue = 'fr' | 'en' | 'ar';

export interface DefinitionLangue {
  code: Langue;
  /** Nom de la langue dans cette langue (sélecteur). */
  nom: string;
  dir: 'ltr' | 'rtl';
  /** Données de langue d'Angular (DatePipe, formatNumber) : chargées à la demande sauf fr-CA. */
  localeAngular: string;
  /** Intl : chiffres occidentaux (1 234) pour l'arabe. */
  localeIntl: string;
}

export const LANGUES: readonly DefinitionLangue[] = [
  { code: 'fr', nom: 'Français', dir: 'ltr', localeAngular: 'fr-CA', localeIntl: 'fr-CA' },
  { code: 'en', nom: 'English', dir: 'ltr', localeAngular: 'en-CA', localeIntl: 'en-CA' },
  { code: 'ar', nom: 'العربية', dir: 'rtl', localeAngular: 'ar', localeIntl: 'ar-u-nu-latn' },
];

export const LANGUE_DEFAUT: Langue = 'fr';
export const CLE_STOCKAGE_LANGUE = 'batulo.langue';

export function definitionLangue(code: Langue): DefinitionLangue {
  return LANGUES.find((l) => l.code === code) ?? LANGUES[0];
}

export function estLangue(valeur: unknown): valeur is Langue {
  return typeof valeur === 'string' && LANGUES.some((l) => l.code === valeur);
}

/** Langue du navigateur si c'est fr, en ou ar (« en-US » -> en, « ar-MR » -> ar), sinon le français. */
export function langueDuNavigateur(preferees: readonly string[] | undefined): Langue {
  for (const preferee of preferees ?? []) {
    const code = preferee.toLowerCase().split('-')[0];
    if (estLangue(code)) {
      return code;
    }
  }
  return LANGUE_DEFAUT;
}
