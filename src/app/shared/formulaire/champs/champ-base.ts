import { Directive, input } from '@angular/core';
import { FormControl } from '@angular/forms';
import { QuestionResponse } from '../../../core/models/sondage.model';
import { ValeurReponse } from '../reponses';

/**
 * Entrées communes des champs côté répondant : la question, son contrôle, et de quoi relier le champ à son libellé,
 * à l'aide et au message d'erreur (lecteurs d'écran).
 */
@Directive()
export abstract class ChampBase {
  readonly question = input.required<QuestionResponse>();
  readonly controle = input.required<FormControl<ValeurReponse>>();
  /** Préfixe des id de la question (ex. « question-12 »). */
  readonly idBase = input.required<string>();
  /** Id des éléments qui décrivent le champ (aide, erreur), pour aria-describedby ; null s'il n'y en a pas. */
  readonly decrit = input<string | null>(null);
  readonly invalide = input(false);

  protected get idChamp(): string {
    return `${this.idBase()}-champ`;
  }

  protected get idLibelle(): string {
    return `${this.idBase()}-libelle`;
  }
}
