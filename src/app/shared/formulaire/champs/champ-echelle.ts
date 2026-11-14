import { Component, computed } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ConfigurationEchelle } from '../../../core/models/sondage.model';
import { ChampBase } from './champ-base';

/** ECHELLE : une note entière de 1 à 5 ou de 1 à 10 (boutons radio natifs présentés en crans). */
@Component({
  selector: 'app-champ-echelle',
  imports: [ReactiveFormsModule],
  template: `
    <div class="crans" role="radiogroup" [attr.aria-labelledby]="idLibelle" [attr.aria-describedby]="decrit()" [attr.aria-invalid]="invalide() || null">
      @for (n of crans(); track n) {
        <label class="cran">
          <input type="radio" [name]="idBase()" [attr.name]="idBase()" [value]="n" [formControl]="$any(controle())" [attr.aria-label]="libelleCran(n)" />
          <span aria-hidden="true">{{ n }}</span>
        </label>
      }
    </div>
    @if (config().libelleMin || config().libelleMax) {
      <div class="extremes" aria-hidden="true">
        <span>1 : {{ config().libelleMin }}</span>
        <span>{{ max() }} : {{ config().libelleMax }}</span>
      </div>
    }
  `,
})
export class ChampEchelle extends ChampBase {
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
