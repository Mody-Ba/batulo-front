import { HttpClient } from '@angular/common/http';
import { inject, Injectable, Injector, signal } from '@angular/core';
import { catchError, EMPTY, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AbonnementResponse,
  CreditsResponse,
  Formule,
  FormuleResponse,
  IntentionPaiementRequest,
  IntentionPaiementResponse,
  PaiementConfirmeResponse,
  PaiementMobileResponse,
  PaiementResponse,
  StatutPaiementMobileResponse,
} from '../models/abonnement.model';
import { PageResponse } from '../models/page.model';
import { AuthService } from './auth.service';

/**
 * Abonnement de l'entreprise de l'admin connecté, paiement Stripe (carte) et Moosyl (mobile).
 * L'entreprise est lue dans le jeton par le backend : aucun identifiant à passer.
 */
@Injectable({ providedIn: 'root' })
export class AbonnementService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/abonnements`;

  /** AuthService dépend de ce service : il est lu à la demande (crédits reçus d'une réponse). */
  private readonly injector = inject(Injector);
  private readonly _abonnement = signal<AbonnementResponse | null>(null);
  /** Dernier abonnement connu (bandeau, pages d'abonnement). */
  readonly abonnement = this._abonnement.asReadonly();

  /** Formules et prix (route publique). */
  formules(): Observable<FormuleResponse[]> {
    return this.http.get<FormuleResponse[]>(`${this.url}/formules`);
  }

  /** GET /moi ; met à jour le signal partagé. 404 ABONNEMENT_INTROUVABLE s'il n'y en a pas. */
  monAbonnement(): Observable<AbonnementResponse> {
    return this.http
      .get<AbonnementResponse>(`${this.url}/moi`)
      .pipe(
        tap((abonnement) => {
          this._abonnement.set(abonnement);
          this.transmettreCredits(abonnement.credits);
        }),
      );
  }

  /** GET /credits : solde de sondages achetés (admin). */
  credits(): Observable<CreditsResponse> {
    return this.http.get<CreditsResponse>(`${this.url}/credits`).pipe(tap((credits) => this.transmettreCredits(credits)));
  }

  /** Achat de sondages par carte : PaymentIntent de quantité × prix d'un sondage, puis confirmer(). */
  creerIntentionAchat(quantite: number): Observable<IntentionPaiementResponse> {
    return this.http.post<IntentionPaiementResponse>(`${this.url}/achat-sondages/intention`, { quantite });
  }

  /** Achat de sondages par paiement mobile (Moosyl, en MRU) ; suivi par statutMobile(). */
  acheterMobile(quantite: number): Observable<PaiementMobileResponse> {
    return this.http.post<PaiementMobileResponse>(`${this.url}/achat-sondages/paiement-mobile`, { quantite });
  }

  /** Recharge le signal partagé sans remonter d'erreur (bandeau). */
  actualiser(): void {
    this.monAbonnement()
      .pipe(catchError(() => EMPTY))
      .subscribe();
  }

  /** À appeler à la déconnexion : le signal ne doit pas passer à un autre compte. */
  oublier(): void {
    this._abonnement.set(null);
  }

  /** Historique : paiements réussis, du plus récent au plus ancien. */
  paiements(page = 0, taille = 10): Observable<PageResponse<PaiementResponse>> {
    return this.http.get<PageResponse<PaiementResponse>>(`${this.url}/paiements`, { params: { page, taille } });
  }

  /** Crée un PaymentIntent Stripe ; l'abonnement n'est pas modifié à ce stade. */
  creerIntention(demande: IntentionPaiementRequest): Observable<IntentionPaiementResponse> {
    return this.http.post<IntentionPaiementResponse>(`${this.url}/paiement/intention`, demande);
  }

  /**
   * Le backend revérifie le paiement chez Stripe puis active ou prolonge l'abonnement.
   * Idempotent : peut être rappelé sans risque. 400 PAIEMENT_NON_REUSSI si Stripe ne l'a pas validé.
   */
  confirmer(paymentIntentId: string): Observable<PaiementConfirmeResponse> {
    return this.http
      .post<PaiementConfirmeResponse>(`${this.url}/paiement/confirmer`, { paymentIntentId })
      .pipe(tap((reponse) => this.apresPaiement(reponse.abonnement, reponse.credits)));
  }

  /**
   * Paiement mobile (Moosyl, en MRU) : crée le paiement EN_ATTENTE et la session ; l'admin paie sur checkoutUrl.
   * L'abonnement n'est activé qu'à la confirmation de Moosyl (webhook, ou relecture par statutMobile).
   */
  payerMobile(formule: Formule): Observable<PaiementMobileResponse> {
    return this.http.post<PaiementMobileResponse>(`${this.url}/paiement-mobile`, { formule });
  }

  /** Statut d'un paiement mobile ; REUSSI met à jour le signal partagé. */
  statutMobile(reference: string): Observable<StatutPaiementMobileResponse> {
    return this.http
      .get<StatutPaiementMobileResponse>(`${this.url}/paiement-mobile/${encodeURIComponent(reference)}`)
      .pipe(
        tap((reponse) => {
          if (reponse.statut === 'REUSSI') {
            this.apresPaiement(reponse.abonnement, reponse.credits);
          }
        }),
      );
  }

  /** Abonnement et solde reçus après un paiement (abonnement ou achat de sondages). */
  private apresPaiement(abonnement: AbonnementResponse | null | undefined, credits: CreditsResponse | null | undefined): void {
    if (abonnement) {
      this._abonnement.set(credits ? { ...abonnement, credits } : abonnement);
    } else if (credits) {
      this._abonnement.update((a) => (a ? { ...a, credits } : a));
    }
    this.transmettreCredits(credits);
  }

  /** Le solde est gardé dans la session (il décide de l'accès, voir AuthService.compteCredits). */
  private transmettreCredits(credits: CreditsResponse | null | undefined): void {
    if (credits) {
      // Lu par l'injecteur au moment de l'appel : AuthService injecte ce service dans son constructeur.
      this.injector.get(AuthService).mettreAJourCredits(credits);
    }
  }
}
