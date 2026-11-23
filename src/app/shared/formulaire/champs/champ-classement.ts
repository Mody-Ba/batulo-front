import { Component, signal } from '@angular/core';
import { OptionResponse } from '../../../core/models/sondage.model';
import { ChampBase } from './champ-base';
import { traduire } from '../../../core/i18n/traduire';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * CLASSEMENT : ranger toutes les options par ordre de préférence avec Monter / Descendre (au doigt et au clavier ;
 * le déplacement est annoncé). La réponse est la liste ordonnée de toutes les valeurs ; tant que la personne n'a rien
 * rangé ni gardé l'ordre proposé, pas de réponse.
 */
@Component({
  selector: 'app-champ-classement',
  imports: [TranslocoPipe],
  template: `
    <ol class="classement" [attr.aria-labelledby]="idLibelle" [attr.aria-describedby]="decrit()">
      @for (option of ordre(); track option.id; let i = $index; let dernier = $last) {
        <li class="rang-option">
          <span class="rang" aria-hidden="true">{{ i + 1 }}</span>
          <span class="libelle-option" dir="auto">{{ option.libelle }}</span>
          <button
            type="button"
            class="bouton-icone"
            [disabled]="i === 0 || controle().disabled"
            (click)="deplacer(i, i - 1)"
            [attr.aria-label]="'public.champs.monter' | transloco: { libelle: option.libelle, position: i + 1 }"
          >
            <span aria-hidden="true">↑</span>
          </button>
          <button
            type="button"
            class="bouton-icone"
            [disabled]="dernier || controle().disabled"
            (click)="deplacer(i, i + 1)"
            [attr.aria-label]="'public.champs.descendre' | transloco: { libelle: option.libelle, position: i + 1 }"
          >
            <span aria-hidden="true">↓</span>
          </button>
        </li>
      }
    </ol>
    @if (controle().value === null) {
      <button type="button" class="bouton-texte" (click)="garderOrdre()" [disabled]="controle().disabled">
        {{ 'public.champs.garderOrdre' | transloco }}
      </button>
    }
    <p class="statut-classement" role="status">{{ annonce() }}</p>
  `,
})
export class ChampClassement extends ChampBase {
  /** Annonce du dernier déplacement (lecteurs d'écran), ou confirmation que le classement compte. */
  protected readonly annonce = signal('');

  /** Ordre affiché : la réponse si elle existe, sinon l'ordre des options. */
  protected ordre(): OptionResponse[] {
    const options = this.question().options;
    const valeur = this.controle().value;
    if (!Array.isArray(valeur)) {
      return options;
    }
    return valeur.map((v) => options.find((o) => o.valeur === v)).filter((o): o is OptionResponse => !!o);
  }

  protected deplacer(de: number, vers: number): void {
    const ordre = this.ordre();
    const [option] = ordre.splice(de, 1);
    ordre.splice(vers, 0, option);
    this.controle().setValue(ordre.map((o) => o.valeur));
    this.controle().markAsTouched();
    this.annonce.set(traduire('public.champs.deplace', { libelle: option.libelle, position: vers + 1, total: ordre.length }));
  }

  protected garderOrdre(): void {
    this.controle().setValue(this.ordre().map((o) => o.valeur));
    this.controle().markAsTouched();
    this.annonce.set(traduire('public.champs.classementGarde'));
  }
}
