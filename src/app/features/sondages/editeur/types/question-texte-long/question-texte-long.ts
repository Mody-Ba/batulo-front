import { Component, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { REGLES_SONDAGE } from '../../../../../core/utils/regles-question';
import { ControlesTexte } from '../formulaires-types';

/** TEXTE_LONG : réponse sur plusieurs lignes, longueur maximale de 1 à 5000 caractères (2000 par défaut). */
@Component({
  selector: 'app-question-texte-long',
  styleUrl: '../_configuration.scss',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule],
  template: `
    <div class="ligne-config" [formGroup]="configuration()">
      <mat-form-field>
        <mat-label>Longueur maximale</mat-label>
        <input matInput type="number" inputmode="numeric" formControlName="longueurMax" min="1" [max]="max" />
        <span matTextSuffix>caractères</span>
        <mat-hint>De 1 à {{ max }}</mat-hint>
        @if (configuration().controls.longueurMax.hasError('required')) {
          <mat-error>La longueur maximale est obligatoire.</mat-error>
        } @else if (configuration().controls.longueurMax.hasError('entier')) {
          <mat-error>Un nombre entier.</mat-error>
        } @else if (
          configuration().controls.longueurMax.hasError('min') || configuration().controls.longueurMax.hasError('max')
        ) {
          <mat-error>Entre 1 et {{ max }} caractères.</mat-error>
        }
      </mat-form-field>
    </div>
    <div class="apercu-reponse" aria-hidden="true"><span class="faux-champ long">Réponse longue</span></div>
  `,
})
export class QuestionTexteLong {
  protected readonly max = REGLES_SONDAGE.texteLongMax;
  readonly configuration = input.required<FormGroup<ControlesTexte>>();
}
