import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  NombreNonLuesResponse,
  NotificationResponse,
  NotificationsMarqueesResponse,
} from '../models/notification.model';
import { PageResponse } from '../models/page.model';

/** Notifications du tableau de bord de l'utilisateur connecté (tout rôle). */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/notifications`;

  /** Les plus récentes d'abord ; taille entre 1 et 100. */
  lister(page = 0, taille = 20): Observable<PageResponse<NotificationResponse>> {
    return this.http.get<PageResponse<NotificationResponse>>(this.url, {
      params: { page, taille },
    });
  }

  nombreNonLues(): Observable<NombreNonLuesResponse> {
    return this.http.get<NombreNonLuesResponse>(`${this.url}/non-lues/nombre`);
  }

  marquerLue(id: number): Observable<NotificationResponse> {
    return this.http.patch<NotificationResponse>(`${this.url}/${id}/lue`, null);
  }

  toutMarquerLu(): Observable<NotificationsMarqueesResponse> {
    return this.http.patch<NotificationsMarqueesResponse>(`${this.url}/lues`, null);
  }
}
