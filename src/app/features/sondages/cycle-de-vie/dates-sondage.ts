import { SectionResponse } from '../../../core/models/sondage.model';

/** « 2026-11-13T09:30 » (champ datetime-local, heure locale) -> ISO 8601 UTC ; null si vide ou invalide. */
export function versIso(local: string): string | null {
  if (!local) {
    return null;
  }
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** ISO 8601 -> valeur d'un champ datetime-local (heure locale, à la minute). */
export function versLocal(iso: string | null | undefined): string {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  const deux = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${deux(date.getMonth() + 1)}-${deux(date.getDate())}T${deux(date.getHours())}:${deux(date.getMinutes())}`;
}

/**
 * Ce qui empêche de publier (mêmes règles que le backend : SONDAGE_INCOMPLET), ou null : au moins une section, et
 * aucune section sans question.
 */
export function raisonIncomplet(sections: readonly SectionResponse[]): string | null {
  if (sections.length === 0) {
    return 'Le sondage n’a aucune section : rien à publier.';
  }
  const vide = sections.find((s) => s.questions.length === 0);
  return vide ? `La section « ${vide.titre} » n’a aucune question.` : null;
}
