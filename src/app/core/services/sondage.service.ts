import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PageResponse } from '../models/page.model';
import {
  ApercuResponse,
  CreationSondageRequest,
  CritereRequest,
  DatesSondageRequest,
  DeplacementQuestionRequest,
  LienSondageResponse,
  FormulaireResponse,
  OrdreRequest,
  QuestionRequest,
  SectionRequest,
  SondageRequest,
  StatutSondage,
  SondageResponse,
  SondageResumeResponse,
  SuiviCollecteResponse,
  VersionResponse,
} from '../models/sondage.model';

export interface FiltreSondages {
  statut?: StatutSondage | null;
  /**
   * true : une ligne par lignée (dernière version publiée en cours ou terminée, sinon le brouillon) ;
   * le statut filtre alors cette ligne.
   */
  derniereVersion?: boolean;
  page?: number;
  taille?: number;
}

/**
 * Sondages. Admin : tous ceux de l'entreprise ; gestionnaire : ceux qu'il a créés ou qui lui sont assignés.
 * Écritures (F5) : admin, ou gestionnaire créateur avec la permission ; contenu modifiable seulement en brouillon
 * (409 SONDAGE_PUBLIE). Chaque écriture du contenu renvoie le sondage complet.
 */
@Injectable({ providedIn: 'root' })
export class SondageService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/sondages`;

  /** Du plus récemment modifié au plus ancien ; une ligne par version sauf avec derniereVersion. */
  lister(filtre: FiltreSondages = {}): Observable<PageResponse<SondageResumeResponse>> {
    let params = new HttpParams().set('page', filtre.page ?? 0).set('taille', filtre.taille ?? 20);
    if (filtre.statut) {
      params = params.set('statut', filtre.statut);
    }
    if (filtre.derniereVersion) {
      params = params.set('derniereVersion', true);
    }
    return this.http.get<PageResponse<SondageResumeResponse>>(this.url, { params });
  }

  detail(id: number): Observable<SondageResponse> {
    return this.http.get<SondageResponse>(`${this.url}/${id}`);
  }

  versions(id: number): Observable<VersionResponse[]> {
    return this.http.get<VersionResponse[]>(`${this.url}/${id}/versions`);
  }

  collecte(id: number): Observable<SuiviCollecteResponse> {
    return this.http.get<SuiviCollecteResponse>(`${this.url}/${id}/collecte`);
  }

  // ---------------------------------------------------------------- Création et en-tête

  /** Vide, ou à partir d'un formulaire de l'entreprise (contenu copié, mêmes valeurs d'options). */
  creer(demande: CreationSondageRequest): Observable<SondageResponse> {
    return this.http.post<SondageResponse>(this.url, demande);
  }

  /** Formulaires réutilisables, modèles d'abord puis du plus récemment modifié. */
  formulaires(modelesSeulement = false, page = 0, taille = 10): Observable<PageResponse<FormulaireResponse>> {
    let params = new HttpParams().set('page', page).set('taille', taille);
    if (modelesSeulement) {
      params = params.set('modelesSeulement', true);
    }
    return this.http.get<PageResponse<FormulaireResponse>>(`${this.url}/formulaires`, { params });
  }

  /** Titre, description et réponse unique (brouillon). */
  modifier(id: number, demande: SondageRequest): Observable<SondageResponse> {
    return this.http.put<SondageResponse>(`${this.url}/${id}`, demande);
  }

  /** Brouillon seulement (409 SONDAGE_PUBLIE sinon). Irréversible. */
  supprimer(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  // ---------------------------------------------------------------- Sections

  ajouterSection(id: number, demande: SectionRequest): Observable<SondageResponse> {
    return this.http.post<SondageResponse>(`${this.url}/${id}/sections`, demande);
  }

  modifierSection(id: number, sectionId: number, demande: SectionRequest): Observable<SondageResponse> {
    return this.http.put<SondageResponse>(`${this.url}/${id}/sections/${sectionId}`, demande);
  }

  /** Supprime aussi ses questions. */
  supprimerSection(id: number, sectionId: number): Observable<SondageResponse> {
    return this.http.delete<SondageResponse>(`${this.url}/${id}/sections/${sectionId}`);
  }

  ordonnerSections(id: number, ordre: OrdreRequest): Observable<SondageResponse> {
    return this.http.put<SondageResponse>(`${this.url}/${id}/sections/ordre`, ordre);
  }

  // ---------------------------------------------------------------- Questions

  ajouterQuestion(id: number, sectionId: number, demande: QuestionRequest): Observable<SondageResponse> {
    return this.http.post<SondageResponse>(`${this.url}/${id}/sections/${sectionId}/questions`, demande);
  }

  modifierQuestion(id: number, questionId: number, demande: QuestionRequest): Observable<SondageResponse> {
    return this.http.put<SondageResponse>(`${this.url}/${id}/questions/${questionId}`, demande);
  }

  supprimerQuestion(id: number, questionId: number): Observable<SondageResponse> {
    return this.http.delete<SondageResponse>(`${this.url}/${id}/questions/${questionId}`);
  }

  /** Vers une autre section (ou une autre position dans la même) ; 400 POSITION_INVALIDE, LIMITE_ATTEINTE. */
  deplacerQuestion(id: number, questionId: number, deplacement: DeplacementQuestionRequest): Observable<SondageResponse> {
    return this.http.put<SondageResponse>(`${this.url}/${id}/questions/${questionId}/section`, deplacement);
  }

  /** Réordonne les questions d'une section (tous ses ids). */
  ordonnerQuestions(id: number, sectionId: number, ordre: OrdreRequest): Observable<SondageResponse> {
    return this.http.put<SondageResponse>(`${this.url}/${id}/sections/${sectionId}/questions/ordre`, ordre);
  }

  // ---------------------------------------------------------------- Cycle de vie (F5b)

  /** Le formulaire tel que le verra le répondant (brouillon compris). */
  apercu(id: number): Observable<ApercuResponse> {
    return this.http.get<ApercuResponse>(`${this.url}/${id}/apercu`);
  }

  /** Brouillon -> publié ; contenu gelé ensuite. 400 SONDAGE_INCOMPLET ou DATES_INVALIDES. */
  publier(id: number, dates: DatesSondageRequest): Observable<SondageResponse> {
    return this.http.post<SondageResponse>(`${this.url}/${id}/publier`, dates);
  }

  /** Sondage publié, pas terminé : ouverture (avant qu'elle n'ait lieu) et fermeture prévue. */
  modifierDates(id: number, dates: DatesSondageRequest): Observable<SondageResponse> {
    return this.http.put<SondageResponse>(`${this.url}/${id}/dates`, dates);
  }

  /** Définitif : TERMINE tout de suite. */
  fermer(id: number): Observable<SondageResponse> {
    return this.http.post<SondageResponse>(`${this.url}/${id}/fermer`, null);
  }

  /** Brouillon de la version N+1 (dernière version publiée seulement). 409 BROUILLON_EXISTANT, VERSION_OBSOLETE. */
  nouvelleVersion(id: number): Observable<SondageResponse> {
    return this.http.post<SondageResponse>(`${this.url}/${id}/nouvelle-version`, null);
  }

  /** Nouveau brouillon indépendant « Copie de ... » (version 1). */
  dupliquer(id: number): Observable<SondageResponse> {
    return this.http.post<SondageResponse>(`${this.url}/${id}/dupliquer`, null);
  }

  marquerModele(id: number, estModele: boolean): Observable<SondageResponse> {
    return this.http.put<SondageResponse>(`${this.url}/${id}/modele`, { estModele });
  }

  /** Réglage d'analyse : permis même après publication. */
  definirCritere(id: number, questionId: number, critere: CritereRequest): Observable<SondageResponse> {
    return this.http.put<SondageResponse>(`${this.url}/${id}/questions/${questionId}/critere`, critere);
  }

  lien(id: number): Observable<LienSondageResponse> {
    return this.http.get<LienSondageResponse>(`${this.url}/${id}/lien`);
  }

  /** Image PNG du QR code du lien public (de 100 à 1000 pixels). */
  qrCode(id: number, taille = 300): Observable<Blob> {
    return this.http.get(`${this.url}/${id}/qr-code`, { params: { taille }, responseType: 'blob' });
  }
}
