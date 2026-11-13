import { Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { EtatEnregistrement } from '../enregistrement-auto';

const LIBELLES: Record<EtatEnregistrement, string> = {
  enregistre: 'Enregistré',
  modifie: 'Modifications non enregistrées',
  invalide: 'À corriger avant l’enregistrement',
  enregistrement: 'Enregistrement…',
  erreur: 'Échec de l’enregistrement',
};

const ICONES: Partial<Record<EtatEnregistrement, string>> = {
  enregistre: 'cloud_done',
  modifie: 'edit',
  invalide: 'error_outline',
  erreur: 'cloud_off',
};

/** Indicateur « Enregistré » d'un élément de l'éditeur (en-tête, section ou question), annoncé poliment. */
@Component({
  selector: 'app-etat-enregistrement',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <span class="etat" [class]="'etat-' + etat()" role="status" aria-live="polite">
      @if (etat() === 'enregistrement') {
        <mat-spinner diameter="16" aria-hidden="true" />
      } @else {
        <mat-icon [fontIcon]="icone()" aria-hidden="true" />
      }
      {{ libelle() }}
    </span>
    @if (etat() === 'erreur') {
      <button matButton type="button" (click)="reessayer.emit()">Réessayer</button>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--bt-espace-2);
    }

    .etat {
      display: inline-flex;
      align-items: center;
      gap: var(--bt-espace-1);
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-medium);

      .mat-icon {
        width: 18px;
        height: 18px;
        font-size: 18px;
      }
    }

    .etat-enregistre {
      color: var(--bt-succes-texte);
    }

    .etat-invalide,
    .etat-erreur {
      color: var(--mat-sys-error);
    }
  `,
})
export class EtatEnregistrementIndicateur {
  readonly etat = input.required<EtatEnregistrement>();
  /** Remplace le libellé (ex. « Tout est enregistré » pour l'indicateur global). */
  readonly libelleEnregistre = input<string | null>(null);
  readonly reessayer = output<void>();

  protected readonly icone = computed(() => ICONES[this.etat()] ?? 'cloud_done');
  protected readonly libelle = computed(() =>
    this.etat() === 'enregistre' && this.libelleEnregistre() ? this.libelleEnregistre()! : LIBELLES[this.etat()],
  );
}
