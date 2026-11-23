import { EnvironmentProviders, inject, isDevMode, makeEnvironmentProviders, provideAppInitializer } from '@angular/core';
import { provideTransloco } from '@jsverse/transloco';
import { ChargeurTraductions } from './chargeur-traductions';
import { LangueService } from './langue.service';
import { LANGUE_DEFAUT, LANGUES } from './langues';

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
    provideAppInitializer(() => inject(LangueService).initialiser()),
  ]);
}
