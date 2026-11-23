import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localeFrCa from '@angular/common/locales/fr-CA';
import {
  ApplicationConfig,
  inject,
  LOCALE_ID,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { fournirI18n } from './core/i18n/fournir-i18n';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { AuthService } from './core/services/auth.service';

// Format français par défaut (fr-CA) ; en-CA et ar sont chargés à la demande (LangueService).
registerLocaleData(localeFrCa);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Liaison des entrées : paramètres d'URL (?jeton=) et data des routes.
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    // Langues de l'interface (fr, en, ar) : textes chargés à la demande, appliqués avant le premier affichage.
    fournirI18n(),
    // Session restaurée après un rechargement : recharge le profil avant la première navigation.
    provideAppInitializer(() => inject(AuthService).initialiser()),
    { provide: LOCALE_ID, useValue: 'fr-CA' },
  ],
};
