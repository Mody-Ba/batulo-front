import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, input } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { OptionResponse, QuestionResponse } from '../../../core/models/sondage.model';
import { ValeurReponse } from '../reponses';

/**
 * CLASSEMENT : ranger toutes les options par ordre de préférence (glisser-déposer, ou boutons Monter/Descendre au
 * clavier et au doigt). La réponse est la liste ordonnée de toutes les valeurs ; tant que la personne n'a rien
 * rangé ni validé l'ordre proposé, pas de réponse.
 */
@Component({
  selector: 'app-champ-classement',
  imports: [CdkDrag, CdkDragHandle, CdkDropList, MatButtonModule, MatIconModule],
  template: `
    <ol
      class="classement"
      cdkDropList
      cdkDropListLockAxis="y"
      [cdkDropListDisabled]="controle().disabled"
      (cdkDropListDropped)="deposer($event)"
      [attr.aria-labelledby]="idLibelle()"
    >
      @for (option of ordre(); track option.id; let i = $index; let dernier = $last) {
        <li class="rang-option" cdkDrag>
          <mat-icon class="poignee" cdkDragHandle fontIcon="drag_indicator" aria-hidden="true" />
          <span class="rang">{{ i + 1 }}</span>
          <span class="libelle-option">{{ option.libelle }}</span>
          <button
            matIconButton
            type="button"
            [disabled]="i === 0 || controle().disabled"
            (click)="deplacer(i, i - 1)"
            [attr.aria-label]="'Monter « ' + option.libelle + ' »'"
          >
            <mat-icon fontIcon="arrow_upward" aria-hidden="true" />
          </button>
          <button
            matIconButton
            type="button"
            [disabled]="dernier || controle().disabled"
            (click)="deplacer(i, i + 1)"
            [attr.aria-label]="'Descendre « ' + option.libelle + ' »'"
          >
            <mat-icon fontIcon="arrow_downward" aria-hidden="true" />
          </button>
        </li>
      }
    </ol>
    @if (controle().value === null) {
      <button matButton type="button" (click)="validerOrdre()" [disabled]="controle().disabled">
        <mat-icon fontIcon="check" aria-hidden="true" />Garder cet ordre
      </button>
    } @else {
      <p class="texte-aide" role="status">Classement enregistré dans vos réponses.</p>
    }
  `,
  styleUrl: './champs.scss',
})
export class ChampClassement {
  readonly question = input.required<QuestionResponse>();
  readonly controle = input.required<FormControl<ValeurReponse>>();
  readonly idLibelle = input.required<string>();

  /** Ordre affiché : la réponse si elle existe, sinon l'ordre des options. */
  protected ordre(): OptionResponse[] {
    return this.ordreActuel();
  }

  private ordreActuel(): OptionResponse[] {
    const options = this.question().options;
    const valeur = this.controle().value;
    if (!Array.isArray(valeur)) {
      return options;
    }
    return valeur
      .map((v) => options.find((o) => o.valeur === v))
      .filter((o): o is OptionResponse => !!o);
  }

  protected deposer(evenement: CdkDragDrop<unknown>): void {
    this.deplacer(evenement.previousIndex, evenement.currentIndex);
  }

  protected deplacer(de: number, vers: number): void {
    const valeurs = this.ordreActuel().map((o) => o.valeur);
    moveItemInArray(valeurs, de, vers);
    this.controle().setValue(valeurs);
    this.controle().markAsTouched();
  }

  protected validerOrdre(): void {
    this.controle().setValue(this.ordreActuel().map((o) => o.valeur));
    this.controle().markAsTouched();
  }
}
