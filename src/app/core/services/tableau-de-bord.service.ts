import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TableauDeBordResponse } from '../models/tableau-de-bord.model';

/** Tableau de bord de l'admin connecté (comptages calculés par le backend). */
@Injectable({ providedIn: 'root' })
export class TableauDeBordService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/admin/tableau-de-bord`;

  lire(): Observable<TableauDeBordResponse> {
    return this.http.get<TableauDeBordResponse>(this.url);
  }
}
