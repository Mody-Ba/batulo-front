import { Component, computed, input } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatRadioChange, MatRadioModule } from '@angular/material/radio';
import { ConfigurationMatrice, QuestionResponse } from '../../../core/models/sondage.model';
import { ValeurReponse } from '../reponses';

/**
 * MATRICE : une colonne pour chaque ligne (une grille commencée doit être complète). Tableau sur un conteneur large,
 * une carte par ligne sur un conteneur étroit (container query) ; chaque ligne est un groupe de boutons radio.
 */
@Component({
  selector: 'app-champ-matrice',
  imports: [MatRadioModule],
  template: `
    <div class="matrice" role="group" [attr.aria-labelledby]="idLibelle()" [style.--bt-colonnes]="colonnes().length">
      <div class="matrice-entete" aria-hidden="true">
        <span></span>
        @for (colonne of colonnes(); track colonne) {
          <span class="matrice-colonne">{{ colonne }}</span>
        }
      </div>
      @for (ligne of lignes(); track ligne; let i = $index) {
        <div class="matrice-ligne">
          <span class="matrice-libelle" [id]="idLibelle() + '-ligne-' + i">{{ ligne }}</span>
          <mat-radio-group
            class="matrice-choix"
            [value]="reponse()[ligne] ?? null"
            [disabled]="controle().disabled"
            (change)="choisir(ligne, $event)"
            [attr.aria-labelledby]="idLibelle() + '-ligne-' + i"
          >
            @for (colonne of colonnes(); track colonne) {
              <mat-radio-button [value]="colonne">
                <span class="matrice-colonne-etroit">{{ colonne }}</span>
                <span class="visuellement-cache matrice-colonne-large">{{ colonne }}</span>
              </mat-radio-button>
            }
          </mat-radio-group>
        </div>
      }
    </div>
  `,
  styleUrl: './champs.scss',
})
export class ChampMatrice {
  readonly question = input.required<QuestionResponse>();
  readonly controle = input.required<FormControl<ValeurReponse>>();
  readonly idLibelle = input.required<string>();

  protected readonly lignes = computed(() => (this.question().configuration as Partial<ConfigurationMatrice>).lignes ?? []);
  protected readonly colonnes = computed(
    () => (this.question().configuration as Partial<ConfigurationMatrice>).colonnes ?? [],
  );

  protected reponse(): Record<string, string> {
    const valeur = this.controle().value;
    return valeur && typeof valeur === 'object' && !Array.isArray(valeur) ? valeur : {};
  }

  protected choisir(ligne: string, evenement: MatRadioChange): void {
    this.controle().setValue({ ...this.reponse(), [ligne]: evenement.value });
    this.controle().markAsTouched();
  }
}
