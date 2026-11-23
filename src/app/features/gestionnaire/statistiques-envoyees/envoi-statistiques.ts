import { Component, computed, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Params, RouterLink } from '@angular/router';
import { EnvoiStatistiqueResponse, resumeEnvoi } from '../../../core/models/statistiques.model';
import { StatistiquesService } from '../../../core/services/statistiques.service';
import { EntetePage } from '../../../shared/components/entete-page/entete-page';
import { MessageErreur } from '../../../shared/components/message-erreur/message-erreur';
import { parametresUrl } from '../../sondages/statistiques/filtres-url';
import { DateLPipe } from '../../../core/i18n/formats.pipes';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * Gestionnaire : un envoi de statistiques à son admin (GET /api/envois-statistiques/{id}) : sondage, portée et filtres,
 * commentaire, consulté ou non ; « Voir ces statistiques » rouvre l'onglet Statistiques avec les mêmes filtres.
 * Destination du message automatique STATISTIQUES.
 */
@Component({
  selector: 'app-envoi-statistiques',
  imports: [TranslocoPipe, DateLPipe,  RouterLink, MatButtonModule, MatIconModule, MatProgressBarModule, EntetePage, MessageErreur],
  template: `
    <section class="conteneur-page">
      <a matButton routerLink="/gestionnaire/statistiques-envoyees" class="retour">
        <mat-icon fontIcon="arrow_back" aria-hidden="true" />{{ 'menu.statistiquesEnvoyees' | transloco }}
      </a>
      <div class="zone-progression">
        @if (chargement()) {
          <mat-progress-bar mode="indeterminate" [attr.aria-label]="'statsEnvoyees.chargementEnvoi' | transloco" />
        }
      </div>
      <app-message-erreur [erreur]="erreur()" [parDefaut]="'statsEnvoyees.erreurEnvoi' | transloco">
        <p><button matButton type="button" (click)="charger()">{{ 'commun.reessayer' | transloco }}</button></p>
      </app-message-erreur>

      @if (envoi(); as e) {
        <app-entete-page [titre]="e.sondageTitre" icone="outbox" [sousTitre]="resume(e)">
          <a matButton="filled" [routerLink]="['/sondages', e.sondageId, 'statistiques']" [queryParams]="filtres()">
            <mat-icon fontIcon="insights" aria-hidden="true" />{{ 'statsEnvoyees.voir' | transloco }}
          </a>
        </app-entete-page>
        <div class="carte-section envoi">
          <p>{{ 'statsEnvoyees.envoyeesLe' | transloco: { date: (e.dateEnvoi | dateL: 'longHeure') } }}</p>
          <p role="status">
            @if (e.consulteLe) {
              {{ 'statsEnvoyees.consulteesLe' | transloco: { date: (e.consulteLe | dateL: 'longHeure') } }}
            } @else {
              {{ 'statsEnvoyees.pasConsultees' | transloco }}
            }
          </p>
          @if (e.commentaire) {
            <p class="libelle">{{ 'statsEnvoyees.votreCommentaire' | transloco }}</p>
            <blockquote dir="auto">{{ e.commentaire }}</blockquote>
          }
        </div>
      }
    </section>
  `,
  styles: `
    .retour {
      margin: 0 0 var(--bt-espace-2) calc(-1 * var(--bt-espace-3));
    }

    .envoi {
      display: flex;
      flex-direction: column;
      gap: var(--bt-espace-2);

      p {
        margin: 0;
      }

      .libelle {
        margin-top: var(--bt-espace-2);
        font: var(--mat-sys-label-large);
      }

      blockquote {
        margin: 0;
        padding-inline-start: var(--bt-espace-3);
        border-inline-start: 3px solid var(--mat-sys-outline-variant);
        white-space: pre-line;
        overflow-wrap: anywhere;
      }
    }
  `,
})
export class EnvoiStatistiques {
  private readonly service = inject(StatistiquesService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly resume = resumeEnvoi;

  /** Paramètre de route :envoiId. */
  readonly envoiId = input.required<string>();

  protected readonly envoi = signal<EnvoiStatistiqueResponse | null>(null);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<unknown>(null);

  /** Filtres de l'envoi, au format des paramètres d'URL de l'onglet Statistiques. */
  protected readonly filtres = computed<Params>(() => {
    const e = this.envoi();
    return e
      ? parametresUrl({ lignee: e.lignee, du: e.du, au: e.au, granularite: e.granulariteDate, criteres: e.criteres })
      : {};
  });

  constructor() {
    effect(() => {
      const id = Number(this.envoiId());
      untracked(() => this.charger(id));
    });
  }

  protected charger(id = Number(this.envoiId())): void {
    this.chargement.set(true);
    this.erreur.set(null);
    this.service
      .envoi(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (envoi) => {
          this.envoi.set(envoi);
          this.chargement.set(false);
        },
        error: (erreur: unknown) => {
          this.erreur.set(erreur);
          this.chargement.set(false);
        },
      });
  }
}
