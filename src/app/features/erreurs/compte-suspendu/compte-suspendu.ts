import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

/**
 * Accès impossible à cause de l'abonnement : entreprise désactivée par Batulo, ou (gestionnaire)
 * abonnement de l'entreprise en attente de paiement.
 */
@Component({
  selector: 'app-compte-suspendu',
  imports: [MatIconModule, MatButtonModule, RouterLink],
  template: `
    <section class="conteneur-page etroit page-erreur">
      <span class="icone-erreur" aria-hidden="true">
        <mat-icon fontIcon="lock_person" aria-hidden="true" />
      </span>
      <h1>{{ titre() }}</h1>
      <p>{{ explication() }}</p>
      <div class="actions">
        @if (auth.redirectionObligatoire() === null) {
          <a mat-flat-button class="bouton-principal" [routerLink]="auth.urlAccueil()">
            <mat-icon fontIcon="home" aria-hidden="true" />Retour à l’accueil
          </a>
        }
        <button mat-stroked-button type="button" (click)="auth.deconnexion()">
          <mat-icon fontIcon="logout" aria-hidden="true" />Se déconnecter
        </button>
      </div>
    </section>
  `,
  styleUrl: '../page-erreur.scss',
})
export class CompteSuspendu {
  protected readonly auth = inject(AuthService);

  protected readonly titre = computed(() =>
    this.auth.statutAbonnement() === 'DESACTIVE' ? 'Accès suspendu' : 'Abonnement non actif',
  );

  protected readonly explication = computed(() => {
    switch (this.auth.statutAbonnement()) {
      case 'DESACTIVE':
        return 'Votre entreprise a été désactivée par Batulo : aucun accès n’est possible pour le moment. Contactez Batulo pour en savoir plus.';
      case 'EN_ATTENTE_PAIEMENT':
        return 'L’abonnement de votre entreprise n’est pas encore payé. Votre administrateur doit choisir une formule pour que vous puissiez accéder à Batulo.';
      default:
        return 'Votre accès est de nouveau ouvert.';
    }
  });
}
