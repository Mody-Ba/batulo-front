import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { AbonnementResponse } from '../../../core/models/abonnement.model';
import { expireBientot } from '../../../core/models/super-admin.model';

/** « Expire dans 3 jours », « Expire demain », « Expire aujourd’hui ». */
export function libelleJoursRestants(jours: number): string {
  if (jours <= 0) {
    return 'Expire aujourd’hui';
  }
  return jours === 1 ? 'Expire demain' : `Expire dans ${jours} jours`;
}

/**
 * Échéance d'un abonnement dans une liste : date d'expiration (ou « Jamais payé »), et, à 7 jours ou moins,
 * la mention « Expire dans N jours » (en clair, pas seulement par la couleur). La ligne elle-même est mise en
 * évidence par le parent (classe `en-alerte`, avec `expireBientot`).
 */
@Component({
  selector: 'app-echeance-abonnement',
  imports: [DatePipe, MatIconModule],
  template: `
    @if (abonnement()?.dateExpiration; as date) {
      <span>{{ date | date: 'longDate' }}</span>
      @if (alerte(); as texte) {
        <span class="alerte"><mat-icon fontIcon="schedule" aria-hidden="true" />{{ texte }}</span>
      }
    } @else {
      <span class="cellule-secondaire">{{ abonnement() ? 'Jamais payé' : 'Aucun abonnement' }}</span>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--bt-espace-1);
    }

    .alerte {
      display: inline-flex;
      align-items: center;
      gap: var(--bt-espace-1);
      color: var(--bt-attente-texte);
      font: var(--mat-sys-label-large);

      .mat-icon {
        width: 18px;
        height: 18px;
        font-size: 18px;
      }
    }
  `,
})
export class EcheanceAbonnement {
  readonly abonnement =
    input.required<Pick<AbonnementResponse, 'statut' | 'dateExpiration' | 'joursRestants'> | null>();

  protected readonly alerte = computed(() => {
    const abonnement = this.abonnement();
    return abonnement && abonnement.joursRestants !== null && expireBientot(abonnement)
      ? libelleJoursRestants(abonnement.joursRestants)
      : null;
  });
}
