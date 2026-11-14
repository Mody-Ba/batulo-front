import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { startWith, switchMap } from 'rxjs';
import { QuestionResponse, TypeQuestion } from '../../core/models/sondage.model';
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

/** Types à un seul champ de saisie : libellé <label for>. Les autres sont des groupes : <fieldset> et <legend>. */
const TYPES_SAISIE: ReadonlySet<TypeQuestion> = new Set<TypeQuestion>(['TEXTE_COURT', 'TEXTE_LONG', 'NUMERIQUE', 'DATE']);

/**
 * Une question côté répondant : numéro, libellé (« obligatoire » lu par les lecteurs d'écran), aide, champ propre au
 * type et message d'erreur, relié au champ (aria-describedby) et affiché une fois la question touchée, après
 * « Suivant » / « Envoyer », ou quand le serveur la refuse.
 */
@Component({
  selector: 'app-question-repondant',
  imports: [
    NgTemplateOutlet,
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
    <ng-template #libelle>
      <span class="numero">{{ numero() }}.</span> {{ question().libelle }}
      @if (question().obligatoire) {
        <span class="obligatoire" aria-hidden="true">*</span>
        <span class="visuellement-cache">(obligatoire)</span>
      }
    </ng-template>

    <ng-template #contenu>
      @if (question().aide) {
        <p class="aide" [id]="idBase() + '-aide'">{{ question().aide }}</p>
      }
      @switch (question().type) {
        @case ('CHOIX_UNIQUE') {
          <app-champ-choix-unique [question]="question()" [controle]="controle()" [idBase]="idBase()" [decrit]="decrit()" [invalide]="!!erreur()" />
        }
        @case ('CHOIX_MULTIPLE') {
          <app-champ-choix-multiple [question]="question()" [controle]="controle()" [idBase]="idBase()" [decrit]="decrit()" [invalide]="!!erreur()" />
        }
        @case ('OUI_NON') {
          <app-champ-oui-non [question]="question()" [controle]="controle()" [idBase]="idBase()" [decrit]="decrit()" [invalide]="!!erreur()" />
        }
        @case ('TEXTE_COURT') {
          <app-champ-texte-court [question]="question()" [controle]="controle()" [idBase]="idBase()" [decrit]="decrit()" [invalide]="!!erreur()" />
        }
        @case ('TEXTE_LONG') {
          <app-champ-texte-long [question]="question()" [controle]="controle()" [idBase]="idBase()" [decrit]="decrit()" [invalide]="!!erreur()" />
        }
        @case ('ECHELLE') {
          <app-champ-echelle [question]="question()" [controle]="controle()" [idBase]="idBase()" [decrit]="decrit()" [invalide]="!!erreur()" />
        }
        @case ('CLASSEMENT') {
          <app-champ-classement [question]="question()" [controle]="controle()" [idBase]="idBase()" [decrit]="decrit()" [invalide]="!!erreur()" />
        }
        @case ('NUMERIQUE') {
          <app-champ-numerique [question]="question()" [controle]="controle()" [idBase]="idBase()" [decrit]="decrit()" [invalide]="!!erreur()" />
        }
        @case ('DATE') {
          <app-champ-date [question]="question()" [controle]="controle()" [idBase]="idBase()" [decrit]="decrit()" [invalide]="!!erreur()" />
        }
        @case ('MATRICE') {
          <app-champ-matrice [question]="question()" [controle]="controle()" [idBase]="idBase()" [decrit]="decrit()" [invalide]="!!erreur()" />
        }
      }
      @if (erreur(); as message) {
        <p class="erreur" [id]="idBase() + '-erreur'" role="alert">{{ message }}</p>
      }
    </ng-template>

    <div class="question" [class.en-erreur]="erreur()" [attr.data-question]="question().id">
      @if (saisie()) {
        <label class="libelle" [for]="idBase() + '-champ'" [id]="idBase() + '-libelle'">
          <ng-container *ngTemplateOutlet="libelle" />
        </label>
        <ng-container *ngTemplateOutlet="contenu" />
      } @else {
        <fieldset class="groupe">
          <legend class="libelle" [id]="idBase() + '-libelle'">
            <ng-container *ngTemplateOutlet="libelle" />
          </legend>
          <ng-container *ngTemplateOutlet="contenu" />
        </fieldset>
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
        box-shadow: inset 4px 0 0 var(--mat-sys-error);
      }
    }

    .groupe {
      min-width: 0;
      margin: 0;
      padding: 0;
      border: 0;
    }

    .libelle {
      display: block;
      margin: 0 0 var(--bt-espace-2);
      padding: 0;
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
      font: var(--mat-sys-body-medium);
    }
  `,
})
export class QuestionRepondant {
  readonly question = input.required<QuestionResponse>();
  readonly controle = input.required<FormControl<ValeurReponse>>();
  readonly numero = input.required<number>();

  protected readonly idBase = computed(() => `question-${this.question().id}`);
  protected readonly saisie = computed(() => TYPES_SAISIE.has(this.question().type));

  /**
   * Événements du contrôle (valeur, validité, « touché ») : l'erreur se met à jour même quand c'est le formulaire
   * qui marque la question comme touchée (« Suivant », « Envoyer ») ou qui pose l'erreur du serveur.
   */
  private readonly evenements = toSignal(
    toObservable(this.controle).pipe(switchMap((controle) => controle.events.pipe(startWith(null)))),
  );

  protected readonly erreur = computed(() => {
    this.evenements();
    const controle = this.controle();
    return controle.touched && controle.invalid ? messageReponse(controle) : null;
  });

  /** Aide et erreur, reliées au champ pour les lecteurs d'écran. */
  protected readonly decrit = computed(() => {
    const ids = [this.question().aide ? `${this.idBase()}-aide` : null, this.erreur() ? `${this.idBase()}-erreur` : null];
    return ids.filter(Boolean).join(' ') || null;
  });
}
