import { Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ChampBase } from './champ-base';

/** CHOIX_UNIQUE : boutons radio natifs ; la réponse est la valeur de l'option. */
@Component({
  selector: 'app-champ-choix-unique',
  imports: [ReactiveFormsModule],
  template: `
    <div class="liste-choix" role="radiogroup" [attr.aria-labelledby]="idLibelle" [attr.aria-describedby]="decrit()" [attr.aria-invalid]="invalide() || null">
      @for (option of question().options; track option.id) {
        <label class="choix">
          <input type="radio" [name]="idBase()" [attr.name]="idBase()" [value]="option.valeur" [formControl]="$any(controle())" />
          <span>{{ option.libelle }}</span>
        </label>
      }
    </div>
  `,
})
export class ChampChoixUnique extends ChampBase {}
