import { Component, computed } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ConfigurationNumerique } from '../../../core/models/sondage.model';
import { ChampBase } from './champ-base';

/** NUMERIQUE : champ nombre natif (clavier numérique sur téléphone), bornes et décimales de la question. */
@Component({
  selector: 'app-champ-numerique',
  imports: [ReactiveFormsModule],
  template: `
    <input
      class="champ-saisie court"
      type="number"
      [id]="idChamp"
      [inputMode]="config().decimales ? 'decimal' : 'numeric'"
      [formControl]="$any(controle())"
      [attr.min]="config().min ?? null"
      [attr.max]="config().max ?? null"
      [step]="pas()"
      [attr.aria-describedby]="idsDescription()"
      [attr.aria-invalid]="invalide() || null"
    />
    <div class="indication"><span [id]="idBase() + '-format'">{{ indication() }}</span></div>
  `,
})
export class ChampNumerique extends ChampBase {
  protected readonly config = computed(() => this.question().configuration as Partial<ConfigurationNumerique>);
  protected readonly pas = computed(() => (this.config().decimales ? 10 ** -(this.config().decimales ?? 0) : 1));
  protected readonly indication = computed(() => {
    const { min, max, decimales } = this.config();
    const bornes =
      min !== undefined && max !== undefined
        ? `De ${min} à ${max}`
        : min !== undefined
          ? `Au moins ${min}`
          : max !== undefined
            ? `Au plus ${max}`
            : null;
    const precision = decimales ? `${decimales} décimale${decimales > 1 ? 's' : ''} au plus` : 'Nombre entier';
    return bornes ? `${bornes} · ${precision}` : precision;
  });

  protected idsDescription(): string {
    return [this.decrit(), `${this.idBase()}-format`].filter(Boolean).join(' ');
  }
}
