import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router, RouterLink } from '@angular/router';
import { PageResponse } from '../../../core/models/page.model';
import { EnvoiStatistiqueResponse, resumeEnvoi } from '../../../core/models/statistiques.model';
import { StatistiquesService } from '../../../core/services/statistiques.service';
import { numeroPageUrl, parametresPage, taillePageUrl, TAILLES_PAGE } from '../../../core/utils/pagination-url';
import { EntetePage } from '../../../shared/components/entete-page/entete-page';
import { MessageErreur } from '../../../shared/components/message-erreur/message-erreur';

/**
 * Gestionnaire : statistiques qu'il a envoyées à son admin, les plus récentes d'abord (?page=&taille=), avec la portée,
 * le commentaire et « Consulté le » quand l'admin les a ouvertes. Destination des messages automatiques STATISTIQUES.
 */
@Component({
  selector: 'app-statistiques-envoyees',
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule, MatPaginatorModule, MatProgressBarModule, EntetePage, MessageErreur],
  template: `
    <section class="conteneur-page">
      <app-entete-page
        titre="Statistiques envoyées"
        icone="outbox"
        sousTitre="Les statistiques de sondages terminés que vous avez envoyées à votre admin."
      />
      <div class="zone-progression">
        @if (chargement()) {
          <mat-progress-bar mode="indeterminate" aria-label="Chargement des statistiques envoyées" />
        }
      </div>
      <app-message-erreur [erreur]="erreur()" parDefaut="Les statistiques envoyées n’ont pas pu être chargées.">
        <p><button matButton type="button" (click)="charger()">Réessayer</button></p>
      </app-message-erreur>

      @if (page(); as p) {
        @if (p.contenu.length === 0) {
          <p class="etat-vide" role="status">
            Aucun envoi pour le moment. Depuis l’onglet Statistiques d’un sondage terminé, choisissez « Envoyer à l’admin ».
          </p>
        } @else {
          <ul class="envois">
            @for (e of p.contenu; track e.id) {
              <li class="envoi">
                <p class="titre">
                  <a [routerLink]="['/gestionnaire/statistiques-envoyees', e.id]">{{ e.sondageTitre }}</a>
                  <span class="pastille-statut" [class.compte-temporaire]="!e.consulteLe">
                    {{ e.consulteLe ? 'Consulté' : 'Pas encore consulté' }}
                  </span>
                </p>
                <p class="cellule-secondaire">
                  Envoyé le {{ e.dateEnvoi | date: 'd MMM y à HH:mm' }} · {{ resume(e) }}
                  @if (e.consulteLe) {
                    · consulté le {{ e.consulteLe | date: 'd MMM y' }}
                  }
                </p>
                @if (e.commentaire) {
                  <p class="commentaire">« {{ e.commentaire }} »</p>
                }
              </li>
            }
          </ul>
          <mat-paginator
            [length]="p.totalElements"
            [pageIndex]="numeroPage()"
            [pageSize]="taillePage()"
            [pageSizeOptions]="tailles"
            (page)="changerPage($event)"
            aria-label="Pagination des statistiques envoyées"
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
    }

    .envoi {
      display: flex;
      flex-direction: column;
      gap: var(--bt-espace-1);
      padding: var(--bt-espace-3) var(--bt-espace-4);
      background: var(--mat-sys-surface);

      & + & {
        border-top: 1px solid var(--mat-sys-outline-variant);
      }

      p {
        margin: 0;
      }
    }

    .titre {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--bt-espace-2);
      font: var(--mat-sys-title-small);

      a {
        display: inline-flex;
        align-items: center;
        min-height: 44px;
        color: var(--mat-sys-primary);
      }
    }

    .commentaire {
      font: var(--mat-sys-body-medium);
      font-style: italic;
      overflow-wrap: anywhere;
    }
  `,
})
export class StatistiquesEnvoyees {
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
      .envoyees(page, taille)
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
}
