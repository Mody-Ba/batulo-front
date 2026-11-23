import { Component, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { REGLES_SONDAGE } from '../../../../../core/utils/regles-question';
import { ControlesTexte } from '../formulaires-types';
import { TranslocoPipe } from '@jsverse/transloco';

/** TEXTE_LONG : réponse sur plusieurs lignes, longueur maximale de 1 à 5000 caractères (2000 par défaut). */
@Component({
  selector: 'app-question-texte-long',
  styleUrl: '../_configuration.scss',
  imports: [TranslocoPipe, ReactiveFormsModule, MatFormFieldModule, MatInputModule],
  template: `
    <div class="ligne-config" [formGroup]="configuration()">
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>{{ 'editeur.types.longueurMax' | transloco }}</mat-label>
        <input matInput type="number" inputmode="numeric" formControlName="longueurMax" min="1" [max]="max" />
        <span matTextSuffix>{{ 'editeur.types.caracteres' | transloco }}</span>
        <mat-hint>{{ 'editeur.types.de1A' | transloco: { max: max } }}</mat-hint>
        @if (configuration().controls.longueurMax.hasError('required')) {
          <mat-error>{{ 'editeur.types.longueurObligatoire' | transloco }}</mat-error>
        } @else if (configuration().controls.longueurMax.hasError('entier')) {
          <mat-error>{{ 'editeur.types.nombreEntier' | transloco }}</mat-error>
        } @else if (
          configuration().controls.longueurMax.hasError('min') || configuration().controls.longueurMax.hasError('max')
        ) {
          <mat-error>{{ 'editeur.types.entre1Et' | transloco: { max: max } }}</mat-error>
        }
      </mat-form-field>
    </div>
    <div class="apercu-reponse" aria-hidden="true"><span class="faux-champ long">{{ 'editeur.types.reponseLong' | transloco }}</span></div>
  `,
})
export class QuestionTexteLong {
  protected readonly max = REGLES_SONDAGE.texteLongMax;
  readonly configuration = input.required<FormGroup<ControlesTexte>>();
}
