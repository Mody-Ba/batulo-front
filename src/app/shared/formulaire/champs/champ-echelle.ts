import { Component, computed, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { ConfigurationEchelle, QuestionResponse } from '../../../core/models/sondage.model';
import { ValeurReponse } from '../reponses';

/** ECHELLE : une note entière de 1 à 5 ou de 1 à 10, avec les libellés facultatifs des extrêmes. */
@Component({
  selector: 'app-champ-echelle',
  imports: [ReactiveFormsModule, MatButtonToggleModule],
  template: `
    <div class="echelle">
      <mat-button-toggle-group
        class="crans"
        [formControl]="controle()"
        [attr.aria-labelledby]="idLibelle()"
        [hideSingleSelectionIndicator]="true"
      >
        @for (n of crans(); track n) {
          <mat-button-toggle [value]="n" [attr.aria-label]="libelleCran(n)">{{ n }}</mat-button-toggle>
        }
      </mat-button-toggle-group>
      @if (config().libelleMin || config().libelleMax) {
        <div class="extremes" aria-hidden="true">
          <span>1 : {{ config().libelleMin }}</span>
          <span>{{ max() }} : {{ config().libelleMax }}</span>
        </div>
      }
    </div>
  `,
  styleUrl: './champs.scss',
})
export class ChampEchelle {
  readonly question = input.required<QuestionResponse>();
  readonly controle = input.required<FormControl<ValeurReponse>>();
  readonly idLibelle = input.required<string>();

  protected readonly config = computed(() => this.question().configuration as Partial<ConfigurationEchelle>);
  protected readonly max = computed(() => this.config().max ?? 5);
  protected readonly crans = computed(() => Array.from({ length: this.max() }, (_, i) => i + 1));

  /** Les libellés des extrêmes sont lus avec la note (ils ne sont qu'affichés à côté). */
  protected libelleCran(n: number): string {
    if (n === 1 && this.config().libelleMin) {
      return `1, ${this.config().libelleMin}`;
    }
    if (n === this.max() && this.config().libelleMax) {
      return `${n}, ${this.config().libelleMax}`;
    }
    return String(n);
  }
}
