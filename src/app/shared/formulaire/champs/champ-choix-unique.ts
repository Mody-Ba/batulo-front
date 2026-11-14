import { Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatRadioModule } from '@angular/material/radio';
import { QuestionResponse } from '../../../core/models/sondage.model';
import { ValeurReponse } from '../reponses';

/** CHOIX_UNIQUE : une option ; la réponse est la valeur de l'option. */
@Component({
  selector: 'app-champ-choix-unique',
  imports: [ReactiveFormsModule, MatRadioModule],
  template: `
    <mat-radio-group class="liste-choix" [formControl]="controle()" [attr.aria-labelledby]="idLibelle()">
      @for (option of question().options; track option.id) {
        <mat-radio-button [value]="option.valeur">{{ option.libelle }}</mat-radio-button>
      }
    </mat-radio-group>
  `,
  styleUrl: './champs.scss',
})
export class ChampChoixUnique {
  readonly question = input.required<QuestionResponse>();
  readonly controle = input.required<FormControl<ValeurReponse>>();
  readonly idLibelle = input.required<string>();
}
