import { Component, computed, input, signal } from '@angular/core';
import { nombre, pourcentage } from './format';
import { TranslocoPipe } from '@jsverse/transloco';

/** Une barre : libellé, valeur et texte affiché au bout (« 62 · 51,7 % »). */
export interface Barre {
  libelle: string;
  /** Longueur relative (0 à max). */
  valeur: number;
  /** Texte au bout de la barre et dans le tableau. */
  texte: string;
  /** Colonne supplémentaire du tableau (ex. pourcentage), facultative. */
  detail?: string;
}

/** Barres d'effectifs avec pourcentage : choix, oui/non. */
export function barresEffectifs(items: { libelle: string; nombre: number; pourcentage: number }[]): Barre[] {
  return items.map((i) => ({
    libelle: i.libelle,
    valeur: i.nombre,
    texte: `${nombre(i.nombre)} · ${pourcentage(i.pourcentage)}`,
  }));
}

let compteur = 0;

/**
 * Barres horizontales (une seule série : une couleur, pas de légende ; le titre de la carte dit ce qui est mesuré).
 * Barres de 20 px au plus, bout arrondi, valeur en clair au bout (jamais seulement la longueur), libellé à gauche
 * (au-dessus sur un conteneur étroit). Résumé pour les lecteurs d'écran et vue tableau équivalente.
 */
@Component({
  selector: 'app-barres-horizontales',
  imports: [TranslocoPipe],
  template: `
    @if (vueTableau()) {
      <table class="tableau-graphique">
        <caption class="visuellement-cache">{{ titre() }}</caption>
        <thead>
          <tr>
            <th scope="col">{{ enteteLibelle() ?? ('statistiques.graphique.reponse' | transloco) }}</th>
            <th scope="col">{{ enteteValeur() ?? ('statistiques.graphique.nombreEtPart' | transloco) }}</th>
          </tr>
        </thead>
        <tbody>
          @for (b of barres(); track $index) {
            <tr>
              <th scope="row" dir="auto">{{ b.libelle }}</th>
              <td>{{ b.texte }}</td>
            </tr>
          }
        </tbody>
      </table>
    } @else {
      <ul class="barres" role="list" [attr.aria-label]="titre()">
        @for (b of barres(); track $index) {
          <li class="barre" [attr.aria-label]="b.libelle + ' : ' + b.texte">
            <span class="libelle" aria-hidden="true" dir="auto">{{ b.libelle }}</span>
            <span class="piste" aria-hidden="true">
              <span class="remplissage" [style.width.%]="largeur(b)" [attr.title]="b.libelle + ' : ' + b.texte"></span>
              <span class="valeur">{{ b.texte }}</span>
            </span>
          </li>
        }
      </ul>
    }
    <button type="button" class="bascule" [attr.aria-controls]="id" (click)="vueTableau.set(!vueTableau())" [attr.aria-pressed]="vueTableau()">
      {{ (vueTableau() ? 'statistiques.graphique.voirGraphique' : 'statistiques.graphique.voirTableau') | transloco }}
    </button>
  `,
  styleUrl: './graphiques.scss',
  host: { '[id]': 'id' },
})
export class BarresHorizontales {
  protected readonly id = `graphique-${++compteur}`;
  readonly barres = input.required<Barre[]>();
  /** Résumé du graphique pour les lecteurs d'écran (légende du tableau). */
  readonly titre = input.required<string>();
  /** En-têtes de la vue tableau ; absents : « Réponse » et « Nombre et part » dans la langue courante. */
  readonly enteteLibelle = input<string | null>(null);
  readonly enteteValeur = input<string | null>(null);

  protected readonly vueTableau = signal(false);
  private readonly max = computed(() => Math.max(0, ...this.barres().map((b) => b.valeur)));

  protected largeur(barre: Barre): number {
    const max = this.max();
    return max > 0 ? Math.max((barre.valeur / max) * 100, barre.valeur > 0 ? 1 : 0) : 0;
  }
}
