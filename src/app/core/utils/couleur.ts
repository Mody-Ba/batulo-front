/** Couleurs des formulaires : mêmes règles que ContrasteCouleur du backend. */

const FORMAT = /^#[0-9A-Fa-f]{6}$/;

/** #RRGGBB seulement : rien d'autre n'est jamais appliqué en CSS. */
export function couleurValide(couleur: unknown): couleur is string {
  return typeof couleur === 'string' && FORMAT.test(couleur);
}

/** #rrggbb -> #RRGGBB. */
export function normaliserCouleur(couleur: string): string {
  return couleur.toUpperCase();
}

/** Blanc ou noir : celui qui contraste le plus avec le fond (à égalité, blanc), selon le rapport WCAG 2.x. */
export function couleurTexte(fond: string): '#FFFFFF' | '#000000' {
  const l = luminance(fond);
  return rapport(1, l) >= rapport(l, 0) ? '#FFFFFF' : '#000000';
}

/** Rapport de contraste WCAG entre deux couleurs #RRGGBB (de 1 à 21). */
export function contraste(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return rapport(Math.max(la, lb), Math.min(la, lb));
}

function rapport(claire: number, sombre: number): number {
  return (claire + 0.05) / (sombre + 0.05);
}

function luminance(couleur: string): number {
  const rgb = parseInt(couleur.slice(1), 16);
  return 0.2126 * canal((rgb >> 16) & 0xff) + 0.7152 * canal((rgb >> 8) & 0xff) + 0.0722 * canal(rgb & 0xff);
}

function canal(valeur: number): number {
  const c = valeur / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
