import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SondageResponse } from '../models/sondage.model';
import {
  CompletudeLangueResponse,
  LangueContenu,
  LanguesRequest,
  TraductionsLangueResponse,
  TraductionsRequest,
} from '../models/traduction.model';

/**
 * Langues et traductions du contenu d'un sondage (TraductionController). Lecture : comme le sondage ; écriture :
 * brouillon seulement (409 SONDAGE_PUBLIE), mêmes droits que la modification.
 */
@Injectable({ providedIn: 'root' })
export class TraductionService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/sondages`;

  /** Langue principale et supplémentaires (400 LANGUE_INVALIDE) ; renvoie le sondage. */
  definirLangues(id: number, langues: LanguesRequest): Observable<SondageResponse> {
    return this.http.put<SondageResponse>(`${this.url}/${id}/langues`, langues);
  }

  /** Complétude de chaque langue supplémentaire. */
  completude(id: number): Observable<CompletudeLangueResponse[]> {
    return this.http.get<CompletudeLangueResponse[]>(`${this.url}/${id}/traductions`);
  }

  /** Textes côte à côte (400 LANGUE_INVALIDE si ce n'est pas une langue supplémentaire). */
  traductions(id: number, langue: LangueContenu): Observable<TraductionsLangueResponse> {
    return this.http.get<TraductionsLangueResponse>(`${this.url}/${id}/traductions/${langue}`);
  }

  /** En une fois (400 TRADUCTION_INVALIDE, LANGUE_INVALIDE ; 409 SONDAGE_PUBLIE). */
  enregistrer(id: number, langue: LangueContenu, requete: TraductionsRequest): Observable<TraductionsLangueResponse> {
    return this.http.put<TraductionsLangueResponse>(`${this.url}/${id}/traductions/${langue}`, requete);
  }
}
