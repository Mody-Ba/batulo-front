import { Component, input, output, viewChild } from '@angular/core';
import { MatChipListbox, MatChipsModule } from '@angular/material/chips';
import { LIBELLES_STATUT_ABONNEMENT, StatutAbonnement } from '../../../core/models/abonnement.model';
import { STATUTS_ABONNEMENT } from '../../../core/models/super-admin.model';

/**
 * Pastilles de filtre par statut d'abonnement (« Tous » + les cinq statuts). Le parent garde le statut
 * dans l'URL et le passe en entrée ; `changer` émet le statut choisi, ou null pour « Tous ».
 */
@Component({
  selector: 'app-filtre-statut-abonnement',
  imports: [MatChipsModule],
  template: `
    <mat-chip-listbox
      aria-label="Filtrer par statut d’abonnement"
      [value]="statut() ?? 'tous'"
      (change)="choisir($event.value)"
      [hideSingleSelectionIndicator]="true"
    >
      <mat-chip-option value="tous">Tous</mat-chip-option>
      @for (s of statuts; track s) {
        <mat-chip-option [value]="s">{{ libelles[s] }}</mat-chip-option>
      }
    </mat-chip-listbox>
  `,
})
export class FiltreStatutAbonnement {
  protected readonly statuts = STATUTS_ABONNEMENT;
  protected readonly libelles = LIBELLES_STATUT_ABONNEMENT;

  readonly statut = input<StatutAbonnement | null>(null);
  readonly changer = output<StatutAbonnement | null>();

  private readonly listbox = viewChild.required(MatChipListbox);

  protected choisir(valeur: unknown): void {
    // Un clic sur la pastille déjà choisie la désélectionne : on revient à « Tous ».
    const statut = STATUTS_ABONNEMENT.find((s) => s === valeur) ?? null;
    if (statut !== this.statut()) {
      this.changer.emit(statut);
    } else {
      // Clic sur « Tous » déjà choisi : la pastille reste sélectionnée.
      this.listbox().value = this.statut() ?? 'tous';
    }
  }
}
