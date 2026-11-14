import { Component } from '@angular/core';
import { OptionResponse } from '../../../core/models/sondage.model';
import { ChampBase } from './champ-base';

/** CHOIX_MULTIPLE : cases à cocher natives ; la réponse est la liste des valeurs, dans l'ordre des options. */
@Component({
  selector: 'app-champ-choix-multiple',
  template: `
    <div class="liste-choix" role="group" [attr.aria-labelledby]="idLibelle" [attr.aria-describedby]="decrit()">
      @for (option of question().options; track option.id) {
        <label class="choix">
          <input
            type="checkbox"
            [checked]="coche(option)"
            [disabled]="controle().disabled"
            [attr.aria-invalid]="invalide() || null"
            (change)="basculer(option, $any($event.target).checked)"
            (blur)="controle().markAsTouched()"
          />
          <span>{{ option.libelle }}</span>
        </label>
      }
    </div>
  `,
})
export class ChampChoixMultiple extends ChampBase {
  protected coche(option: OptionResponse): boolean {
    const valeur = this.controle().value;
    return Array.isArray(valeur) && valeur.includes(option.valeur);
  }

  protected basculer(option: OptionResponse, coche: boolean): void {
    const choisies = new Set(Array.isArray(this.controle().value) ? (this.controle().value as string[]) : []);
    if (coche) {
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
