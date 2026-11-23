import { registerLocaleData } from '@angular/common';
import localeAr from '@angular/common/locales/ar';
import localeEnCa from '@angular/common/locales/en-CA';
import localeFrCa from '@angular/common/locales/fr-CA';
import { inject, provideAppInitializer } from '@angular/core';
import { provideTransloco, Translation, TranslocoLoader, TranslocoService } from '@jsverse/transloco';
import { Observable, of } from 'rxjs';
import ar from '../public/i18n/ar.json';
import en from '../public/i18n/en.json';
import fr from '../public/i18n/fr.json';
import publicAr from '../public/i18n/public/ar.json';
import publicEn from '../public/i18n/public/en.json';
import publicFr from '../public/i18n/public/fr.json';
import { brancherTraductions } from './app/core/i18n/traduire';

registerLocaleData(localeFrCa);
registerLocaleData(localeEnCa);
registerLocaleData(localeAr);

/** Traductions réelles, chargées sans HTTP : les tests vérifient les textes français. */
export const TRADUCTIONS: Record<string, Translation> = {
  fr: { ...fr, ...publicFr },
  en: { ...en, ...publicEn },
  ar: { ...ar, ...publicAr },
};

/** Traducteur sans injection (tests de fonctions hors TestBed) : clé pointée et paramètres {{ nom }}. */
export function traducteurStatique(dictionnaire: Translation) {
  return {
    translate(cle: string, params?: Record<string, unknown>): string {
      const valeur = cle.split('.').reduce<unknown>((noeud, partie) => (noeud as Record<string, unknown> | undefined)?.[partie], dictionnaire);
      if (typeof valeur !== 'string') {
        return cle;
      }
      return valeur.replace(/{{\s*(\w+)\s*}}/g, (_, nom: string) => String(params?.[nom] ?? ''));
    },
  };
}

// Fonctions appelées hors de TestBed (libellés, messages d'erreur) : textes français dès le chargement.
brancherTraductions(traducteurStatique(TRADUCTIONS['fr']), 'fr');

class ChargeurDeTest implements TranslocoLoader {
  getTranslation(langue: string): Observable<Translation> {
    return of(TRADUCTIONS[langue] ?? {});
  }
}

/** Fournis à chaque TestBed (angular.json : test.options.providersFile). */
export default [
  provideTransloco({
    config: {
      availableLangs: ['fr', 'en', 'ar'],
      defaultLang: 'fr',
      fallbackLang: 'fr',
      missingHandler: { useFallbackTranslation: true, logMissingKey: false },
      reRenderOnLangChange: true,
      prodMode: true,
    },
    loader: ChargeurDeTest,
  }),
  provideAppInitializer(() => {
    const service = inject(TranslocoService);
    service.setTranslation(TRADUCTIONS['fr'], 'fr');
    service.setActiveLang('fr');
    brancherTraductions(service, 'fr');
  }),
];
