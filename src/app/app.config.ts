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
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { AuthService } from './core/services/auth.service';

// Dates et nombres en français (Canada : fuseau et devise du backend).
registerLocaleData(localeFrCa);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Liaison des entrées : paramètres d'URL (?jeton=) et data des routes.
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    // Session restaurée après un rechargement : recharge le profil avant la première navigation.
    provideAppInitializer(() => inject(AuthService).initialiser()),
    { provide: LOCALE_ID, useValue: 'fr-CA' },
    // subscriptSizing dynamic : une aide ou une erreur sur deux lignes (téléphone) agrandit le champ
    // au lieu d'être coupée et de chevaucher le champ suivant.
    {
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: { appearance: 'outline', subscriptSizing: 'dynamic' },
    },
  ],
};
