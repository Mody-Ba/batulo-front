import { Component, computed, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ConfigurationDate, QuestionResponse } from '../../../core/models/sondage.model';
import { formaterDate, ValeurReponse } from '../reponses';

/** DATE : une date AAAA-MM-JJ (sélecteur natif, adapté au téléphone), entre dateMin et dateMax si définies. */
@Component({
  selector: 'app-champ-date',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule],
  template: `
    <mat-form-field class="champ-court">
      <input
        matInput
        type="date"
        [formControl]="$any(controle())"
        [attr.min]="config().dateMin ?? null"
        [attr.max]="config().dateMax ?? null"
        [attr.aria-labelledby]="idLibelle()"
      />
      @if (indication(); as texte) {
        <mat-hint>{{ texte }}</mat-hint>
      }
    </mat-form-field>
  `,
  styleUrl: './champs.scss',
})
export class ChampDate {
  readonly question = input.required<QuestionResponse>();
  readonly controle = input.required<FormControl<ValeurReponse>>();
  readonly idLibelle = input.required<string>();

  protected readonly config = computed(() => this.question().configuration as Partial<ConfigurationDate>);
  protected readonly indication = computed(() => {
    const { dateMin, dateMax } = this.config();
    if (dateMin && dateMax) {
      return `Du ${formaterDate(dateMin)} au ${formaterDate(dateMax)}`;
    }
    return dateMin ? `À partir du ${formaterDate(dateMin)}` : dateMax ? `Jusqu’au ${formaterDate(dateMax)}` : null;
  });
}
