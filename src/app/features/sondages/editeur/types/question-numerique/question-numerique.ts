import { Component, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { REGLES_SONDAGE } from '../../../../../core/utils/regles-question';
import { ControlesNumerique } from '../formulaires-types';

/** NUMERIQUE : bornes facultatives (minimum ≤ maximum) et nombre de décimales (0 à 4, 0 par défaut). */
@Component({
  selector: 'app-question-numerique',
  styleUrl: '../_configuration.scss',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule],
  template: `
    <div class="grille-config" [formGroup]="configuration()">
      <mat-form-field>
        <mat-label>Minimum (facultatif)</mat-label>
        <input matInput type="number" inputmode="decimal" formControlName="min" />
      </mat-form-field>
      <mat-form-field>
        <mat-label>Maximum (facultatif)</mat-label>
        <input matInput type="number" inputmode="decimal" formControlName="max" />
      </mat-form-field>
      <mat-form-field>
        <mat-label>Décimales</mat-label>
        <input matInput type="number" inputmode="numeric" formControlName="decimales" min="0" [max]="regles.decimalesMax" />
        <mat-hint>De 0 (nombre entier) à {{ regles.decimalesMax }}</mat-hint>
        @if (configuration().controls.decimales.hasError('required')) {
          <mat-error>Le nombre de décimales est obligatoire.</mat-error>
        } @else if (configuration().controls.decimales.invalid) {
          <mat-error>Un nombre entier de 0 à {{ regles.decimalesMax }}.</mat-error>
        }
      </mat-form-field>
    </div>
    @if (configuration().hasError('bornesInversees')) {
      <p class="erreur-config" role="alert">Le minimum doit être inférieur ou égal au maximum.</p>
    }
    <div class="apercu-reponse" aria-hidden="true"><span class="faux-champ court">0</span></div>
  `,
})
export class QuestionNumerique {
  protected readonly regles = REGLES_SONDAGE;
  readonly configuration = input.required<FormGroup<ControlesNumerique>>();
}
