import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PageResponse } from '../models/page.model';
import {
  CritereResponse,
  CroisementResponse,
  EnvoiStatistiqueRequest,
  EnvoiStatistiqueResponse,
  FiltresStatistiques,
  PageTextes,
  ReponseResponse,
  StatistiquesResponse,
} from '../models/statistiques.model';

/** Paramètres du périmètre d'analyse : lignee, du, au, granulariteDate (si demandée), critere répété. */
export function parametresFiltres(filtres: FiltresStatistiques, avecGranularite = true): HttpParams {
  let params = new HttpParams().set('lignee', filtres.lignee);
  if (filtres.du) {
    params = params.set('du', filtres.du);
  }
  if (filtres.au) {
    params = params.set('au', filtres.au);
  }
  if (avecGranularite && filtres.granularite) {
    params = params.set('granulariteDate', filtres.granularite);
  }
  for (const critere of filtres.criteres) {
    params = params.append('critere', critere);
  }
  return params;
}

/**
 * Réponses et statistiques d'un sondage (admin, gestionnaire créateur ou assigné ; lecture permise abonnement expiré),
 * envoi des statistiques à l'admin (gestionnaire, sondage terminé) et statistiques reçues (admin).
 */
@Injectable({ providedIn: 'root' })
export class StatistiquesService {
  private readonly http = inject(HttpClient);
  private readonly url = environment.apiUrl;

  statistiques(id: number, filtres: FiltresStatistiques): Observable<StatistiquesResponse> {
    return this.http.get<StatistiquesResponse>(`${this.url}/api/sondages/${id}/statistiques`, {
      params: parametresFiltres(filtres),
    });
  }

  /** Textes libres d'une question, les plus récents d'abord. */
  textes(id: number, questionId: number, filtres: FiltresStatistiques, page = 0, taille = 10): Observable<PageTextes> {
    return this.http.get<PageTextes>(`${this.url}/api/sondages/${id}/statistiques/questions/${questionId}/textes`, {
      params: parametresFiltres(filtres, false).set('page', page).set('taille', taille),
    });
  }

  criteres(id: number, lignee: boolean): Observable<CritereResponse[]> {
    return this.http.get<CritereResponse[]>(`${this.url}/api/sondages/${id}/statistiques/criteres`, {
      params: { lignee },
    });
  }

  /** `question` et `par` : clés (question.cle). */
  croisement(id: number, question: string, par: string, filtres: FiltresStatistiques): Observable<CroisementResponse> {
    return this.http.get<CroisementResponse>(`${this.url}/api/sondages/${id}/statistiques/croisement`, {
      params: parametresFiltres(filtres, false).set('question', question).set('par', par),
    });
  }

  /** Réponses, les plus récentes d'abord : de cette version, ou de toute la lignée (chacune avec sa version). */
  reponses(id: number, page = 0, taille = 20, lignee = false): Observable<PageResponse<ReponseResponse>> {
    return this.http.get<PageResponse<ReponseResponse>>(`${this.url}/api/sondages/${id}/reponses`, {
      params: { page, taille, lignee },
    });
  }

  /** 409 SONDAGE_NON_TERMINE si le sondage (ou une version de la lignée) n'est pas terminé. */
  envoyer(id: number, envoi: EnvoiStatistiqueRequest): Observable<EnvoiStatistiqueResponse> {
    return this.http.post<EnvoiStatistiqueResponse>(`${this.url}/api/sondages/${id}/envois-statistiques`, envoi);
  }

  /** Admin : statistiques envoyées par ses gestionnaires, les plus récentes d'abord. */
  recues(page = 0, taille = 20): Observable<PageResponse<EnvoiStatistiqueResponse>> {
    return this.http.get<PageResponse<EnvoiStatistiqueResponse>>(`${this.url}/api/statistiques-recues`, {
      params: { page, taille },
    });
  }

  /** Admin : statistiques recalculées avec les filtres de l'envoi (marque l'envoi comme consulté). */
  recue(envoiId: number): Observable<StatistiquesResponse> {
    return this.http.get<StatistiquesResponse>(`${this.url}/api/statistiques-recues/${envoiId}`);
  }

  /** Gestionnaire : ses envois. */
  envoyees(page = 0, taille = 20): Observable<PageResponse<EnvoiStatistiqueResponse>> {
    return this.http.get<PageResponse<EnvoiStatistiqueResponse>>(`${this.url}/api/statistiques-envoyees`, {
      params: { page, taille },
    });
  }
}
