import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PersonnalisationRequest, PersonnalisationResponse } from '../models/personnalisation.model';

/** Personnalisation de l'entreprise du compte connecté (aucune route ne prend d'id d'entreprise). */
@Injectable({ providedIn: 'root' })
export class PersonnalisationService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api`;

  /** Admin et gestionnaires. */
  lire(): Observable<PersonnalisationResponse> {
    return this.http.get<PersonnalisationResponse>(`${this.url}/entreprise/personnalisation`);
  }

  /** Admin : nom affiché et couleur (absent : inchangé ; "" : valeur par défaut). 400 COULEUR_INVALIDE. */
  modifier(demande: PersonnalisationRequest): Observable<PersonnalisationResponse> {
    return this.http.put<PersonnalisationResponse>(`${this.url}/admin/personnalisation`, demande);
  }

  /**
   * Admin : ajoute ou remplace le logo (multipart, champ « fichier »). 400 LOGO_FORMAT_INVALIDE, LOGO_DIMENSIONS,
   * LOGO_ILLISIBLE ; 413 FICHIER_TROP_GROS.
   */
  remplacerLogo(fichier: File): Observable<PersonnalisationResponse> {
    const corps = new FormData();
    corps.append('fichier', fichier, fichier.name);
    return this.http.put<PersonnalisationResponse>(`${this.url}/admin/personnalisation/logo`, corps);
  }

  /** Admin : supprime le logo (son URL ne répond plus). */
  supprimerLogo(): Observable<PersonnalisationResponse> {
    return this.http.delete<PersonnalisationResponse>(`${this.url}/admin/personnalisation/logo`);
  }
}
