import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SANS_AUTHENTIFICATION } from '../interceptors/contexte-http';
import {
  ConfirmationReponseResponse,
  FormulairePublicResponse,
  SoumissionRequest,
} from '../models/formulaire-public.model';

/**
 * Formulaire public du répondant (sans compte). Contexte SANS_AUTHENTIFICATION : même connecté, aucun jeton n'est
 * envoyé, et l'intercepteur ne rafraîchit ni ne redirige (les 403/410 sont des états du sondage, pas du compte).
 */
@Injectable({ providedIn: 'root' })
export class FormulairePublicService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/public/sondages`;
  private readonly contexte = () => new HttpContext().set(SANS_AUTHENTIFICATION, true);

  lire(jeton: string): Observable<FormulairePublicResponse> {
    return this.http.get<FormulairePublicResponse>(`${this.url}/${encodeURIComponent(jeton)}`, {
      context: this.contexte(),
    });
  }

  repondre(jeton: string, soumission: SoumissionRequest): Observable<ConfirmationReponseResponse> {
    return this.http.post<ConfirmationReponseResponse>(
      `${this.url}/${encodeURIComponent(jeton)}/reponses`,
      soumission,
      { context: this.contexte() },
    );
  }
}
