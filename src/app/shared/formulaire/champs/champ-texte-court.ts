import { Component, computed } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ConfigurationTexte } from '../../../core/models/sondage.model';
import { ChampBase } from './champ-base';

/** TEXTE_COURT : champ texte natif sur une ligne, jusqu'à longueurMax caractères. */
@Component({
  selector: 'app-champ-texte-court',
  imports: [ReactiveFormsModule],
  template: `
    <input class="champ-saisie" type="text" [id]="idChamp" [formControl]="$any(controle())" autocomplete="off" [attr.maxlength]="longueurMax()" [attr.aria-describedby]="idsDescription()" [attr.aria-invalid]="invalide() || null" />
    <div class="indication">
      <span></span>
      <span [id]="idBase() + '-compteur'">{{ longueur() }} / {{ longueurMax() }} caractères</span>
    </div>
  `,
})
export class ChampTexteCourt extends ChampBase {
  protected readonly longueurMax = computed(
    () => (this.question().configuration as Partial<ConfigurationTexte>).longueurMax ?? 255,
  );

  protected idsDescription(): string {
    return [this.decrit(), `${this.idBase()}-compteur`].filter(Boolean).join(' ');
  }

  protected longueur(): number {
    const valeur = this.controle().value;
    return typeof valeur === 'string' ? valeur.length : 0;
  }
}
