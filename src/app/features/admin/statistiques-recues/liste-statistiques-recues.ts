import { Component, computed, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router } from '@angular/router';
import { PageResponse } from '../../../core/models/page.model';
import { EnvoiStatistiqueResponse, resumeEnvoi } from '../../../core/models/statistiques.model';
import { StatistiquesService } from '../../../core/services/statistiques.service';
import { numeroPageUrl, parametresPage, taillePageUrl, TAILLES_PAGE } from '../../../core/utils/pagination-url';
import { EntetePage } from '../../../shared/components/entete-page/entete-page';
import { MessageErreur } from '../../../shared/components/message-erreur/message-erreur';
import { DateLPipe } from '../../../core/i18n/formats.pipes';


/**
 * Admin : statistiques envoyées par ses gestionnaires (sondages terminés), les plus récentes d'abord ; « Nouveau » tant
 * qu'elles n'ont pas été ouvertes. ?page=&taille= dans l'URL.
 */
@Component({
  selector: 'app-liste-statistiques-recues',
  imports: [DateLPipe,  MatButtonModule, MatIconModule, MatPaginatorModule, MatProgressBarModule, EntetePage, MessageErreur],
  template: `
    <section class="conteneur-page">
      <app-entete-page
        titre="Statistiques reçues"
        icone="insights"
        sousTitre="Les statistiques de sondages terminés que vos gestionnaires vous ont envoyées, recalculées à l’ouverture."
      />
      <div class="zone-progression">
        @if (chargement()) {
          <mat-progress-bar mode="indeterminate" aria-label="Chargement des statistiques reçues" />
        }
      </div>
      <app-message-erreur [erreur]="erreur()" parDefaut="Les statistiques reçues n’ont pas pu être chargées.">
        <p><button matButton type="button" (click)="charger()">Réessayer</button></p>
      </app-message-erreur>

      @if (page(); as p) {
        @if (p.contenu.length === 0) {
          <p class="etat-vide" role="status">Aucune statistique reçue pour le moment.</p>
        } @else {
          <ul class="envois">
            @for (e of p.contenu; track e.id) {
              <li>
                <button type="button" class="envoi" (click)="ouvrir(e)" [class.nouveau]="!e.consulteLe">
                  <span class="titre">
                    {{ e.sondageTitre }}
                    @if (!e.consulteLe) {
                      <span class="pastille-statut compte-temporaire">Nouveau</span>
                    }
                  </span>
                  <span class="cellule-secondaire">
                    De {{ e.expediteurNom }}, le {{ e.dateEnvoi | dateL: 'courtHeure' }} · {{ resume(e) }}
                  </span>
                  @if (e.commentaire) {
                    <span class="commentaire">« {{ e.commentaire }} »</span>
                  }
                  <mat-icon fontIcon="chevron_right" aria-hidden="true" />
                </button>
              </li>
            }
          </ul>
          <mat-paginator
            [length]="p.totalElements"
            [pageIndex]="numeroPage()"
            [pageSize]="taillePage()"
            [pageSizeOptions]="tailles"
            (page)="changerPage($event)"
            aria-label="Pagination des statistiques reçues"
          />
        }
      }
    </section>
  `,
  styles: `
    .envois {
      margin: 0;
      padding: 0;
      list-style: none;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--bt-rayon);
      overflow: hidden;

      li + li {
        border-top: 1px solid var(--mat-sys-outline-variant);
      }
    }

    .envoi {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: var(--bt-espace-1);
      width: 100%;
      padding: var(--bt-espace-3) var(--bt-espace-8) var(--bt-espace-3) var(--bt-espace-4);
      border: 0;
      background: var(--mat-sys-surface);
      color: inherit;
      text-align: left;
      cursor: pointer;

      &:hover {
        background: var(--mat-sys-surface-container);
      }

      &:focus-visible {
        outline: 2px solid var(--mat-sys-primary);
        outline-offset: -2px;
      }

      &.nouveau .titre {
        font-weight: 700;
      }

      .mat-icon {
        position: absolute;
        top: 50%;
        right: var(--bt-espace-3);
        transform: translateY(-50%);
      }
    }

    .titre {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--bt-espace-2);
      font: var(--mat-sys-title-small);
    }

    .commentaire {
      font: var(--mat-sys-body-medium);
      font-style: italic;
      overflow-wrap: anywhere;
    }
  `,
})
export class ListeStatistiquesRecues {
  private readonly service = inject(StatistiquesService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly tailles = [...TAILLES_PAGE];
  protected readonly resume = resumeEnvoi;

  readonly pageUrl = input<string | undefined>(undefined, { alias: 'page' });
  readonly taille = input<string | undefined>(undefined);
  protected readonly numeroPage = computed(() => numeroPageUrl(this.pageUrl()));
  protected readonly taillePage = computed(() => taillePageUrl(this.taille()));

  protected readonly page = signal<PageResponse<EnvoiStatistiqueResponse> | null>(null);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<unknown>(null);

  constructor() {
    effect(() => {
      const page = this.numeroPage();
      const taille = this.taillePage();
      untracked(() => this.charger(page, taille));
    });
  }

  protected charger(page = this.numeroPage(), taille = this.taillePage()): void {
    this.chargement.set(true);
    this.erreur.set(null);
    this.service
      .recues(page, taille)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultat) => {
          this.page.set(resultat);
          this.chargement.set(false);
        },
        error: (erreur: unknown) => {
          this.erreur.set(erreur);
          this.chargement.set(false);
        },
      });
  }

  protected changerPage(evenement: PageEvent): void {
    void this.router.navigate([], { queryParams: parametresPage(evenement.pageIndex, evenement.pageSize), queryParamsHandling: 'merge' });
  }

  /** L'envoi est passé à la page (commentaire, expéditeur) : il n'existe pas de route qui le relise seul. */
  protected ouvrir(envoi: EnvoiStatistiqueResponse): void {
    void this.router.navigate(['/admin/statistiques-recues', envoi.id], { state: { envoi } });
  }
}
