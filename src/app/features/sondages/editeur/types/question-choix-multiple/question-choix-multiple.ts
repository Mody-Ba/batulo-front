import { Component, input } from '@angular/core';
import { FormArray } from '@angular/forms';
import { EditeurOptions } from '../editeur-options/editeur-options';
import { ControleOption } from '../formulaires-types';

/** CHOIX_MULTIPLE : une ou plusieurs réponses parmi les options (au moins 2). */
@Component({
  selector: 'app-question-choix-multiple',
  imports: [EditeurOptions],
  template: `<app-editeur-options [options]="options()" marqueur="case" />`,
})
export class QuestionChoixMultiple {
  readonly options = input.required<FormArray<ControleOption>>();
}
