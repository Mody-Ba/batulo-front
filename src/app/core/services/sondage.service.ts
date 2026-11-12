import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PageResponse } from '../models/page.model';
import {
  StatutSondage,
  SondageResponse,
  SondageResumeResponse,
  SuiviCollecteResponse,
  VersionResponse,
} from '../models/sondage.model';

export interface FiltreSondages {
  statut?: StatutSondage | null;
  /**
   * true : une ligne par lignée (dernière version publiée en cours ou terminée, sinon le brouillon) ;
   * le statut filtre alors cette ligne.
   */
  derniereVersion?: boolean;
  page?: number;
  taille?: number;
}

/**
 * Sondages (lecture en F4 ; l'édition arrive en F5).
 * Admin : tous ceux de l'entreprise ; gestionnaire : ceux qu'il a créés ou qui lui sont assignés.
 */
@Injectable({ providedIn: 'root' })
export class SondageService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/sondages`;

  /** Du plus récemment modifié au plus ancien ; une ligne par version sauf avec derniereVersion. */
  lister(filtre: FiltreSondages = {}): Observable<PageResponse<SondageResumeResponse>> {
    let params = new HttpParams().set('page', filtre.page ?? 0).set('taille', filtre.taille ?? 20);
    if (filtre.statut) {
      params = params.set('statut', filtre.statut);
    }
    if (filtre.derniereVersion) {
      params = params.set('derniereVersion', true);
    }
    return this.http.get<PageResponse<SondageResumeResponse>>(this.url, { params });
  }

  detail(id: number): Observable<SondageResponse> {
    return this.http.get<SondageResponse>(`${this.url}/${id}`);
  }

  versions(id: number): Observable<VersionResponse[]> {
    return this.http.get<VersionResponse[]>(`${this.url}/${id}/versions`);
  }

  collecte(id: number): Observable<SuiviCollecteResponse> {
    return this.http.get<SuiviCollecteResponse>(`${this.url}/${id}/collecte`);
  }
}
