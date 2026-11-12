import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  DemandeAbonnementResponse,
  FiltreDemandes,
  TraitementDemandeRequest,
} from '../models/demande-abonnement.model';
import { PageResponse } from '../models/page.model';

/** Demandes d'augmentation d'abonnement reçues par le super admin (SA-07). */
@Injectable({ providedIn: 'root' })
export class DemandeAbonnementService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/super-admin/demandes-abonnement`;

  /** Toutes, ou filtrées par statut. */
  lister(filtre: FiltreDemandes = {}): Observable<PageResponse<DemandeAbonnementResponse>> {
    let params = new HttpParams().set('page', filtre.page ?? 0).set('taille', filtre.taille ?? 20);
    if (filtre.statut) {
      params = params.set('statut', filtre.statut);
    }
    return this.http.get<PageResponse<DemandeAbonnementResponse>>(this.url, { params });
  }

  /** TRAITEE ou REFUSEE, une seule fois (409 DEMANDE_DEJA_TRAITEE). Aucun effet sur l'abonnement. */
  traiter(id: number, traitement: TraitementDemandeRequest): Observable<DemandeAbonnementResponse> {
    return this.http.patch<DemandeAbonnementResponse>(`${this.url}/${id}`, traitement);
  }
}
