import { Component, input } from '@angular/core';
import { Encadre } from '../encadre/encadre';
import { EntetePage } from '../entete-page/entete-page';
import { traduire } from '../../../core/i18n/traduire';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * Rubrique du menu prévue dans une étape suivante. Titre, icône et étape viennent des `data`
 * de la route (liaison des entrées par le routeur).
 */
@Component({
  selector: 'app-page-a-venir',
  imports: [TranslocoPipe, EntetePage, Encadre],
  template: `
    <section class="conteneur-page">
      <app-entete-page [titre]="titre()" [icone]="icone()" />
      <app-encadre type="info" icone="construction">
        <p>{{ 'commun.aVenir.texte' | transloco }}</p>
      </app-encadre>
    </section>
  `,
})
export class PageAVenir {
  readonly titre = input(traduire('commun.aVenir.titre'));
  readonly icone = input<string | null>(null);
  readonly etape = input<string | null>(null);
}
