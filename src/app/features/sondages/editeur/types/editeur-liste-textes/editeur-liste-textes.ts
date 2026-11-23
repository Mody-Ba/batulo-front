import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { afterNextRender, Component, ElementRef, Injector, inject, input, viewChildren } from '@angular/core';
import { FormArray, FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { messageErreurListe, REGLES_SONDAGE } from '../../../../../core/utils/regles-question';
import { creerControleTexte } from '../formulaires-types';
import { traduire } from '../../../../../core/i18n/traduire';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * Liste de textes (lignes ou colonnes d'une matrice) : ajout (bouton ou Entrée), suppression, réordonnancement.
 * Le nombre d'éléments et l'absence de doublon sont vérifiés par le validateur de la liste.
 */
@Component({
  selector: 'app-editeur-liste-textes',
  imports: [TranslocoPipe, CdkDrag,
    CdkDragHandle,
    CdkDropList,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  template: `
    <h4 [id]="idTitre">{{ titre() | transloco }}</h4>
    <div
      class="liste"
      cdkDropList
      [cdkDropListDisabled]="liste().disabled"
      (cdkDropListDropped)="deposer($event)"
      role="list"
      [attr.aria-labelledby]="idTitre"
    >
      @for (controle of liste().controls; track controle; let i = $index) {
        <div class="element" cdkDrag cdkDragLockAxis="y" role="listitem">
          <button
            matIconButton
            type="button"
            cdkDragHandle
            class="poignee"
            [disabled]="liste().disabled"
            [attr.aria-label]="'editeur.liste.deplacer' | transloco: { element: (element() | transloco), n: i + 1 }"
            (keydown.alt.arrowup)="$event.preventDefault(); deplacer(i, i - 1)"
            (keydown.alt.arrowdown)="$event.preventDefault(); deplacer(i, i + 1)"
          >
            <mat-icon fontIcon="drag_indicator" aria-hidden="true" />
          </button>
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="champ">
            <mat-label>{{ libelleElement() | transloco }} {{ i + 1 }}</mat-label>
            <input
              #champ
              matInput
              dir="auto"
              [formControl]="controle"
              [maxlength]="regles.libelleConfigMax"
              autocomplete="off"
              (keydown.enter)="$event.preventDefault(); ajouter(i)"
            />
            @if (controle.hasError('required')) {
              <mat-error>{{ 'editeur.liste.texteObligatoire' | transloco }}</mat-error>
            }
          </mat-form-field>
          <button
            matIconButton
            type="button"
            (click)="supprimer(i)"
            [disabled]="liste().disabled"
            [attr.aria-label]="'editeur.liste.supprimer' | transloco: { element: (element() | transloco), n: i + 1 }"
          >
            <mat-icon fontIcon="close" aria-hidden="true" />
          </button>
        </div>
      }
    </div>
    @if (erreur(); as message) {
      <p class="erreur-liste" role="alert">{{ message }}</p>
    }
    <button matButton type="button" (click)="ajouter()" [disabled]="liste().disabled || liste().length >= max()">
      <mat-icon fontIcon="add" aria-hidden="true" />{{ 'editeur.liste.ajouter' | transloco: { element: (element() | transloco) } }}
    </button>
  `,
  styles: `
    :host {
      display: block;
    }

    h4 {
      margin: 0 0 var(--bt-espace-2);
      font: var(--mat-sys-title-small);
    }

    .liste {
      display: flex;
      flex-direction: column;
      gap: var(--bt-espace-2);
    }

    .element {
      display: flex;
      align-items: center;
      gap: var(--bt-espace-2);
      background: var(--mat-sys-surface);
    }

    .champ {
      flex: 1;
      min-width: 0;
    }

    .poignee {
      cursor: grab;
    }

    .cdk-drag-animating,
    .cdk-drop-list-dragging .cdk-drag:not(.cdk-drag-placeholder) {
      transition: transform 200ms cubic-bezier(0, 0, 0.2, 1);
    }

    .erreur-liste {
      margin: var(--bt-espace-2) 0 0;
      color: var(--mat-sys-error);
      font: var(--mat-sys-body-small);
    }
  `,
})
export class EditeurListeTextes {
  private static compteur = 0;
  private readonly injector = inject(Injector);
  protected readonly regles = REGLES_SONDAGE;
  protected readonly idTitre = `liste-textes-${++EditeurListeTextes.compteur}`;

  readonly liste = input.required<FormArray<FormControl<string>>>();
  /** Ex. « Lignes ». */
  readonly titre = input.required<string>();
  /** Ex. « Ligne » (libellé des champs). */
  readonly libelleElement = input.required<string>();
  /** Ex. « une ligne » (boutons). */
  readonly element = input.required<string>();
  /** Ex. « lignes » (message d'erreur). */
  readonly elements = input.required<string>();
  readonly max = input.required<number>();

  private readonly champs = viewChildren<ElementRef<HTMLInputElement>>('champ');

  protected erreur(): string | null {
    return messageErreurListe(this.liste(), traduire(this.elements()));
  }

  protected ajouter(apres?: number): void {
    const liste = this.liste();
    if (liste.length >= this.max()) {
      return;
    }
    const position = apres === undefined ? liste.length : apres + 1;
    liste.insert(position, creerControleTexte(`${this.libelleElement()} ${liste.length + 1}`));
    afterNextRender(
      () => {
        const champ = this.champs()[position]?.nativeElement;
        champ?.focus();
        champ?.select();
      },
      { injector: this.injector },
    );
  }

  protected supprimer(index: number): void {
    this.liste().removeAt(index);
  }

  protected deposer(evenement: CdkDragDrop<unknown>): void {
    this.deplacer(evenement.previousIndex, evenement.currentIndex);
  }

  protected deplacer(de: number, vers: number): void {
    const liste = this.liste();
    if (de === vers || vers < 0 || vers >= liste.length) {
      return;
    }
    const controle = liste.at(de);
    liste.removeAt(de, { emitEvent: false });
    liste.insert(vers, controle);
  }
}
