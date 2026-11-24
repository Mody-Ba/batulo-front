import { Component, computed } from '@angular/core';
import { ConfigurationMatrice } from '../../../core/models/sondage.model';
import { ChampBase } from './champ-base';

/**
 * MATRICE : une colonne pour chaque ligne (une grille commencée doit être complète). Une carte par ligne sur un
 * formulaire étroit, un tableau sur un formulaire large (container query) ; chaque ligne est un groupe de boutons
 * radio natifs. Libellés de `libellesMatrice` (langue servie), valeurs de `configuration` (langue principale).
 */
@Component({
  selector: 'app-champ-matrice',
  template: `
    <div class="matrice" role="group" [attr.aria-labelledby]="idLibelle" [attr.aria-describedby]="decrit()" [style.--bt-colonnes]="colonnes().length">
      <div class="matrice-entete" aria-hidden="true">
        <span></span>
        @for (colonne of colonnes(); track colonne; let j = $index) {
          <span dir="auto">{{ libelleColonne(j) }}</span>
        }
      </div>
      @for (ligne of lignes(); track ligne; let i = $index) {
        <div class="matrice-ligne" role="radiogroup" [attr.aria-labelledby]="idBase() + '-ligne-' + i">
          <span class="matrice-libelle" dir="auto" [id]="idBase() + '-ligne-' + i">{{ libelleLigne(i) }}</span>
          <div class="matrice-choix">
            @for (colonne of colonnes(); track colonne; let j = $index) {
              <label class="choix">
                <input
                  type="radio"
                  [attr.name]="idBase() + '-ligne-' + i"
                  [checked]="reponse()[ligne] === colonne"
                  [disabled]="controle().disabled"
                  (change)="choisir(ligne, colonne)"
                />
                <span class="matrice-colonne-etroit" dir="auto">{{ libelleColonne(j) }}</span>
                <span class="visuellement-cache matrice-colonne-large">{{ libelleColonne(j) }}</span>
              </label>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class ChampMatrice extends ChampBase {
  protected readonly lignes = computed(
    () => (this.question().configuration as Partial<ConfigurationMatrice>).lignes ?? [],
  );
  protected readonly colonnes = computed(
    () => (this.question().configuration as Partial<ConfigurationMatrice>).colonnes ?? [],
  );

  /** Libellés affichés (libellesMatrice, dans la langue servie) ; les valeurs envoyées restent lignes / colonnes. */
  protected libelleLigne(i: number): string {
    return this.question().libellesMatrice?.lignes?.[i] || this.lignes()[i];
  }

  protected libelleColonne(j: number): string {
    return this.question().libellesMatrice?.colonnes?.[j] || this.colonnes()[j];
  }

  protected reponse(): Record<string, string> {
    const valeur = this.controle().value;
    return valeur && typeof valeur === 'object' && !Array.isArray(valeur) ? valeur : {};
  }

  protected choisir(ligne: string, colonne: string): void {
    this.controle().setValue({ ...this.reponse(), [ligne]: colonne });
    this.controle().markAsTouched();
  }
}
