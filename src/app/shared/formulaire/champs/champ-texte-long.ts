import { Component, computed } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ConfigurationTexte } from '../../../core/models/sondage.model';
import { ChampBase } from './champ-base';

/** TEXTE_LONG : zone de texte native sur plusieurs lignes, jusqu'à longueurMax caractères. */
@Component({
  selector: 'app-champ-texte-long',
  imports: [ReactiveFormsModule],
  template: `
    <textarea class="champ-saisie" [id]="idChamp" [formControl]="$any(controle())" rows="4" [attr.maxlength]="longueurMax()" [attr.aria-describedby]="idsDescription()" [attr.aria-invalid]="invalide() || null"></textarea>
    <div class="indication">
      <span></span>
      <span [id]="idBase() + '-compteur'">{{ longueur() }} / {{ longueurMax() }} caractères</span>
    </div>
  `,
})
export class ChampTexteLong extends ChampBase {
  protected readonly longueurMax = computed(
    () => (this.question().configuration as Partial<ConfigurationTexte>).longueurMax ?? 5000,
  );

  protected idsDescription(): string {
    return [this.decrit(), `${this.idBase()}-compteur`].filter(Boolean).join(' ');
  }

  protected longueur(): number {
    const valeur = this.controle().value;
    return typeof valeur === 'string' ? valeur.length : 0;
  }
}
