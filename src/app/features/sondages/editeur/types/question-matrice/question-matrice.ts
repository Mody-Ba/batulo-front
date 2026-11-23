import { Component, input } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { REGLES_SONDAGE } from '../../../../../core/utils/regles-question';
import { EditeurListeTextes } from '../editeur-liste-textes/editeur-liste-textes';
import { ControlesMatrice } from '../formulaires-types';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * MATRICE : une grille où chaque ligne reçoit une réponse parmi les colonnes. 1 à 30 lignes, 2 à 10 colonnes,
 * textes non vides et sans doublon (sans tenir compte des majuscules).
 */
@Component({
  selector: 'app-question-matrice',
  imports: [TranslocoPipe, EditeurListeTextes],
  template: `
    <div class="grille-matrice">
      <app-editeur-liste-textes
        [liste]="configuration().controls.lignes"
        titre="editeur.matrice.lignes"
        libelleElement="editeur.matrice.ligne"
        element="editeur.matrice.uneLigne"
        elements="editeur.matrice.lignesMin"
        [max]="regles.matriceLignesMax"
      />
      <app-editeur-liste-textes
        [liste]="configuration().controls.colonnes"
        titre="editeur.matrice.colonnes"
        libelleElement="editeur.matrice.colonne"
        element="editeur.matrice.uneColonne"
        elements="editeur.matrice.colonnesMin"
        [max]="regles.matriceColonnesMax"
      />
    </div>
    <p class="texte-aide">
      {{ 'editeur.matrice.aide' | transloco: { lignesMax: regles.matriceLignesMax, colonnesMin: regles.matriceColonnesMin, colonnesMax: regles.matriceColonnesMax } }}
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
