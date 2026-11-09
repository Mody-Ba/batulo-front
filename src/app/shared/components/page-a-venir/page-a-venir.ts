import { Component, input } from '@angular/core';
import { Encadre } from '../encadre/encadre';
import { EntetePage } from '../entete-page/entete-page';

/**
 * Rubrique du menu prévue dans une étape suivante. Titre, icône et étape viennent des `data`
 * de la route (liaison des entrées par le routeur).
 */
@Component({
  selector: 'app-page-a-venir',
  imports: [EntetePage, Encadre],
  template: `
    <section class="conteneur-page">
      <app-entete-page [titre]="titre()" [icone]="icone()" />
      <app-encadre type="info" icone="construction">
        <p>Cette rubrique sera disponible prochainement{{ etape() ? ' (étape ' + etape() + ')' : '' }}.</p>
      </app-encadre>
    </section>
  `,
})
export class PageAVenir {
  readonly titre = input('Bientôt disponible');
  readonly icone = input<string | null>(null);
  readonly etape = input<string | null>(null);
}
