import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Translation, TranslocoLoader } from '@jsverse/transloco';
import { forkJoin, map, Observable } from 'rxjs';
import { SANS_AUTHENTIFICATION } from '../interceptors/contexte-http';

/** Le formulaire public (/s/...) ne charge que son petit fichier, jamais le fichier principal. */
export function estPagePublique(chemin = globalThis.location?.pathname ?? ''): boolean {
  return chemin.startsWith('/s/');
}

/**
 * Fichiers de traduction servis par public/i18n (hors du bundle) : i18n/{langue}.json (application) et
 * i18n/public/{langue}.json (clés « public.* » : formulaire du répondant, aussi utilisé par l'aperçu). Le formulaire
 * public ne charge que le second ; le reste de l'application charge les deux, fusionnés.
 */
@Injectable({ providedIn: 'root' })
export class ChargeurTraductions implements TranslocoLoader {
  private readonly http = inject(HttpClient);
  private readonly contexte = new HttpContext().set(SANS_AUTHENTIFICATION, true);

  /** Langues chargées sans le fichier principal (formulaire public) : complétées en quittant /s/ (LangueService). */
  readonly partielles = new Set<string>();

  getTranslation(langue: string): Observable<Translation> {
    const publique = this.http.get<Translation>(`i18n/public/${langue}.json`, { context: this.contexte });
    if (estPagePublique()) {
      this.partielles.add(langue);
      return publique;
    }
    this.partielles.delete(langue);
    return forkJoin([this.principale(langue), publique]).pipe(map(([principale, pub]) => ({ ...principale, ...pub })));
  }

  principale(langue: string): Observable<Translation> {
    return this.http.get<Translation>(`i18n/${langue}.json`, { context: this.contexte });
  }
}
