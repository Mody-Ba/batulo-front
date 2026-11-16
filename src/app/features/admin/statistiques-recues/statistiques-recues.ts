import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import {
  EnvoiStatistiqueResponse,
  FiltresStatistiques,
  StatistiquesResponse,
} from '../../../core/models/statistiques.model';
import { ExportService } from '../../../core/services/export.service';
import { StatistiquesService } from '../../../core/services/statistiques.service';
import { messageErreur } from '../../../core/utils/erreur-http';
import { EntetePage } from '../../../shared/components/entete-page/entete-page';
import { MessageErreur } from '../../../shared/components/message-erreur/message-erreur';
import { CarteQuestionStat } from '../../sondages/statistiques/carte-question-stat';
import { nombre } from '../../sondages/statistiques/graphiques/format';
import { grouperParSection } from '../../sondages/statistiques/groupes-questions';
import { resumeFiltres, totalUneVersion } from '../../sondages/statistiques/resume-filtres';

/**
 * Admin : statistiques reçues, recalculées avec les filtres de l'envoi (GET /api/statistiques-recues/{id}, qui les
 * marque comme consultées), et leur rapport PDF. L'expéditeur et le commentaire viennent de la liste (état de
 * navigation), sinon (rechargement, lien d'un message ou d'une notification) de GET /api/envois-statistiques/{id}.
 */
