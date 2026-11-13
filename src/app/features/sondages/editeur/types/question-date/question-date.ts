import { Component, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ControlesDate } from '../formulaires-types';

/** DATE : date minimale et maximale facultatives (AAAA-MM-JJ, la première avant ou égale à la seconde). */
@Component({
  selector: 'app-question-date',
  styleUrl: '../_configuration.scss',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule],
  template: `
    <div class="ligne-champs" [formGroup]="configuration()">
      <mat-form-field>
        <mat-label>Date au plus tôt (facultative)</mat-label>
        <input matInput type="date" formControlName="dateMin" [max]="configuration().controls.dateMax.value || null" />
      </mat-form-field>
      <mat-form-field>
        <mat-label>Date au plus tard (facultative)</mat-label>
        <input matInput type="date" formControlName="dateMax" [min]="configuration().controls.dateMin.value || null" />
      </mat-form-field>
    </div>
    @if (configuration().hasError('bornesInversees')) {
      <p class="erreur-config" role="alert">La date au plus tôt doit précéder ou égaler la date au plus tard.</p>
    }
  `,
})
export class QuestionDate {
  readonly configuration = input.required<FormGroup<ControlesDate>>();
}
