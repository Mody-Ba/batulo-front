import { localeIntl } from '../../../../core/i18n/traduire';

/** Formats Intl de la langue courante (chiffres occidentaux en arabe), gardés par locale. */
const formats = new Map<string, Intl.NumberFormat>();
function format(nom: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const locale = localeIntl();
  const cle = `${locale}|${nom}`;
  let f = formats.get(cle);
  if (!f) {
    f = new Intl.NumberFormat(locale, options);
    formats.set(cle, f);
  }
  return f;
}

/** 1 234 (français), 1,234 (anglais, arabe) */
export function nombre(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : format('entier', { maximumFractionDigits: 0 }).format(n);
}

/** 22,45 (français), 22.45 (anglais, arabe) */
export function decimal(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : format('decimal', { maximumFractionDigits: 2 }).format(n);
}

/** 51,7 % en français (espace insécable), 51.7% en anglais ; le backend donne des pourcentages de 0 à 100. */
export function pourcentage(p: number | null | undefined): string {
  return p === null || p === undefined
    ? '—'
    : format('pourcent', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(p / 100);
}

/** « 2026-03 » -> « mars 2026 », « 2026-03-05 » -> « 5 mars 2026 » (dans la langue courante). */
export function periode(p: string): string {
  const [annee, mois, jour] = p.split('-').map(Number);
  const date = new Date(annee, (mois ?? 1) - 1, jour ?? 1);
  return jour
    ? date.toLocaleDateString(localeIntl(), { day: 'numeric', month: 'short', year: 'numeric' })
    : date.toLocaleDateString(localeIntl(), { month: 'short', year: 'numeric' });
}
