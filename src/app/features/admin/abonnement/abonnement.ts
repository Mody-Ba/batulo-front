import { Component, inject } from '@angular/core';
import { LIBELLES_STATUT_ABONNEMENT } from '../../../core/models/abonnement.model';
import { AuthService } from '../../../core/services/auth.service';
import { Encadre } from '../../../shared/components/encadre/encadre';
import { EntetePage } from '../../../shared/components/entete-page/entete-page';

/**
 * Abonnement de l'admin. Seule page permise tant que l'abonnement est EN_ATTENTE_PAIEMENT.
 * Formules et paiement Stripe : étape F2.
 */
@Component({
  selector: 'app-abonnement',
  imports: [EntetePage, Encadre],
  template: `
    <section class="conteneur-page">
      <app-entete-page titre="Abonnement" icone="card_membership" />

      @if (auth.statutAbonnement(); as statut) {
        <p>
          Statut :
          <span class="pastille-statut" [class]="'statut-' + statut">{{ libelles[statut] }}</span>
        </p>
      }

      @if (auth.statutAbonnement() === 'EN_ATTENTE_PAIEMENT') {
        <app-encadre type="avertissement" role="status" icone="hourglass_top">
          <p>Votre compte est créé. Choisissez une formule et payez-la pour accéder à Batulo.</p>
          <p>Le paiement en ligne sera disponible très prochainement.</p>
        </app-encadre>
      } @else {
        <app-encadre type="info" icone="construction">
          <p>Le détail et le renouvellement de l’abonnement seront disponibles prochainement.</p>
        </app-encadre>
      }
    </section>
  `,
})
export class Abonnement {
  protected readonly auth = inject(AuthService);
  protected readonly libelles = LIBELLES_STATUT_ABONNEMENT;
}
