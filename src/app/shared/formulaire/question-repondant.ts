import { Component, computed, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { startWith, switchMap } from 'rxjs';
import { QuestionResponse } from '../../core/models/sondage.model';
import { ChampChoixMultiple } from './champs/champ-choix-multiple';
import { ChampChoixUnique } from './champs/champ-choix-unique';
import { ChampClassement } from './champs/champ-classement';
import { ChampDate } from './champs/champ-date';
import { ChampEchelle } from './champs/champ-echelle';
import { ChampMatrice } from './champs/champ-matrice';
import { ChampNumerique } from './champs/champ-numerique';
import { ChampOuiNon } from './champs/champ-oui-non';
import { ChampTexteCourt } from './champs/champ-texte-court';
import { ChampTexteLong } from './champs/champ-texte-long';
import { messageReponse, ValeurReponse } from './reponses';

/**
 * Une question côté répondant : numéro, libellé (astérisque si obligatoire), aide, champ propre au type et message
 * d'erreur (affiché une fois la question touchée, ou après « Suivant » / « Envoyer »).
 */
@Component({
  selector: 'app-question-repondant',
  imports: [
    ChampChoixUnique,
    ChampChoixMultiple,
    ChampOuiNon,
    ChampTexteCourt,
    ChampTexteLong,
    ChampEchelle,
    ChampClassement,
    ChampNumerique,
    ChampDate,
    ChampMatrice,
  ],
  template: `
    <div class="question" [class.en-erreur]="erreur()" [attr.data-question]="question().id">
      <h3 class="libelle" [id]="idLibelle()">
        <span class="numero">{{ numero() }}.</span> {{ question().libelle }}
        @if (question().obligatoire) {
          <span class="obligatoire" aria-hidden="true">*</span>
          <span class="visuellement-cache">(obligatoire)</span>
        }
      </h3>
      @if (question().aide) {
        <p class="aide">{{ question().aide }}</p>
      }
      @switch (question().type) {
        @case ('CHOIX_UNIQUE') {
          <app-champ-choix-unique [question]="question()" [controle]="controle()" [idLibelle]="idLibelle()" />
        }
        @case ('CHOIX_MULTIPLE') {
          <app-champ-choix-multiple [question]="question()" [controle]="controle()" [idLibelle]="idLibelle()" />
        }
        @case ('OUI_NON') {
          <app-champ-oui-non [controle]="controle()" [idLibelle]="idLibelle()" />
        }
        @case ('TEXTE_COURT') {
          <app-champ-texte-court [question]="question()" [controle]="controle()" [idLibelle]="idLibelle()" />
        }
        @case ('TEXTE_LONG') {
          <app-champ-texte-long [question]="question()" [controle]="controle()" [idLibelle]="idLibelle()" />
        }
        @case ('ECHELLE') {
          <app-champ-echelle [question]="question()" [controle]="controle()" [idLibelle]="idLibelle()" />
        }
        @case ('CLASSEMENT') {
          <app-champ-classement [question]="question()" [controle]="controle()" [idLibelle]="idLibelle()" />
        }
        @case ('NUMERIQUE') {
          <app-champ-numerique [question]="question()" [controle]="controle()" [idLibelle]="idLibelle()" />
        }
        @case ('DATE') {
          <app-champ-date [question]="question()" [controle]="controle()" [idLibelle]="idLibelle()" />
        }
        @case ('MATRICE') {
          <app-champ-matrice [question]="question()" [controle]="controle()" [idLibelle]="idLibelle()" />
        }
      }
      @if (erreur(); as message) {
        <p class="erreur" role="alert">{{ message }}</p>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .question {
      padding: var(--bt-espace-4);
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--bt-rayon);
      background: var(--mat-sys-surface);

      &.en-erreur {
        border-color: var(--mat-sys-error);
      }
    }

    .libelle {
      margin: 0 0 var(--bt-espace-2);
      font: var(--mat-sys-title-medium);
      overflow-wrap: anywhere;
    }

    .numero {
      color: var(--mat-sys-on-surface-variant);
    }

    .obligatoire,
    .erreur {
      color: var(--mat-sys-error);
    }

    .aide {
      margin: 0 0 var(--bt-espace-3);
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-medium);
    }

    .erreur {
      margin: var(--bt-espace-2) 0 0;
      font: var(--mat-sys-body-small);
    }
  `,
})
export class QuestionRepondant {
  readonly question = input.required<QuestionResponse>();
  readonly controle = input.required<FormControl<ValeurReponse>>();
  readonly numero = input.required<number>();

  protected readonly idLibelle = computed(() => `libelle-question-${this.question().id}`);

  /**
   * Événements du contrôle (valeur, validité, « touché ») : l'erreur se met à jour même quand c'est le formulaire
   * qui marque la question comme touchée (« Suivant », « Envoyer »).
   */
  private readonly evenements = toSignal(
    toObservable(this.controle).pipe(switchMap((controle) => controle.events.pipe(startWith(null)))),
  );

  protected readonly erreur = computed(() => {
    this.evenements();
    const controle = this.controle();
    return controle.touched && controle.invalid ? messageReponse(controle) : null;
  });
}
