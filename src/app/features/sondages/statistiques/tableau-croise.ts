import { Component, computed, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  CelluleCroisement,
  CritereResponse,
  CroisementResponse,
  FiltresStatistiques,
  QuestionStat,
  TYPES_CROISABLES,
} from '../../../core/models/statistiques.model';
import { ExportService } from '../../../core/services/export.service';
import { StatistiquesService } from '../../../core/services/statistiques.service';
import { messageErreur } from '../../../core/utils/erreur-http';
import { MessageErreur } from '../../../shared/components/message-erreur/message-erreur';
import { decimal, nombre, pourcentage } from './graphiques/format';
import { traduire } from '../../../core/i18n/traduire';
import { TranslocoPipe } from '@jsverse/transloco';

export type ModeCroisement = 'nombres' | 'ligne' | 'colonne';

/**
 * Tableau croisé : une question (CHOIX_UNIQUE, CHOIX_MULTIPLE, OUI_NON, ECHELLE, NUMERIQUE) par un critère d'analyse.
 * Nombres, % de ligne ou % de colonne ; colonnes et cellules sous l'effectif minimum signalées (texte, pas seulement
 * la couleur) ; statistiques par colonne pour ECHELLE et NUMERIQUE. Export PDF ou Excel avec les mêmes filtres.
 */
@Component({
  selector: 'app-tableau-croise',
  imports: [TranslocoPipe, MatButtonModule, MatButtonToggleModule, MatFormFieldModule, MatMenuModule, MatProgressBarModule, MatSelectModule, MessageErreur],
  templateUrl: './tableau-croise.html',
  styleUrl: './tableau-croise.scss',
})
export class TableauCroise {
  private readonly service = inject(StatistiquesService);
  private readonly exports = inject(ExportService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly nombre = nombre;
  protected readonly decimal = decimal;
  protected readonly pourcentage = pourcentage;

  readonly sondageId = input.required<number>();
  readonly questions = input.required<QuestionStat[]>();
  readonly criteres = input.required<CritereResponse[]>();
  readonly filtres = input.required<FiltresStatistiques>();

  protected readonly croisables = computed(() => this.questions().filter((q) => TYPES_CROISABLES.has(q.type)));
  protected readonly cleQuestion = signal<string | null>(null);
  protected readonly clePar = signal<string | null>(null);
  protected readonly mode = signal<ModeCroisement>('nombres');

  protected readonly croisement = signal<CroisementResponse | null>(null);
  protected readonly chargement = signal(false);
  protected readonly erreur = signal<unknown>(null);
  protected readonly exportEnCours = signal(false);

  constructor() {
    // Choix par défaut : la première question croisable et le premier critère qui n'est pas cette question.
    effect(() => {
      const croisables = this.croisables();
      const criteres = this.criteres();
      untracked(() => {
        if (!croisables.some((q) => q.cle === this.cleQuestion())) {
          this.cleQuestion.set(croisables[0]?.cle ?? null);
        }
        if (!criteres.some((c) => c.cle === this.clePar())) {
          this.clePar.set(criteres.find((c) => c.cle !== this.cleQuestion())?.cle ?? criteres[0]?.cle ?? null);
        }
      });
    });
    effect(() => {
      const question = this.cleQuestion();
      const par = this.clePar();
      const filtres = this.filtres();
      untracked(() => this.charger(question, par, filtres));
    });
  }

  protected charger(question = this.cleQuestion(), par = this.clePar(), filtres = this.filtres()): void {
    if (!question || !par) {
      this.croisement.set(null);
      return;
    }
    this.chargement.set(true);
    this.erreur.set(null);
    this.service
      .croisement(this.sondageId(), question, par, filtres)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (croisement) => {
          this.croisement.set(croisement);
          this.chargement.set(false);
        },
        error: (erreur: unknown) => {
          this.erreur.set(erreur);
          this.chargement.set(false);
        },
      });
  }

  protected valeur(cellule: CelluleCroisement): string {
    switch (this.mode()) {
      case 'ligne':
        return pourcentage(cellule.pourcentageLigne);
      case 'colonne':
        return pourcentage(cellule.pourcentageColonne);
      default:
        return nombre(cellule.nombre);
    }
  }

  /** Libellé d'une colonne d'après sa valeur (null : « Non renseigné »). */
  protected libelleColonne(croisement: CroisementResponse, valeur: string | null): string {
    return croisement.colonnes.find((c) => c.valeur === valeur)?.libelle ?? valeur ?? traduire('statistiques.croise.nonRenseigne');
  }

  protected exporter(format: 'PDF' | 'XLSX'): void {
    const question = this.cleQuestion();
    const par = this.clePar();
    if (!question || !par) {
      return;
    }
    this.exportEnCours.set(true);
    this.exports
      .croisement(this.sondageId(), format, question, par, this.filtres())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (fichier) => {
          this.exportEnCours.set(false);
          this.exports.enregistrer(fichier);
        },
        error: (erreur: unknown) => {
          this.exportEnCours.set(false);
          this.snackBar.open(messageErreur(erreur), traduire('commun.fermer'), { duration: 6000 });
        },
      });
  }
}
