import { Component, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { REGLES_SONDAGE } from '../../../../../core/utils/regles-question';
import { ControlesNumerique } from '../formulaires-types';
import { TranslocoPipe } from '@jsverse/transloco';

/** NUMERIQUE : bornes facultatives (minimum ≤ maximum) et nombre de décimales (0 à 4, 0 par défaut). */
@Component({
  selector: 'app-question-numerique',
  styleUrl: '../_configuration.scss',
  imports: [TranslocoPipe, ReactiveFormsModule, MatFormFieldModule, MatInputModule],
  template: `
    <div class="grille-config" [formGroup]="configuration()">
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>{{ 'editeur.types.minimum' | transloco }}</mat-label>
        <input matInput type="number" inputmode="decimal" formControlName="min" />
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>{{ 'editeur.types.maximum' | transloco }}</mat-label>
        <input matInput type="number" inputmode="decimal" formControlName="max" />
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>{{ 'editeur.types.decimales' | transloco }}</mat-label>
        <input matInput type="number" inputmode="numeric" formControlName="decimales" min="0" [max]="regles.decimalesMax" />
        <mat-hint>{{ 'editeur.types.decimalesAide' | transloco: { max: regles.decimalesMax } }}</mat-hint>
        @if (configuration().controls.decimales.hasError('required')) {
          <mat-error>{{ 'editeur.types.decimalesObligatoire' | transloco }}</mat-error>
        } @else if (configuration().controls.decimales.invalid) {
          <mat-error>{{ 'editeur.types.decimalesInvalide' | transloco: { max: regles.decimalesMax } }}</mat-error>
        }
      </mat-form-field>
    </div>
    @if (configuration().hasError('bornesInversees')) {
      <p class="erreur-config" role="alert">{{ 'editeur.types.bornesInversees' | transloco }}</p>
    }
  `,
})
export class QuestionNumerique {
  protected readonly regles = REGLES_SONDAGE;
  readonly configuration = input.required<FormGroup<ControlesNumerique>>();
}
