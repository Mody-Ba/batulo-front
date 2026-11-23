import { formatDate, formatNumber, formatPercent } from '@angular/common';
import { Pipe, PipeTransform } from '@angular/core';
import { montantEnClair } from '../utils/montant';
import { Langue } from './langues';
import { langueCourante, localeAngular } from './traduire';

/** Formats nommés (dates du produit), un motif par langue ; les formats d'Angular (longDate…) restent acceptés. */
export const FORMATS_DATE: Record<string, Record<Langue, string>> = {
  long: { fr: 'd MMMM y', en: 'MMMM d, y', ar: 'd MMMM y' },
  court: { fr: 'd MMM y', en: 'MMM d, y', ar: 'd MMM y' },
  longHeure: { fr: "d MMMM y 'à' HH:mm", en: "MMMM d, y 'at' HH:mm", ar: 'd MMMM y، HH:mm' },
  courtHeure: { fr: "d MMM y 'à' HH:mm", en: 'MMM d, y, HH:mm', ar: 'd MMM y، HH:mm' },
  jourHeure: { fr: 'd MMM, HH:mm', en: 'MMM d, HH:mm', ar: 'd MMM، HH:mm' },
  heure: { fr: 'HH:mm', en: 'HH:mm', ar: 'HH:mm' },
};

/** Motif d'un format nommé dans la langue courante (sinon le format tel quel). */
export function motifDate(format: string): string {
  return FORMATS_DATE[format]?.[langueCourante()] ?? format;
}

/**
 * Remplacent date, number, currency et percent d'Angular, figés sur la langue du démarrage (LOCALE_ID) : ceux-ci
 * suivent la langue courante (impurs, mais le calcul est léger). Mêmes arguments que les pipes d'Angular.
 */
@Pipe({ name: 'dateL', pure: false })
export class DateLPipe implements PipeTransform {
  transform(valeur: string | number | Date | null | undefined, format = 'mediumDate', fuseau?: string): string | null {
    return valeur === null || valeur === undefined || valeur === '' ? null : formatDate(valeur, motifDate(format), localeAngular(), fuseau);
  }
}

@Pipe({ name: 'nombreL', pure: false })
export class NombreLPipe implements PipeTransform {
  transform(valeur: number | null | undefined, chiffres?: string): string | null {
    return valeur === null || valeur === undefined || Number.isNaN(valeur) ? null : formatNumber(valeur, localeAngular(), chiffres);
  }
}

/** Montant avec le symbole de sa devise (« 2,00 $ », « $2.00 »), MRU par son code (montantEnClair). */
@Pipe({ name: 'montantL', pure: false })
export class MontantLPipe implements PipeTransform {
  transform(valeur: number | null | undefined, devise: string | null | undefined): string | null {
    return valeur === null || valeur === undefined || !devise ? null : montantEnClair(valeur, devise);
  }
}

@Pipe({ name: 'pourcentL', pure: false })
export class PourcentLPipe implements PipeTransform {
  transform(valeur: number | null | undefined, chiffres?: string): string | null {
    return valeur === null || valeur === undefined ? null : formatPercent(valeur, localeAngular(), chiffres);
  }
}
