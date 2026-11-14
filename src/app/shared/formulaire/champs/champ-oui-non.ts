import { Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatRadioModule } from '@angular/material/radio';
import { ValeurReponse } from '../reponses';

/** OUI_NON : la réponse est true (oui) ou false (non). */
@Component({
  selector: 'app-champ-oui-non',
  imports: [ReactiveFormsModule, MatRadioModule],
  template: `
    <mat-radio-group class="liste-choix en-ligne" [formControl]="controle()" [attr.aria-labelledby]="idLibelle()">
      <mat-radio-button [value]="true">Oui</mat-radio-button>
      <mat-radio-button [value]="false">Non</mat-radio-button>
    </mat-radio-group>
  `,
  styleUrl: './champs.scss',
})
export class ChampOuiNon {
  readonly controle = input.required<FormControl<ValeurReponse>>();
  readonly idLibelle = input.required<string>();
}
