import { Component, computed, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ConfigurationNumerique, QuestionResponse } from '../../../core/models/sondage.model';
import { ValeurReponse } from '../reponses';

/** NUMERIQUE : un nombre, entre min et max s'ils sont définis, avec au plus `decimales` décimales. */
@Component({
  selector: 'app-champ-numerique',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule],
  template: `
    <mat-form-field class="champ-court">
      <input
        matInput
        type="number"
        [inputMode]="config().decimales ? 'decimal' : 'numeric'"
        [formControl]="$any(controle())"
        [attr.min]="config().min ?? null"
        [attr.max]="config().max ?? null"
        [step]="pas()"
        [attr.aria-labelledby]="idLibelle()"
      />
      @if (indication(); as texte) {
        <mat-hint>{{ texte }}</mat-hint>
      }
    </mat-form-field>
  `,
  styleUrl: './champs.scss',
})
export class ChampNumerique {
  readonly question = input.required<QuestionResponse>();
  readonly controle = input.required<FormControl<ValeurReponse>>();
  readonly idLibelle = input.required<string>();

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
}
