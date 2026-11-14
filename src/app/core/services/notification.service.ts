import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  NombreNonLuesResponse,
  NotificationResponse,
  NotificationsMarqueesResponse,
} from '../models/notification.model';
import { PageResponse } from '../models/page.model';

/**
 * Notifications de l'utilisateur connecté (tout rôle). `nombreNonLues` est partagé par la cloche de la barre du haut
 * et la page des notifications : marquer lu ici met la cloche à jour.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/notifications`;

  /** Nombre de notifications non lues (pastille de la cloche). */
  readonly nombreNonLues = signal(0);

  /** Les plus récentes d'abord ; taille entre 1 et 100. */
  lister(page = 0, taille = 20): Observable<PageResponse<NotificationResponse>> {
    return this.http.get<PageResponse<NotificationResponse>>(this.url, {
      params: { page, taille },
    });
  }

  /** Relit le nombre de non lues et met la pastille à jour. */
  actualiserNombre(): Observable<NombreNonLuesResponse> {
    return this.http
      .get<NombreNonLuesResponse>(`${this.url}/non-lues/nombre`)
      .pipe(tap((r) => this.nombreNonLues.set(r.nonLues)));
  }

  /** Une notification non lue de moins dans la pastille. */
  marquerLue(id: number): Observable<NotificationResponse> {
    return this.http
      .patch<NotificationResponse>(`${this.url}/${id}/lue`, null)
      .pipe(tap(() => this.nombreNonLues.update((n) => Math.max(0, n - 1))));
  }

  toutMarquerLu(): Observable<NotificationsMarqueesResponse> {
    return this.http
      .patch<NotificationsMarqueesResponse>(`${this.url}/lues`, null)
      .pipe(tap(() => this.nombreNonLues.set(0)));
  }
}
