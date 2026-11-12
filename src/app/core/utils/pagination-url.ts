/** Tailles de page proposées par les listes paginées dans l'URL (?page=&taille=). */
export const TAILLES_PAGE: readonly number[] = [10, 20, 50];

/** Taille par défaut (celle du backend) : absente de l'URL. */
export const TAILLE_PAGE_PAR_DEFAUT = 20;

function entier(valeur: string | undefined, parDefaut: number, min: number): number {
  const nombre = Number(valeur);
  return Number.isInteger(nombre) && nombre >= min ? nombre : parDefaut;
}

/** ?page= : entier positif ou nul, 0 sinon. */
export function numeroPageUrl(valeur: string | undefined): number {
  return entier(valeur, 0, 0);
}

/** ?taille= : une des TAILLES_PAGE, la taille par défaut sinon. */
export function taillePageUrl(valeur: string | undefined): number {
  const taille = entier(valeur, TAILLE_PAGE_PAR_DEFAUT, 1);
  return TAILLES_PAGE.includes(taille) ? taille : TAILLE_PAGE_PAR_DEFAUT;
}

/** Paramètres d'URL d'un changement de page : les valeurs par défaut sont retirées de l'URL. */
export function parametresPage(pageIndex: number, pageSize: number): { page: number | null; taille: number | null } {
  return { page: pageIndex || null, taille: pageSize === TAILLE_PAGE_PAR_DEFAUT ? null : pageSize };
}
