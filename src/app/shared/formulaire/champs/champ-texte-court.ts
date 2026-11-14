import { Component, computed, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ConfigurationTexte, QuestionResponse } from '../../../core/models/sondage.model';
import { ValeurReponse } from '../reponses';

/** TEXTE_COURT : réponse sur une ligne, jusqu'à longueurMax caractères. */
@Component({
  selector: 'app-champ-texte-court',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule],
  template: `
    <mat-form-field class="champ-texte">
      <input matInput [formControl]="$any(controle())" autocomplete="off" [attr.aria-labelledby]="idLibelle()" [attr.maxlength]="longueurMax()" />
      <mat-hint align="end">{{ longueur() }} / {{ longueurMax() }}</mat-hint>
    </mat-form-field>
  `,
  styleUrl: './champs.scss',
})
export class ChampTexteCourt {
  readonly question = input.required<QuestionResponse>();
  readonly controle = input.required<FormControl<ValeurReponse>>();
  readonly idLibelle = input.required<string>();

  protected readonly longueurMax = computed(
    () => (this.question().configuration as Partial<ConfigurationTexte>).longueurMax ?? 255,
  );

  protected longueur(): number {
    const valeur = this.controle().value;
    return typeof valeur === 'string' ? valeur.length : 0;
  }
}
