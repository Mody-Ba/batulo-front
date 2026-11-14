import { Params } from '@angular/router';
import { FILTRES_PAR_DEFAUT, FiltresStatistiques, GranulariteDate } from '../../../core/models/statistiques.model';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Paramètres d'URL des statistiques (?lignee=&du=&au=&granularite=&critere=cle:valeur, critere répété). */
export interface ParametresUrlStatistiques {
  lignee?: string;
  du?: string;
  au?: string;
  granularite?: string;
  critere?: string | string[];
}

/** Filtres lus dans l'URL ; une valeur invalide est ignorée. */
export function filtresDepuisUrl(p: ParametresUrlStatistiques): FiltresStatistiques {
  const criteres = (Array.isArray(p.critere) ? p.critere : p.critere ? [p.critere] : []).filter((c) =>
    /^[^:]+:.+$/.test(c),
  );
  const granularite: GranulariteDate | null = p.granularite === 'JOUR' || p.granularite === 'MOIS' ? p.granularite : null;
  return {
    lignee: p.lignee === 'true',
    du: p.du && DATE.test(p.du) ? p.du : null,
    au: p.au && DATE.test(p.au) ? p.au : null,
    granularite,
    criteres: [...new Set(criteres)],
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
  };
}

export function filtresActifs(filtres: FiltresStatistiques): boolean {
  return (
    filtres.lignee !== FILTRES_PAR_DEFAUT.lignee ||
    !!filtres.du ||
    !!filtres.au ||
    !!filtres.granularite ||
    filtres.criteres.length > 0
  );
}

/** « cle:valeur » -> [cle, valeur] (la valeur peut contenir « : »). */
export function decouperCritere(critere: string): [string, string] {
  const i = critere.indexOf(':');
  return [critere.slice(0, i), critere.slice(i + 1)];
}
