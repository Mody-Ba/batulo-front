import { Component, input } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { REGLES_SONDAGE } from '../../../../../core/utils/regles-question';
import { EditeurListeTextes } from '../editeur-liste-textes/editeur-liste-textes';
import { ControlesMatrice } from '../formulaires-types';

/**
 * MATRICE : une grille où chaque ligne reçoit une réponse parmi les colonnes. 1 à 30 lignes, 2 à 10 colonnes,
 * textes non vides et sans doublon (sans tenir compte des majuscules).
 */
@Component({
  selector: 'app-question-matrice',
  imports: [EditeurListeTextes],
  template: `
    <div class="grille-matrice">
      <app-editeur-liste-textes
        [liste]="configuration().controls.lignes"
        titre="Lignes"
        libelleElement="Ligne"
        element="une ligne"
        elements="lignes"
        [max]="regles.matriceLignesMax"
      />
      <app-editeur-liste-textes
        [liste]="configuration().controls.colonnes"
        titre="Colonnes"
        libelleElement="Colonne"
        element="une colonne"
        elements="colonnes"
        [max]="regles.matriceColonnesMax"
      />
    </div>
    <p class="texte-aide">
      De 1 à {{ regles.matriceLignesMax }} lignes et de {{ regles.matriceColonnesMin }} à
      {{ regles.matriceColonnesMax }} colonnes. Chaque ligne reçoit une réponse parmi les colonnes.
    </p>
  `,
  styles: `
    .grille-matrice {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--bt-espace-4);

      @media (min-width: 600px) {
        grid-template-columns: 1fr 1fr;
      }
    }
  `,
})
export class QuestionMatrice {
  protected readonly regles = REGLES_SONDAGE;
  readonly configuration = input.required<FormGroup<ControlesMatrice>>();
}
