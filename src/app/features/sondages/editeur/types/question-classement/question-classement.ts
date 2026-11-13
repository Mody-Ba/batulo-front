import { Component, input } from '@angular/core';
import { FormArray } from '@angular/forms';
import { EditeurOptions } from '../editeur-options/editeur-options';
import { ControleOption } from '../formulaires-types';

/** CLASSEMENT : le répondant range les options par ordre de préférence (au moins 2). */
@Component({
  selector: 'app-question-classement',
  imports: [EditeurOptions],
  template: `<app-editeur-options [options]="options()" marqueur="rang" />`,
})
export class QuestionClassement {
  readonly options = input.required<FormArray<ControleOption>>();
}
