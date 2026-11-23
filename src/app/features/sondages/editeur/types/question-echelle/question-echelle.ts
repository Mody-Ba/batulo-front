import { Component, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { REGLES_SONDAGE } from '../../../../../core/utils/regles-question';
import { ControlesEchelle } from '../formulaires-types';
import { TranslocoPipe } from '@jsverse/transloco';

const CRANS_5 = [1, 2, 3, 4, 5];
const CRANS_10 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** ECHELLE : de 1 à 5 ou de 1 à 10, avec des libellés facultatifs pour les deux extrêmes. */
@Component({
  selector: 'app-question-echelle',
  styleUrl: '../_configuration.scss',
  imports: [TranslocoPipe, ReactiveFormsModule, MatButtonToggleModule, MatFormFieldModule, MatInputModule],
  template: `
    <div [formGroup]="configuration()">
      <div class="choix-etendue">
        <span [id]="idEtendue">{{ 'editeur.types.etendue' | transloco }}</span>
        <mat-button-toggle-group
          formControlName="max"
          [attr.aria-labelledby]="idEtendue"
          [hideSingleSelectionIndicator]="true"
        >
          <mat-button-toggle [value]="5">{{ 'editeur.types.unA' | transloco: { max: 5 } }}</mat-button-toggle>
          <mat-button-toggle [value]="10">{{ 'editeur.types.unA' | transloco: { max: 10 } }}</mat-button-toggle>
        </mat-button-toggle-group>
      </div>
      <div class="ligne-champs">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ 'editeur.types.libelleDu' | transloco: { n: 1 } }}</mat-label>
          <input
            matInput
            formControlName="libelleMin"
            [maxlength]="regles.libelleConfigMax"
            [placeholder]="'editeur.types.pasDuTout' | transloco"
          />
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ 'editeur.types.libelleDu' | transloco: { n: configuration().controls.max.value } }}</mat-label>
          <input
            matInput
            formControlName="libelleMax"
            [maxlength]="regles.libelleConfigMax"
            [placeholder]="'editeur.types.toutAFait' | transloco"
          />
        </mat-form-field>
      </div>
    </div>
    <div class="apercu-reponse echelle" aria-hidden="true">
      @for (n of configuration().controls.max.value === 10 ? crans10 : crans5; track n) {
        <span class="cran">{{ n }}</span>
      }
    </div>
  `,
  styles: `
    .choix-etendue {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--bt-espace-3);
      margin-bottom: var(--bt-espace-3);
    }
  `,
})
export class QuestionEchelle {
  private static compteur = 0;
  protected readonly idEtendue = `etendue-echelle-${++QuestionEchelle.compteur}`;
  protected readonly regles = REGLES_SONDAGE;
  protected readonly crans5 = CRANS_5;
  protected readonly crans10 = CRANS_10;
  readonly configuration = input.required<FormGroup<ControlesEchelle>>();
}
