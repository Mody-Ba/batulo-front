import { Component, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { REGLES_SONDAGE } from '../../../../../core/utils/regles-question';
import { ControlesTexte } from '../formulaires-types';

/** TEXTE_COURT : réponse sur une ligne, longueur maximale de 1 à 255 caractères (255 par défaut). */
@Component({
  selector: 'app-question-texte-court',
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
    <div class="apercu-reponse" aria-hidden="true"><span class="faux-champ">Réponse courte</span></div>
  `,
})
export class QuestionTexteCourt {
  protected readonly max = REGLES_SONDAGE.texteCourtMax;
  readonly configuration = input.required<FormGroup<ControlesTexte>>();
}
