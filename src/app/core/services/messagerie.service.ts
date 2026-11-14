import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ConversationResponse,
  MessageInterneResponse,
  OuvertureConversationRequest,
} from '../models/messagerie.model';
import { NombreNonLuesResponse, NotificationsMarqueesResponse } from '../models/notification.model';
import { PageResponse } from '../models/page.model';

/**
 * Messagerie interne : conversations à deux, toujours ancrées sur un admin (avec un de ses gestionnaires, ou avec
 * Batulo). `nombreNonLus` est partagé (badge du menu) et mis à jour par la page et l'interrogation périodique.
 */
@Injectable({ providedIn: 'root' })
export class MessagerieService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/messagerie`;

  /** Messages non lus, toutes conversations confondues (badge « Messagerie » du menu). */
  readonly nombreNonLus = signal(0);

  conversations(page = 0, taille = 50): Observable<PageResponse<ConversationResponse>> {
    return this.http.get<PageResponse<ConversationResponse>>(`${this.url}/conversations`, { params: { page, taille } });
  }

  /** Ouvre la conversation, ou retrouve celle qui existe déjà. */
  ouvrir(demande: OuvertureConversationRequest): Observable<ConversationResponse> {
    return this.http.post<ConversationResponse>(`${this.url}/conversations`, demande);
  }

  /** Les plus récents d'abord ; ne les marque pas comme lus. */
  messages(conversationId: number, page = 0, taille = 30): Observable<PageResponse<MessageInterneResponse>> {
    return this.http.get<PageResponse<MessageInterneResponse>>(`${this.url}/conversations/${conversationId}/messages`, {
      params: { page, taille },
    });
  }

  /** 403 ABONNEMENT_EXPIRE pour une conversation admin ↔ gestionnaire si l'abonnement n'est pas actif. */
  envoyer(conversationId: number, contenu: string): Observable<MessageInterneResponse> {
    return this.http.post<MessageInterneResponse>(`${this.url}/conversations/${conversationId}/messages`, { contenu });
  }

  /** Marque comme lus les messages reçus ; le badge est diminué d'autant. */
  marquerLue(conversationId: number): Observable<NotificationsMarqueesResponse> {
    return this.http
      .post<NotificationsMarqueesResponse>(`${this.url}/conversations/${conversationId}/lu`, null)
      .pipe(tap((r) => this.nombreNonLus.update((n) => Math.max(0, n - r.nombreMarquees))));
  }

  actualiserNombre(): Observable<NombreNonLuesResponse> {
    return this.http
      .get<NombreNonLuesResponse>(`${this.url}/non-lus`)
      .pipe(tap((r) => this.nombreNonLus.set(r.nonLues)));
  }
}
