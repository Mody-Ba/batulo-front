import { signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

type HashMap = Record<string, unknown>;
import { definitionLangue, Langue, LANGUE_DEFAUT } from './langues';

/**
 * Accès aux traductions depuis du code TypeScript qui n'est pas un composant (messages d'erreur, libellés, formats).
 * Lu comme un signal : un computed() qui appelle traduire() se recalcule au changement de langue.
 */
const langueActive = signal<Langue>(LANGUE_DEFAUT);
let transloco: TranslocoService | null = null;

/** Appelé par LangueService (et par les tests) : service de traduction et langue dont les textes sont chargés. */
export function brancherTraductions(service: TranslocoService, langue: Langue): void {
  transloco = service;
  langueActive.set(langue);
}

/** Langue courante (signal). */
export function langueCourante(): Langue {
  return langueActive();
}

/** Locale Intl de la langue courante (fr-CA, en-CA, ar-u-nu-latn). */
export function localeIntl(): string {
  return definitionLangue(langueActive()).localeIntl;
}

/** Locale Angular de la langue courante (DatePipe, formatNumber). */
export function localeAngular(): string {
  return definitionLangue(langueActive()).localeAngular;
}

/** Texte traduit ; la clé elle-même si aucune traduction n'est chargée (jamais d'exception). */
export function traduire(cle: string, params?: HashMap): string {
  langueActive();
  return transloco ? transloco.translate(cle, params) : cle;
}

/** Texte traduit, ou null si la clé n'existe dans aucune langue chargée (repli explicite, ex. message du backend). */
export function traduireSiConnu(cle: string, params?: HashMap): string | null {
  const texte = traduire(cle, params);
  return texte && texte !== cle ? texte : null;
}
