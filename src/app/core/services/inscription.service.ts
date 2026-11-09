import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { InscriptionRequest, InscriptionResponse } from '../models/inscription.model';

/** Inscription publique de l'admin d'une entreprise. */
@Injectable({ providedIn: 'root' })
export class InscriptionService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/auth/inscription`;

  /** 400 VALIDATION ou MOTS_DE_PASSE_DIFFERENTS, 409 si le courriel est déjà utilisé. */
  inscrire(demande: InscriptionRequest): Observable<InscriptionResponse> {
    return this.http.post<InscriptionResponse>(this.url, demande);
  }
}
