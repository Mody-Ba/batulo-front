import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PageResponse } from '../models/page.model';
import {
  AbonnementAdminResponse,
  AdminDetailResponse,
  CreationAdminRequest,
  FiltreAbonnements,
  ModificationAdminRequest,
  MotDePasseTemporaireResponse,
} from '../models/super-admin.model';

/** Comptes admin et abonnements des entreprises (rôle SUPER_ADMIN). */
@Injectable({ providedIn: 'root' })
export class SuperAdminService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/super-admin`;

  /** L'admin, l'abonnement de son entreprise et son nombre de gestionnaires. */
  detailAdmin(id: number): Observable<AdminDetailResponse> {
    return this.http.get<AdminDetailResponse>(`${this.url}/admins/${id}`);
  }

  /** Crée l'entreprise, l'admin (mot de passe temporaire par courriel) et un abonnement en attente de paiement. */
  creerAdmin(demande: CreationAdminRequest): Observable<AdminDetailResponse> {
    return this.http.post<AdminDetailResponse>(`${this.url}/admins`, demande);
  }

  /** 409 si le courriel est déjà utilisé par un autre compte. */
  modifierAdmin(id: number, demande: ModificationAdminRequest): Observable<AdminDetailResponse> {
    return this.http.put<AdminDetailResponse>(`${this.url}/admins/${id}`, demande);
  }

  /** Irréversible : supprime aussi l'entreprise, ses gestionnaires, ses sondages, son abonnement et ses paiements. */
  supprimerAdmin(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/admins/${id}`);
  }

  /** Réactive l'admin et ses gestionnaires ; le statut de l'abonnement est recalculé selon les dates. */
  activerAdmin(id: number): Observable<AdminDetailResponse> {
    return this.http.patch<AdminDetailResponse>(`${this.url}/admins/${id}/activer`, null);
  }

  /** Bloque l'admin et ses gestionnaires ; l'abonnement passe à DESACTIVE. */
  desactiverAdmin(id: number): Observable<AdminDetailResponse> {
    return this.http.patch<AdminDetailResponse>(`${this.url}/admins/${id}/desactiver`, null);
  }

  /** Nouveau mot de passe temporaire (24 h) envoyé par courriel ; l'ancien ne fonctionne plus. */
  renvoyerMotDePasseTemporaire(id: number): Observable<MotDePasseTemporaireResponse> {
    return this.http.post<MotDePasseTemporaireResponse>(`${this.url}/admins/${id}/mot-de-passe-temporaire`, null);
  }

  /** Statut facultatif, recalculé à partir des dates par le serveur. */
  listerAbonnements(filtre: FiltreAbonnements = {}): Observable<PageResponse<AbonnementAdminResponse>> {
    let params = new HttpParams().set('page', filtre.page ?? 0).set('taille', filtre.taille ?? 20);
    if (filtre.statut) {
      params = params.set('statut', filtre.statut);
    }
    return this.http.get<PageResponse<AbonnementAdminResponse>>(`${this.url}/abonnements`, { params });
  }
}
