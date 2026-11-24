import { Params } from '@angular/router';
import { FILTRES_PAR_DEFAUT, FiltresStatistiques, GranulariteDate } from '../../../core/models/statistiques.model';
import { estLangue } from '../../../core/i18n/langues';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Paramètres d'URL des statistiques (?lignee=&du=&au=&granularite=&critere=cle:valeur, critere répété, langue= pour
 * les libellés, langueReponse= répété).
 */
export interface ParametresUrlStatistiques {
  lignee?: string;
  du?: string;
  au?: string;
  granularite?: string;
  critere?: string | string[];
  langue?: string;
  langueReponse?: string | string[];
}

function liste(valeur: string | string[] | undefined): string[] {
  return Array.isArray(valeur) ? valeur : valeur ? [valeur] : [];
}

/** Filtres lus dans l'URL ; une valeur invalide est ignorée. */
export function filtresDepuisUrl(p: ParametresUrlStatistiques): FiltresStatistiques {
  const criteres = liste(p.critere).filter((c) => /^[^:]+:.+$/.test(c));
  const languesReponse = [...new Set(liste(p.langueReponse).filter(estLangue))];
  const granularite: GranulariteDate | null = p.granularite === 'JOUR' || p.granularite === 'MOIS' ? p.granularite : null;
  return {
    lignee: p.lignee === 'true',
    du: p.du && DATE.test(p.du) ? p.du : null,
    au: p.au && DATE.test(p.au) ? p.au : null,
    granularite,
    criteres: [...new Set(criteres)],
    // Absents quand ils ne sont pas demandés (les filtres par défaut restent ceux d'avant les langues).
    ...(estLangue(p.langue) ? { langue: p.langue } : {}),
    ...(languesReponse.length ? { languesReponse } : {}),
  };
}

/** Paramètres d'URL des filtres : les valeurs par défaut sont retirées (null). */
export function parametresUrl(filtres: FiltresStatistiques): Params {
  return {
    lignee: filtres.lignee ? 'true' : null,
    du: filtres.du,
    au: filtres.au,
    granularite: filtres.granularite,
    critere: filtres.criteres.length ? filtres.criteres : null,
    langue: filtres.langue ?? null,
    langueReponse: filtres.languesReponse?.length ? filtres.languesReponse : null,
  };
}

export function filtresActifs(filtres: FiltresStatistiques): boolean {
  return (
    filtres.lignee !== FILTRES_PAR_DEFAUT.lignee ||
    !!filtres.du ||
    !!filtres.au ||
    !!filtres.granularite ||
    filtres.criteres.length > 0 ||
    !!filtres.languesReponse?.length
  );
}

/** « cle:valeur » -> [cle, valeur] (la valeur peut contenir « : »). */
export function decouperCritere(critere: string): [string, string] {
  const i = critere.indexOf(':');
  return [critere.slice(0, i), critere.slice(i + 1)];
}
