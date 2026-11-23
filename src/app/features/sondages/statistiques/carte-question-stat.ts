import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, DestroyRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FiltresStatistiques, PageTextes, QuestionStat } from '../../../core/models/statistiques.model';
import { StatistiquesService } from '../../../core/services/statistiques.service';
import { messageErreur } from '../../../core/utils/erreur-http';
import { Barre, BarresHorizontales, barresEffectifs } from './graphiques/barres-horizontales';
import { ColonneGraphique, Colonnes } from './graphiques/colonnes';
import { decimal, nombre, periode, pourcentage } from './graphiques/format';
import { DateLPipe } from '../../../core/i18n/formats.pipes';
import { traduire } from '../../../core/i18n/traduire';
import { TranslocoPipe } from '@jsverse/transloco';
import { PlurielPipe } from '../../../core/i18n/formats.pipes';

const TAILLE_TEXTES = 10;

/**
 * Statistiques d'une question selon son type : barres (choix, oui/non, rang moyen du classement), colonnes
 * (distribution d'un nombre ou d'une échelle, répartition des dates), tableau (matrice), liste paginée (textes).
 * Répondants, « sans réponse » et petit effectif toujours indiqués.
 */
@Component({
  selector: 'app-carte-question-stat',
  imports: [PlurielPipe, TranslocoPipe, DateLPipe,  NgTemplateOutlet, BarresHorizontales, Colonnes],
  templateUrl: './carte-question-stat.html',
  styleUrl: './carte-question-stat.scss',
})
export class CarteQuestionStat {
  private readonly service = inject(StatistiquesService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly nombre = nombre;
  protected readonly decimal = decimal;
  protected readonly pourcentage = pourcentage;

  readonly question = input.required<QuestionStat>();
  readonly numero = input.required<number>();
  /** Pour paginer les textes avec les mêmes filtres. */
  readonly sondageId = input.required<number>();
  readonly filtres = input.required<FiltresStatistiques>();
  /**
   * Réponses de la portée affichée, pour « vue par X répondants sur Y » ; null en vue « toutes les versions » (le total
   * peut compter des versions où la question n'existait pas : le backend ne l'expose pas encore par question).
   */
  readonly totalReponses = input<number | null>(null);

  protected readonly barresOptions = computed<Barre[]>(() => barresEffectifs(this.question().options ?? []));

  /** Classement : longueur = meilleure place (rang moyen 1 = barre pleine), libellé « rang moyen 1,8 · 1er : 12 ». */
  protected readonly barresClassement = computed<Barre[]>(() => {
    const rangs = this.question().classement ?? [];
    const n = rangs.length;
    return [...rangs]
      .sort((a, b) => (a.rangMoyen ?? Infinity) - (b.rangMoyen ?? Infinity))
      .map((r) => ({
        libelle: r.libelle,
        valeur: r.rangMoyen == null || n < 2 ? 0 : (n - r.rangMoyen + 1) / n,
        texte: traduire('statistiques.carte.rangMoyen', { rang: decimal(r.rangMoyen), premiers: nombre(r.nombrePremier) }),
      }));
  });

  protected readonly colonnesNumerique = computed<ColonneGraphique[]>(() =>
    (this.question().numerique?.distribution ?? []).map((c) => {
      // Valeur exacte, ou tranche [de ; a[ (champs absents du JSON quand ils sont vides : test « != null »).
      const exacte = c.valeur != null;
      const etiquette = exacte ? decimal(c.valeur) : `${decimal(c.de)}–${decimal(c.a)}`;
      return {
        etiquette,
        libelle: exacte ? etiquette : traduire('statistiques.carte.intervalle', { de: decimal(c.de), a: decimal(c.a) }),
        nombre: c.nombre,
        texte: `${nombre(c.nombre)} · ${pourcentage(c.pourcentage)}`,
      };
    }),
  );

  protected readonly colonnesDates = computed<ColonneGraphique[]>(() =>
    (this.question().dates?.repartition ?? []).map((p) => ({
      etiquette: periode(p.periode),
      libelle: periode(p.periode),
      nombre: p.nombre,
    })),
  );

  /** Textes : 1re page fournie avec les statistiques, pages suivantes demandées au serveur. */
  protected readonly pageTextes = signal<PageTextes | null>(null);
  protected readonly chargementTextes = signal(false);
  protected readonly erreurTextes = signal<string | null>(null);
  protected readonly textes = computed(() => this.pageTextes() ?? this.question().textes);

  protected changerPageTextes(page: number): void {
    this.chargementTextes.set(true);
    this.erreurTextes.set(null);
    this.service
      .textes(this.sondageId(), this.question().questionId, this.filtres(), page, this.question().textes?.taille ?? TAILLE_TEXTES)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultat) => {
          this.pageTextes.set(resultat);
          this.chargementTextes.set(false);
        },
        error: (erreur: unknown) => {
          this.erreurTextes.set(messageErreur(erreur));
          this.chargementTextes.set(false);
        },
      });
  }

  /** Intensité d'une cellule de matrice (même teinte, plus foncée avec la part). */
  protected fond(pourcentageCellule: number): string {
    return `color-mix(in srgb, var(--mat-sys-primary) ${Math.round(pourcentageCellule * 0.6)}%, transparent)`;
  }
}
