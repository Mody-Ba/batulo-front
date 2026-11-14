const entiers = new Intl.NumberFormat('fr-CA', { maximumFractionDigits: 0 });
const decimaux = new Intl.NumberFormat('fr-CA', { maximumFractionDigits: 2 });
const pourcents = new Intl.NumberFormat('fr-CA', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** 1 234 */
export function nombre(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : entiers.format(n);
}

/** 22,45 */
export function decimal(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : decimaux.format(n);
}

/** 51,7 % avec espace insécable (le backend donne des pourcentages de 0 à 100). */
export function pourcentage(p: number | null | undefined): string {
  return p === null || p === undefined ? '—' : `${pourcents.format(p)}\u00a0%`;
}

/** « 2026-03 » -> « mars 2026 », « 2026-03-05 » -> « 5 mars 2026 ». */
export function periode(p: string): string {
  const [annee, mois, jour] = p.split('-').map(Number);
  const date = new Date(annee, (mois ?? 1) - 1, jour ?? 1);
  return jour
    ? date.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' })
    : date.toLocaleDateString('fr-CA', { month: 'short', year: 'numeric' });
}