@Component({
  selector: 'app-statistiques-recues',
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule, MatProgressBarModule, EntetePage, MessageErreur, CarteQuestionStat],
  template: `
    <section class="conteneur-page">
      <a matButton routerLink="/admin/statistiques-recues" class="retour">
        <mat-icon fontIcon="arrow_back" aria-hidden="true" />Statistiques reçues
      </a>
      <div class="zone-progression">
        @if (chargement()) {
          <mat-progress-bar mode="indeterminate" aria-label="Calcul des statistiques" />
        }
      </div>
      <app-message-erreur [erreur]="erreur()" parDefaut="Ces statistiques n’ont pas pu être ouvertes." />

      @if (statistiques(); as st) {
        <app-entete-page [titre]="st.titre" icone="insights" [sousTitre]="filtresEnClair().join(' · ')">
          <button matButton="filled" type="button" (click)="telechargerPdf()" [disabled]="pdfEnCours()">
            <mat-icon fontIcon="picture_as_pdf" aria-hidden="true" />{{ pdfEnCours() ? 'Préparation…' : 'Rapport PDF' }}
          </button>
        </app-entete-page>

        @if (envoi(); as e) {
          <div class="envoi carte-section">
            <p>Envoyées par <strong>{{ e.expediteurNom }}</strong> le {{ e.dateEnvoi | date: 'd MMMM y à HH:mm' }}.</p>
            @if (e.commentaire) {
              <blockquote>{{ e.commentaire }}</blockquote>
            }
          </div>
        }

        <p class="texte-aide">
          {{ nombre(st.resume.nombreReponses) }} réponse{{ st.resume.nombreReponses > 1 ? 's' : '' }}
          @if (st.resume.premiereReponse) {
            , du {{ st.resume.premiereReponse | date: 'd MMM y' }} au {{ st.resume.derniereReponse | date: 'd MMM y' }}
          }
          .
        </p>
        @if (st.resume.petitEffectif && st.resume.nombreReponses > 0) {
          <p class="avertissement" role="note"><span aria-hidden="true">⚠</span> Moins de 5 réponses : résultats à interpréter avec prudence.</p>
        }
        @for (g of groupes(); track $index) {
          <section class="groupe" [attr.aria-label]="'Section ' + g.section">
            <h2 class="titre-section">{{ g.section }}</h2>
            @for (q of g.questions; track q.question.questionId) {
              <app-carte-question-stat [question]="q.question" [numero]="q.numero" [sondageId]="st.sondageId" [filtres]="filtres()" [totalReponses]="totalUneVersion(st)" />
            }
          </section>
        }
      }
    </section>
  `,
  styles: `
    .retour {
      margin: 0 0 var(--bt-espace-2) calc(-1 * var(--bt-espace-3));
    }

    .envoi {
      margin-bottom: var(--bt-espace-4);

      p {
        margin: 0;
      }

      blockquote {
        margin: var(--bt-espace-2) 0 0;
        padding-left: var(--bt-espace-3);
        border-left: 3px solid var(--mat-sys-outline-variant);
        white-space: pre-line;
        overflow-wrap: anywhere;
      }
    }

    .avertissement {
      padding: var(--bt-espace-2) var(--bt-espace-3);
      border-radius: 8px;
      background: var(--bt-attente-fond);
      color: var(--bt-attente-texte);
    }

    .groupe {
      display: flex;
      flex-direction: column;
      gap: var(--bt-espace-3);
      margin-bottom: var(--bt-espace-6);
    }

    .titre-section {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-title-small);
      text-transform: uppercase;
    }
  `,
})
export class StatistiquesRecues {
  private readonly service = inject(StatistiquesService);
  private readonly exports = inject(ExportService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly nombre = nombre;
  protected readonly totalUneVersion = totalUneVersion;

  /** Paramètre de route :envoiId. */
  readonly envoiId = input.required<string>();
  /** Envoi passé par la liste, sinon relu seul. */
  protected readonly envoi = signal<EnvoiStatistiqueResponse | null>(
    (inject(Router).currentNavigation()?.extras.state?.['envoi'] as EnvoiStatistiqueResponse | undefined) ??
      (history.state?.envoi as EnvoiStatistiqueResponse | undefined) ??
      null,
  );

  protected readonly statistiques = signal<StatistiquesResponse | null>(null);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<unknown>(null);
  protected readonly pdfEnCours = signal(false);

  protected readonly groupes = computed(() => grouperParSection(this.statistiques()?.questions ?? []));

  /** Filtres de l'envoi, relus dans les statistiques (pour paginer les textes avec les mêmes). */
  protected readonly filtres = computed<FiltresStatistiques>(() => {
    const st = this.statistiques();
    const envoi = this.envoi();
    return {
      lignee: st?.lignee ?? false,
      du: st?.du ?? null,
      au: st?.au ?? null,
      granularite: envoi?.granulariteDate ?? null,
      criteres: envoi?.criteres ?? (st?.criteres ?? []).flatMap((c) => c.valeurs.map((v) => `${c.cle}:${v.valeur}`)),
    };
  });
  protected readonly filtresEnClair = computed(() =>
    resumeFiltres(this.filtres(), this.statistiques()?.criteres ?? [], this.statistiques()?.versions[0] ?? 1),
  );

  constructor() {
    effect(() => {
      const id = Number(this.envoiId());
      untracked(() => {
        this.charger(id);
        if (this.envoi()?.id !== id) {
          this.envoi.set(null);
          this.lireEnvoi(id);
        }
      });
    });
  }

  /** Expéditeur et commentaire : une erreur ici n'empêche pas d'afficher les statistiques. */
  private lireEnvoi(id: number): void {
    this.service
      .envoi(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (envoi) => this.envoi.set(envoi), error: () => undefined });
  }

  protected charger(id = Number(this.envoiId())): void {
    this.chargement.set(true);
    this.erreur.set(null);
    this.service
      .recue(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (st) => {
          this.statistiques.set(st);
          this.chargement.set(false);
        },
        error: (erreur: unknown) => {
          this.erreur.set(erreur);
          this.chargement.set(false);
        },
      });
  }

  protected telechargerPdf(): void {
    this.pdfEnCours.set(true);
    this.exports
      .statistiquesRecues(Number(this.envoiId()))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (fichier) => {
          this.pdfEnCours.set(false);
          this.exports.enregistrer(fichier);
        },
        error: (erreur: unknown) => {
          this.pdfEnCours.set(false);
          this.snackBar.open(messageErreur(erreur), 'Fermer', { duration: 6000 });
        },
      });
  }
}
