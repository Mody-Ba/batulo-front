import { Component, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ControlesDate } from '../formulaires-types';
import { TranslocoPipe } from '@jsverse/transloco';

/** DATE : date minimale et maximale facultatives (AAAA-MM-JJ, la première avant ou égale à la seconde). */
@Component({
  selector: 'app-question-date',
  styleUrl: '../_configuration.scss',
  imports: [TranslocoPipe, ReactiveFormsModule, MatFormFieldModule, MatInputModule],
  template: `
    <div class="ligne-champs" [formGroup]="configuration()">
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>{{ 'editeur.types.dateMin' | transloco }}</mat-label>
        <input matInput type="date" formControlName="dateMin" [max]="configuration().controls.dateMax.value || null" />
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>{{ 'editeur.types.dateMax' | transloco }}</mat-label>
        <input matInput type="date" formControlName="dateMax" [min]="configuration().controls.dateMin.value || null" />
      </mat-form-field>
    </div>
    @if (configuration().hasError('bornesInversees')) {
      <p class="erreur-config" role="alert">{{ 'editeur.types.datesInversees' | transloco }}</p>
    }
  `,
})
export class QuestionDate {
  readonly configuration = input.required<FormGroup<ControlesDate>>();
}
