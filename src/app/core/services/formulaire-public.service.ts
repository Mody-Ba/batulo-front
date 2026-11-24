import { HttpClient, HttpContext, HttpHeaders } from '@angular/common/http';
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

  /**
   * `jetonRepondant` (s'il existe déjà sur cet appareil) : envoyé dans l'en-tête X-Jeton-Repondant, jamais dans
   * l'URL ; le backend répond alors `dejaRepondu` pour un sondage à réponse unique. `langue` : langue du contenu
   * souhaitée (non proposée : la principale ; la langue servie est dans `langue` de la réponse).
   */
  lire(jeton: string, jetonRepondant?: string | null, langue?: string | null): Observable<FormulairePublicResponse> {
    return this.http.get<FormulairePublicResponse>(`${this.url}/${encodeURIComponent(jeton)}`, {
      context: this.contexte(),
      ...(langue ? { params: { langue } } : {}),
      ...(jetonRepondant ? { headers: new HttpHeaders({ 'X-Jeton-Repondant': jetonRepondant }) } : {}),
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
