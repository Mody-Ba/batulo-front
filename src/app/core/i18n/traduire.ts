import { signal } from '@angular/core';
import { definitionLangue, Langue, LANGUE_DEFAUT } from './langues';

export type Parametres = Record<string, unknown>;

/** Ce que traduire() attend du service de traduction (TranslocoService, ou un dictionnaire dans les tests). */
export interface Traducteur {
  translate(cle: string, params?: Parametres): string;
}

/**
 * Accès aux traductions depuis du code TypeScript qui n'est pas un composant (messages d'erreur, libellés, formats).
 * Lu comme un signal : un computed() ou un gabarit qui appelle traduire() se recalcule au changement de langue.
 */
const langueActive = signal<Langue>(LANGUE_DEFAUT);
let traducteur: Traducteur | null = null;

/** Appelé par LangueService (et par les tests) : service de traduction et langue dont les textes sont chargés. */
export function brancherTraductions(service: Traducteur, langue: Langue): void {
  traducteur = service;
  langueActive.set(langue);
}

/** Langue courante (signal). */
export function langueCourante(): Langue {
  return langueActive();
}

/** Locale Intl de la langue courante (fr-CA, en-CA, ar-u-nu-latn : chiffres occidentaux en arabe). */
export function localeIntl(): string {
  return definitionLangue(langueActive()).localeIntl;
}

/** Locale Angular de la langue courante (DatePipe, formatNumber). */
export function localeAngular(): string {
  return definitionLangue(langueActive()).localeAngular;
}

/** Texte traduit ; la clé elle-même si aucune traduction n'est chargée (jamais d'exception). */
export function traduire(cle: string, params?: Parametres): string {
  langueActive();
  return traducteur ? traducteur.translate(cle, params) : cle;
}

/** Texte traduit, ou null si la clé n'existe dans aucune langue chargée (repli explicite, ex. message du backend). */
export function traduireSiConnu(cle: string, params?: Parametres): string | null {
  const texte = traduire(cle, params);
  return texte && texte !== cle ? texte : null;
}

const reglesPluriel = new Map<string, Intl.PluralRules>();

/**
 * Pluriel selon la langue (Intl.PluralRules) : clé `{cle}.{forme}` (fr et en : one, other ; ar : zero, one, two,
 * few, many, other), sinon `{cle}.other`. Le nombre est passé au texte sous le nom `n`, déjà formaté (« 1 234 »).
 */
export function traduirePluriel(cle: string, nombre: number, params?: Parametres): string {
  const locale = localeIntl();
  let regles = reglesPluriel.get(locale);
  if (!regles) {
    regles = new Intl.PluralRules(locale);
    reglesPluriel.set(locale, regles);
  }
  const valeurs = { n: formaterNombre(nombre), ...params };
  return traduireSiConnu(`${cle}.${regles.select(nombre)}`, valeurs) ?? traduire(`${cle}.other`, valeurs);
}

/** Nombre selon la langue courante (« 1 234,5 », « 1,234.5 ») ; chiffres occidentaux partout. */
export function formaterNombre(nombre: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(localeIntl(), options).format(nombre);
}

/**
 * Libellés d'une liste de codes (rôles, statuts…) lus dans la langue courante : `libelles('roles', ['ADMIN'])`
 * donne un objet dont `.ADMIN` vaut traduire('roles.ADMIN') à chaque lecture.
 */
export function libelles<C extends string>(prefixe: string, codes: readonly C[]): Readonly<Record<C, string>> {
  const objet = {} as Record<C, string>;
  for (const code of codes) {
    Object.defineProperty(objet, code, { enumerable: true, get: () => traduire(`${prefixe}.${code}`) });
  }
  return objet;
}

/**
 * Texte de succès renvoyé par le serveur (déjà en français) : tel quel en français, sinon la traduction de `cle`
 * (le serveur n'envoie pas de code pour ses messages de succès).
 */
export function texteServeur(cle: string, recu: string | null | undefined): string {
  return langueCourante() === 'fr' && recu?.trim() ? recu : traduire(cle);
}
