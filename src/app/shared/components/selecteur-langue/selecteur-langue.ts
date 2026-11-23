import { Component, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LangueService } from '../../../core/i18n/langue.service';
import { estLangue, LANGUES } from '../../../core/i18n/langues';

/**
 * Choix de la langue de l'interface (Français, English, العربية) : liste native, légère (barre du haut, vitrine,
 * connexion, formulaire public sans Angular Material). Le choix est mémorisé par LangueService.
 * `apparence` : « clair » sur fond clair, « bandeau » sur la barre colorée. Classe `compact-telephone` : bouton rond
 * sous 600 px.
 */
@Component({
  selector: 'app-selecteur-langue',
  imports: [TranslocoPipe],
  template: `
    <label class="selecteur" [class.bandeau]="apparence() === 'bandeau'">
      <span class="material-icons icone" aria-hidden="true">language</span>
      <span class="visuellement-cache">{{ 'public.langue.libelle' | transloco }}</span>
      <select [value]="langues.langue()" (change)="choisir($event)">
        @for (langue of liste; track langue.code) {
          <option [value]="langue.code" [attr.lang]="langue.code" [selected]="langue.code === langues.langue()">
            {{ langue.nom }}
          </option>
        }
      </select>
      <span class="material-icons fleche" aria-hidden="true">expand_more</span>
    </label>
  `,
  styles: `
    :host {
      display: inline-block;
    }
    .selecteur {
      position: relative;
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      color: var(--mat-sys-on-surface);
    }
    .selecteur.bandeau {
      color: var(--bt-bandeau-texte, inherit);
    }
    .icone,
    .fleche {
      position: absolute;
      pointer-events: none;
      font-size: 20px;
    }
    .icone {
      inset-inline-start: 10px;
    }
    .fleche {
      inset-inline-end: 8px;
    }
    select {
      appearance: none;
      min-height: 44px;
      padding-block: 0;
      padding-inline: 36px 32px;
      border: 1px solid currentColor;
      border-radius: 22px;
      background: transparent;
      color: inherit;
      font: var(--mat-sys-label-large, 500 14px/20px Roboto, sans-serif);
      cursor: pointer;
    }
    select:focus-visible {
      outline: 3px solid var(--mat-sys-primary);
      outline-offset: 2px;
    }
    .bandeau select:focus-visible {
      outline-color: currentColor;
    }
    /* Sur téléphone (classe « compact-telephone ») : un bouton rond de 44 px, la liste native garde les noms. */
    @media (max-width: 599.98px) {
      :host(.compact-telephone) select {
        width: 44px;
        padding: 0;
        color: transparent;
      }
      :host(.compact-telephone) .icone {
        inset-inline-start: 12px;
      }
      :host(.compact-telephone) .fleche {
        display: none;
      }
    }
    option {
      color: var(--mat-sys-on-surface);
      background: var(--mat-sys-surface);
    }
  `,
})
export class SelecteurLangue {
  protected readonly langues = inject(LangueService);
  protected readonly liste = LANGUES;
  readonly apparence = input<'clair' | 'bandeau'>('clair');

  protected choisir(evenement: Event): void {
    const valeur = (evenement.target as HTMLSelectElement).value;
    if (estLangue(valeur)) {
      void this.langues.changer(valeur);
    }
  }
}
