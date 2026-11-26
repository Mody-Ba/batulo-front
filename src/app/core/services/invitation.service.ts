import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  EnvoiInvitationsRequest,
  InvitationRequest,
  InvitationResponse,
  RapportEnvoiResponse,
  RapportImportResponse,
  ResumeInvitationsResponse,
  StatutInvitation,
} from '../models/invitation.model';
import { PageResponse } from '../models/page.model';
import { erreurLisible, FichierExporte, nomDepuisEntete } from './export.service';

export interface FiltreInvitations {
  statut?: StatutInvitation | null;
  /** Prénom, nom ou courriel (sans majuscules ni accents côté serveur). */
  recherche?: string | null;
  page?: number;
  taille?: number;
}

/**
 * Invitations nominatives d'un sondage (/api/sondages/{id}/invitations/**, {id} = n'importe quelle version : la liste
 * est celle de la lignée). Accès : admin, gestionnaire créateur ou assigné (sinon 404).
 */
@Injectable({ providedIn: 'root' })
export class InvitationService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/sondages`;

  /** Paginé par ordre d'ajout. */
  lister(id: number, filtre: FiltreInvitations = {}): Observable<PageResponse<InvitationResponse>> {
    let params = new HttpParams().set('page', filtre.page ?? 0).set('taille', filtre.taille ?? 20);
    if (filtre.statut) {
      params = params.set('statut', filtre.statut);
    }
    if (filtre.recherche?.trim()) {
      params = params.set('recherche', filtre.recherche.trim());
    }
    return this.http.get<PageResponse<InvitationResponse>>(`${this.url}/${id}/invitations`, { params });
  }

  resume(id: number): Observable<ResumeInvitationsResponse> {
    return this.http.get<ResumeInvitationsResponse>(`${this.url}/${id}/invitations/resume`);
  }

  /** 400 INVITE_INVALIDE, LANGUE_INVALIDE, LIMITE_ATTEINTE ; 409 INVITE_EXISTANT. */
  ajouter(id: number, invite: InvitationRequest): Observable<InvitationResponse> {
    return this.http.post<InvitationResponse>(`${this.url}/${id}/invitations`, invite);
  }

  /** Le lien personnel ne change pas. 409 INVITE_A_REPONDU, INVITATION_REVOQUEE, INVITE_EXISTANT. */
  modifier(id: number, invitationId: number, invite: InvitationRequest): Observable<InvitationResponse> {
    return this.http.put<InvitationResponse>(`${this.url}/${id}/invitations/${invitationId}`, invite);
  }

  /** Tant qu'il n'a pas répondu (409 INVITE_A_REPONDU). */
  supprimer(id: number, invitationId: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}/invitations/${invitationId}`);
  }

  /** Définitif : le lien personnel ne marche plus. 409 INVITE_A_REPONDU. */
  revoquer(id: number, invitationId: number): Observable<InvitationResponse> {
    return this.http.post<InvitationResponse>(`${this.url}/${id}/invitations/${invitationId}/revoquer`, null);
  }

  /** CSV (champ multipart `fichier`) : 1000 lignes au plus (400 IMPORT_TROP_GRAND). */
  importer(id: number, fichier: File): Observable<RapportImportResponse> {
    const donnees = new FormData();
    donnees.append('fichier', fichier, fichier.name);
    return this.http.post<RapportImportResponse>(`${this.url}/${id}/invitations/import`, donnees);
  }

  /** Identité des invités d'un autre sondage (sans statut ni lien) ; adresses déjà invitées refusées (DEJA_INVITE). */
  reprendre(id: number, sondageSourceId: number): Observable<RapportImportResponse> {
    return this.http.post<RapportImportResponse>(`${this.url}/${id}/invitations/reprendre`, { sondageSourceId });
  }

  /** 202, en arrière-plan. 409 SONDAGE_NON_OUVERT, SONDAGE_FERME ; 429 LIMITE_ENVOIS. */
  envoyer(id: number, demande: EnvoiInvitationsRequest = {}): Observable<RapportEnvoiResponse> {
    return this.http.post<RapportEnvoiResponse>(`${this.url}/${id}/invitations/envoyer`, demande);
  }

  /** 202 ; une relance au plus toutes les 24 h par personne (DELAI_RELANCE). */
  relancer(id: number, demande: EnvoiInvitationsRequest = {}): Observable<RapportEnvoiResponse> {
    return this.http.post<RapportEnvoiResponse>(`${this.url}/${id}/invitations/relancer`, demande);
  }

  /** CSV du suivi, nom donné par le serveur (Content-Disposition). */
  exporter(id: number): Observable<FichierExporte> {
    return this.http
      .get(`${this.url}/${id}/invitations/export`, { responseType: 'blob', observe: 'response' })
      .pipe(
        map((reponse: HttpResponse<Blob>) => ({
          nom: nomDepuisEntete(reponse.headers.get('Content-Disposition')) ?? `invites-sondage-${id}.csv`,
          contenu: reponse.body ?? new Blob(),
        })),
        catchError(erreurLisible),
      );
  }
}
