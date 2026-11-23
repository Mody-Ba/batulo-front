import { EnvironmentProviders, inject, isDevMode, makeEnvironmentProviders, provideAppInitializer } from '@angular/core';
import { TitleStrategy } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { ChargeurTraductions } from './chargeur-traductions';
import { LangueService } from './langue.service';
import { LANGUE_DEFAUT, LANGUES } from './langues';
import { TitreTraduit } from './titre-traduit';

/** Transloco (changement de langue à l'exécution) et langue appliquée avant le premier affichage. */
export function fournirI18n(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideTransloco({
      config: {
        availableLangs: LANGUES.map((l) => l.code),
        defaultLang: LANGUE_DEFAUT,
        // Clé absente d'une langue : le texte français (le test des clés l'empêche en principe).
        fallbackLang: LANGUE_DEFAUT,
        missingHandler: { useFallbackTranslation: true, logMissingKey: isDevMode() },
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: ChargeurTraductions,
    }),
    // Titres de page : clés des routes, traduites et réappliquées au changement de langue.
    { provide: TitleStrategy, useExisting: TitreTraduit },
    provideAppInitializer(() => inject(LangueService).initialiser()),
  ]);
}
