import { Component, computed, input, signal } from '@angular/core';
import { nombre } from './format';

/** Une colonne : étiquette courte (axe), libellé complet (tableau, info-bulle), effectif. */
export interface ColonneGraphique {
  etiquette: string;
  libelle: string;
  nombre: number;
  /** Texte complet (« 12 · 9,4 % ») ; par défaut l'effectif. */
  texte?: string;
}

let compteur = 0;

/**
 * Colonnes d'effectifs (distribution d'un nombre ou d'une échelle, répartition des dates), une seule série. Colonnes
 * séparées de 2 px, sommet arrondi, axe vertical à deux graduations (0 et le maximum), effectif au survol et au
 * focus ; étiquettes de l'axe éclaircies si elles sont nombreuses. Vue tableau équivalente.
 */
@Component({
  selector: 'app-colonnes',
  template: `
    @if (vueTableau()) {
      <table class="tableau-graphique">
        <caption class="visuellement-cache">{{ titre() }}</caption>
        <thead>
          <tr>
            <th scope="col">{{ enteteLibelle() }}</th>
            <th scope="col">Nombre</th>
          </tr>
        </thead>
        <tbody>
          @for (c of colonnes(); track $index) {
            <tr>
              <th scope="row">{{ c.libelle }}</th>
              <td>{{ c.texte ?? nombre(c.nombre) }}</td>
            </tr>
          }
        </tbody>
      </table>
    } @else {
      <div class="colonnes" role="img" [attr.aria-label]="resume()">
        <div class="axe-y" aria-hidden="true">
          <span>{{ nombre(max()) }}</span>
          <span>0</span>
        </div>
        <div class="trace" aria-hidden="true">
          @for (c of colonnes(); track $index; let i = $index) {
            <div class="colonne" [attr.title]="c.libelle + ' : ' + (c.texte ?? nombre(c.nombre))">
              <span class="barre-colonne" [style.height.%]="hauteur(c)"></span>
              <span class="etiquette" [class.masquee]="!etiquetteVisible(i)">{{ c.etiquette }}</span>
            </div>
          }
        </div>
      </div>
    }
    <button type="button" class="bascule" [attr.aria-controls]="id" (click)="vueTableau.set(!vueTableau())" [attr.aria-pressed]="vueTableau()">
      {{ vueTableau() ? 'Voir le graphique' : 'Voir le tableau' }}
    </button>
  `,
  styleUrl: './graphiques.scss',
  host: { '[id]': 'id' },
})
export class Colonnes {
  protected readonly id = `graphique-colonnes-${++compteur}`;
  protected readonly nombre = nombre;
  readonly colonnes = input.required<ColonneGraphique[]>();
  readonly titre = input.required<string>();
  readonly enteteLibelle = input('Valeur');

  protected readonly vueTableau = signal(false);
  protected readonly max = computed(() => Math.max(0, ...this.colonnes().map((c) => c.nombre)));
  /** Une étiquette sur `pas` quand il y en a trop pour la largeur (8 au plus visibles). */
  private readonly pas = computed(() => Math.max(1, Math.ceil(this.colonnes().length / 8)));

  /** Résumé lu par les lecteurs d'écran : étendue et valeur la plus fréquente. */
  protected readonly resume = computed(() => {
    const colonnes = this.colonnes();
    if (!colonnes.length) {
      return `${this.titre()} : aucune donnée.`;
    }
    const pic = colonnes.reduce((a, b) => (b.nombre > a.nombre ? b : a));
    return `${this.titre()} : ${colonnes.length} valeurs, de ${colonnes[0].libelle} à ${colonnes[colonnes.length - 1].libelle} ; la plus fréquente : ${pic.libelle} (${nombre(pic.nombre)}). Le détail est dans la vue tableau.`;
  });

  protected hauteur(colonne: ColonneGraphique): number {
    const max = this.max();
    return max > 0 ? Math.max((colonne.nombre / max) * 100, colonne.nombre > 0 ? 1 : 0) : 0;
  }

  protected etiquetteVisible(index: number): boolean {
    return index % this.pas() === 0 || index === this.colonnes().length - 1;
  }
}
