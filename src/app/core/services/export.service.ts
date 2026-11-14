import { HttpClient, HttpErrorResponse, HttpParams, HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, from, map, Observable, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  FiltresStatistiques,
  FormatExport,
  SeparateurDecimal,
  ValeursExport,
} from '../models/statistiques.model';
import { parametresFiltres } from './statistiques.service';

export interface FichierExporte {
  nom: string;
  contenu: Blob;
}

const EXTENSIONS: Record<FormatExport, string> = { CSV: 'csv', XLSX: 'xlsx', PDF: 'pdf' };

/**
 * Avec responseType 'blob', le corps d'une erreur ({ code, message }) arrive aussi en Blob : on le relit en JSON pour
 * que messageErreur() affiche le message du serveur.
 */
export function erreurLisible(erreur: unknown): Observable<never> {
  if (!(erreur instanceof HttpErrorResponse) || !(erreur.error instanceof Blob)) {
    return throwError(() => erreur);
  }
  return from(erreur.error.text()).pipe(
    switchMap((texte) => {
      let corps: unknown = null;
      try {
        corps = JSON.parse(texte);
      } catch {
        corps = null;
      }
      return throwError(
        () =>
          new HttpErrorResponse({
            error: corps,
            headers: erreur.headers,
            status: erreur.status,
            statusText: erreur.statusText,
            url: erreur.url ?? undefined,
          }),
      );
    }),
  );
}

/**
 * Nom du fichier donné par le backend (Content-Disposition : filename*=UTF-8''… prioritaire sur filename="…"),
 * ou null si l'en-tête est absent ou illisible (il faut qu'il soit exposé par le CORS du backend).
 */
export function nomDepuisEntete(entete: string | null): string | null {
  if (!entete) {
    return null;
  }
  const etendu = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(entete);
  if (etendu) {
    try {
      return decodeURIComponent(etendu[1].trim().replace(/^"|"$/g, ''));
    } catch {
      // Encodage invalide : on essaie la forme simple.
    }
  }
  const simple = /filename\s*=\s*"([^"]+)"|filename\s*=\s*([^;]+)/i.exec(entete);
  const nom = (simple?.[1] ?? simple?.[2])?.trim();
  return nom ? nom : null;
}

/**
 * Exports (CSV, Excel, PDF) téléchargés par HttpClient (le jeton est envoyé), puis enregistrés par le navigateur.
 * Le nom vient du backend (Content-Disposition) ; à défaut, un nom neutre est utilisé.
 */
@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly http = inject(HttpClient);
  private readonly url = environment.apiUrl;

  /** Réponses brutes : CSV ou XLSX ; libellés ou codes ; CSV « ; » + virgule (Excel) ou « , » + point. */
  reponses(
    id: number,
    format: Extract<FormatExport, 'CSV' | 'XLSX'>,
    filtres: FiltresStatistiques,
    valeurs: ValeursExport = 'LIBELLES',
    separateurDecimal: SeparateurDecimal = 'VIRGULE',
  ): Observable<FichierExporte> {
    let params = parametresFiltres(filtres, false).set('format', format).set('valeurs', valeurs);
    if (format === 'CSV') {
      params = params.set('separateurDecimal', separateurDecimal);
    }
    return this.telecharger(`/api/sondages/${id}/export/reponses`, params, `reponses-sondage-${id}`, format);
  }

  /** Rapport des statistiques : PDF ou XLSX. */
  statistiques(id: number, format: Extract<FormatExport, 'PDF' | 'XLSX'>, filtres: FiltresStatistiques): Observable<FichierExporte> {
    return this.telecharger(
      `/api/sondages/${id}/export/statistiques`,
      parametresFiltres(filtres).set('format', format),
      `statistiques-sondage-${id}`,
      format,
    );
  }

  croisement(
    id: number,
    format: Extract<FormatExport, 'PDF' | 'XLSX'>,
    question: string,
    par: string,
    filtres: FiltresStatistiques,
  ): Observable<FichierExporte> {
    return this.telecharger(
      `/api/sondages/${id}/export/croisement`,
      parametresFiltres(filtres, false).set('format', format).set('question', question).set('par', par),
      `tableau-croise-sondage-${id}`,
      format,
    );
  }

  /** Admin : rapport PDF de statistiques reçues. */
  statistiquesRecues(envoiId: number): Observable<FichierExporte> {
    return this.telecharger(`/api/statistiques-recues/${envoiId}/pdf`, new HttpParams(), `statistiques-recues-${envoiId}`, 'PDF');
  }

  /** Enregistre le fichier (lien local blob:, libéré ensuite). */
  enregistrer(fichier: FichierExporte): void {
    const adresse = URL.createObjectURL(fichier.contenu);
    const lien = document.createElement('a');
    lien.href = adresse;
    lien.download = fichier.nom;
    lien.rel = 'noopener';
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(adresse), 1000);
  }

  private telecharger(chemin: string, params: HttpParams, nomParDefaut: string, format: FormatExport): Observable<FichierExporte> {
    return this.http
      .get(`${this.url}${chemin}`, { params, responseType: 'blob', observe: 'response' })
      .pipe(
        map((reponse: HttpResponse<Blob>) => ({
          nom: nomDepuisEntete(reponse.headers.get('Content-Disposition')) ?? `${nomParDefaut}.${EXTENSIONS[format]}`,
          contenu: reponse.body ?? new Blob(),
        })),
        catchError(erreurLisible),
      );
  }
}
