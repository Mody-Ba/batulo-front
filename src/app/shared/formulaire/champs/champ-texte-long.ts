import { TextFieldModule } from '@angular/cdk/text-field';
import { Component, computed, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ConfigurationTexte, QuestionResponse } from '../../../core/models/sondage.model';
import { ValeurReponse } from '../reponses';

/** TEXTE_LONG : réponse sur plusieurs lignes, jusqu'à longueurMax caractères. */
@Component({
  selector: 'app-champ-texte-long',
  imports: [TextFieldModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule],
  template: `
    <mat-form-field class="champ-texte">
      <textarea matInput [formControl]="$any(controle())" cdkTextareaAutosize cdkAutosizeMinRows="3" [attr.aria-labelledby]="idLibelle()" [attr.maxlength]="longueurMax()"></textarea>
      <mat-hint align="end">{{ longueur() }} / {{ longueurMax() }}</mat-hint>
    </mat-form-field>
  `,
  styleUrl: './champs.scss',
})
export class ChampTexteLong {
  readonly question = input.required<QuestionResponse>();
  readonly controle = input.required<FormControl<ValeurReponse>>();
  readonly idLibelle = input.required<string>();

  protected readonly longueurMax = computed(
    () => (this.question().configuration as Partial<ConfigurationTexte>).longueurMax ?? 5000,
  );

  protected longueur(): number {
    const valeur = this.controle().value;
    return typeof valeur === 'string' ? valeur.length : 0;
  }
}
