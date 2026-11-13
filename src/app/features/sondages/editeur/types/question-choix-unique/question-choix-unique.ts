import { Component, input } from '@angular/core';
import { FormArray } from '@angular/forms';
import { EditeurOptions } from '../editeur-options/editeur-options';
import { ControleOption } from '../formulaires-types';

/** CHOIX_UNIQUE : une seule réponse parmi les options (au moins 2). */
@Component({
  selector: 'app-question-choix-unique',
  imports: [EditeurOptions],
  template: `<app-editeur-options [options]="options()" marqueur="rond" />`,
})
export class QuestionChoixUnique {
  readonly options = input.required<FormArray<ControleOption>>();
}
