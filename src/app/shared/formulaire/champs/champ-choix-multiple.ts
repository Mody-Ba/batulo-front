import { Component, input } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatCheckboxChange, MatCheckboxModule } from '@angular/material/checkbox';
import { OptionResponse, QuestionResponse } from '../../../core/models/sondage.model';
import { ValeurReponse } from '../reponses';

/** CHOIX_MULTIPLE : une ou plusieurs options ; la réponse est la liste des valeurs, dans l'ordre des options. */
@Component({
  selector: 'app-champ-choix-multiple',
  imports: [MatCheckboxModule],
  template: `
    <div class="liste-choix" role="group" [attr.aria-labelledby]="idLibelle()">
      @for (option of question().options; track option.id) {
        <mat-checkbox
          [checked]="coche(option)"
          [disabled]="controle().disabled"
          (change)="basculer(option, $event)"
          (blur)="controle().markAsTouched()"
        >
          {{ option.libelle }}
        </mat-checkbox>
      }
    </div>
  `,
  styleUrl: './champs.scss',
})
export class ChampChoixMultiple {
  readonly question = input.required<QuestionResponse>();
  readonly controle = input.required<FormControl<ValeurReponse>>();
  readonly idLibelle = input.required<string>();

  protected coche(option: OptionResponse): boolean {
    const valeur = this.controle().value;
    return Array.isArray(valeur) && valeur.includes(option.valeur);
  }

  protected basculer(option: OptionResponse, evenement: MatCheckboxChange): void {
    const choisies = new Set(Array.isArray(this.controle().value) ? (this.controle().value as string[]) : []);
    if (evenement.checked) {
      choisies.add(option.valeur);
    } else {
      choisies.delete(option.valeur);
    }
    const valeurs = this.question()
      .options.map((o) => o.valeur)
      .filter((v) => choisies.has(v));
    this.controle().setValue(valeurs.length ? valeurs : null);
    this.controle().markAsTouched();
  }
}
