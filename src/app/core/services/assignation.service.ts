import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AssignationResponse } from '../models/assignation.model';

/** Assignations d'un sondage (réservées à l'admin ; elles portent sur toute la lignée). */
@Injectable({ providedIn: 'root' })
export class AssignationService {
  private readonly http = inject(HttpClient);

  private url(sondageId: number): string {
    return `${environment.apiUrl}/api/sondages/${sondageId}/assignations`;
  }

  lister(sondageId: number): Observable<AssignationResponse[]> {
    return this.http.get<AssignationResponse[]>(this.url(sondageId));
  }

  /**
   * Renvoie la liste à jour. 404 GESTIONNAIRE_INTROUVABLE, 409 GESTIONNAIRE_DESACTIVE ou
   * GESTIONNAIRE_CREATEUR (il a créé une version du sondage).
   */
  assigner(sondageId: number, gestionnaireIds: number[]): Observable<AssignationResponse[]> {
    return this.http.post<AssignationResponse[]>(this.url(sondageId), { gestionnaireIds });
  }

  /** 404 ASSIGNATION_INTROUVABLE. Le gestionnaire est notifié. */
  retirer(sondageId: number, gestionnaireId: number): Observable<void> {
    return this.http.delete<void>(`${this.url(sondageId)}/${gestionnaireId}`);
  }
}
