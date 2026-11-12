import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, EMPTY, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AbonnementResponse,
  FormuleResponse,
  IntentionPaiementRequest,
  IntentionPaiementResponse,
  PaiementConfirmeResponse,
  PaiementResponse,
} from '../models/abonnement.model';
import { PageResponse } from '../models/page.model';

/**
 * Abonnement de l'entreprise de l'admin connecté et paiement Stripe.
 * L'entreprise est lue dans le jeton par le backend : aucun identifiant à passer.
 */
@Injectable({ providedIn: 'root' })
export class AbonnementService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/abonnements`;

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
      .pipe(tap((abonnement) => this._abonnement.set(abonnement)));
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
      .pipe(tap((reponse) => this._abonnement.set(reponse.abonnement)));
  }
}
