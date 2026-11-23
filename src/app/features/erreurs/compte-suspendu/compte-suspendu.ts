import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { traduire } from '../../../core/i18n/traduire';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * Accès impossible à cause de l'abonnement : entreprise désactivée par Batulo, ou (gestionnaire)
 * abonnement de l'entreprise en attente de paiement.
 */
@Component({
  selector: 'app-compte-suspendu',
  imports: [TranslocoPipe, MatIconModule, MatButtonModule, RouterLink],
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
            <mat-icon fontIcon="home" aria-hidden="true" />{{ 'commun.retourAccueil' | transloco }}
          </a>
        }
        <button mat-stroked-button type="button" (click)="auth.deconnexion()">
          <mat-icon fontIcon="logout" aria-hidden="true" />{{ 'barre.seDeconnecter' | transloco }}
        </button>
      </div>
    </section>
  `,
  styleUrl: '../page-erreur.scss',
})
export class CompteSuspendu {
  protected readonly auth = inject(AuthService);

  protected readonly titre = computed(() =>
    traduire(this.auth.statutAbonnement() === 'DESACTIVE' ? 'erreurs.suspendu.titreDesactive' : 'erreurs.suspendu.titreNonActif'),
  );

  protected readonly explication = computed(() => {
    switch (this.auth.statutAbonnement()) {
      case 'DESACTIVE':
        return traduire('erreurs.suspendu.desactive');
      case 'EN_ATTENTE_PAIEMENT':
        return traduire('erreurs.suspendu.enAttente');
      default:
        return traduire('erreurs.suspendu.ouvert');
    }
  });
}
