import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  MessageResponse,
  MotDePasseOublieRequest,
  ReinitialisationMotDePasseRequest,
} from '../models/auth.model';

/** Mot de passe oublié (routes publiques). Le changement connecté est dans AuthService. */
@Injectable({ providedIn: 'root' })
export class MotDePasseService {
  private readonly http = inject(HttpClient);
  private readonly urlAuth = `${environment.apiUrl}/api/auth`;

  /** Même réponse que le courriel existe ou non. */
  demanderReinitialisation(demande: MotDePasseOublieRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.urlAuth}/mot-de-passe-oublie`, demande);
  }

  /** 400 JETON_INVALIDE si le lien est inconnu, expiré ou déjà utilisé. Ferme toutes les sessions. */
  reinitialiser(demande: ReinitialisationMotDePasseRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.urlAuth}/reinitialiser-mot-de-passe`, demande);
  }
}
