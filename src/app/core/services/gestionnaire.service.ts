import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreationGestionnaireRequest,
  FiltreGestionnaires,
  GestionnaireResponse,
  ModificationGestionnaireRequest,
} from '../models/gestionnaire.model';
import { PageResponse } from '../models/page.model';
import { SondageGestionnaireResponse } from '../models/sondage.model';

/** Gestionnaires de l'entreprise de l'admin connecté (404 pour ceux d'une autre entreprise). */
@Injectable({ providedIn: 'root' })
export class GestionnaireService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/admin/gestionnaires`;

  /** Du plus récent au plus ancien ; recherche et actif facultatifs et cumulables. */
  lister(filtre: FiltreGestionnaires = {}): Observable<PageResponse<GestionnaireResponse>> {
    let params = new HttpParams().set('page', filtre.page ?? 0).set('taille', filtre.taille ?? 20);
    const recherche = filtre.recherche?.trim();
    if (recherche) {
      params = params.set('recherche', recherche);
    }
    if (filtre.actif !== undefined && filtre.actif !== null) {
      params = params.set('actif', filtre.actif);
    }
    return this.http.get<PageResponse<GestionnaireResponse>>(this.url, { params });
  }

  detail(id: number): Observable<GestionnaireResponse> {
    return this.http.get<GestionnaireResponse>(`${this.url}/${id}`);
  }

  /** 409 si le courriel est déjà utilisé sur la plateforme. Sans permission de créer des sondages. */
  creer(demande: CreationGestionnaireRequest): Observable<GestionnaireResponse> {
    return this.http.post<GestionnaireResponse>(this.url, demande);
  }

  modifier(id: number, demande: ModificationGestionnaireRequest): Observable<GestionnaireResponse> {
    return this.http.put<GestionnaireResponse>(`${this.url}/${id}`, demande);
  }

  /** Irréversible. */
  supprimer(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  activer(id: number): Observable<GestionnaireResponse> {
    return this.http.patch<GestionnaireResponse>(`${this.url}/${id}/activer`, null);
  }

  /** Il ne pourra plus se connecter ; ses assignations sont conservées. */
  desactiver(id: number): Observable<GestionnaireResponse> {
    return this.http.patch<GestionnaireResponse>(`${this.url}/${id}/desactiver`, null);
  }

  /** Nouveau mot de passe temporaire (24 h) envoyé par courriel ; l'ancien ne fonctionne plus. */
  renvoyerMotDePasseTemporaire(id: number): Observable<GestionnaireResponse> {
    return this.http.post<GestionnaireResponse>(`${this.url}/${id}/mot-de-passe-temporaire`, null);
  }

  changerPermissionSondages(id: number, peutCreerSondages: boolean): Observable<GestionnaireResponse> {
    return this.http.patch<GestionnaireResponse>(`${this.url}/${id}/permission-sondages`, {
      peutCreerSondages,
    });
  }

  /** Sondages qu'il voit : créés par lui (CREATEUR) ou assignés (ASSIGNE). */
  sondages(id: number, page = 0, taille = 20): Observable<PageResponse<SondageGestionnaireResponse>> {
    return this.http.get<PageResponse<SondageGestionnaireResponse>>(`${this.url}/${id}/sondages`, {
      params: { page, taille },
    });
  }
}
