import { Component, DestroyRef, effect, inject, model, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatRadioModule } from '@angular/material/radio';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { FormulaireResponse, LIBELLES_STATUT_SONDAGE } from '../../../../core/models/sondage.model';
import { SondageService } from '../../../../core/services/sondage.service';
import { MessageErreur } from '../../../../shared/components/message-erreur/message-erreur';
import { DateLPipe } from '../../../../core/i18n/formats.pipes';
import { TranslocoPipe } from '@jsverse/transloco';
import { PlurielPipe } from '../../../../core/i18n/formats.pipes';

export const TAILLE_FORMULAIRES = 10;

/**
 * Formulaires réutilisables de l'entreprise (GET /api/sondages/formulaires) : modèles d'abord, puis du plus
 * récemment modifié ; filtre « Modèles seulement ». `choisi` : le formulaire sélectionné (liaison bidirectionnelle).
 */
@Component({
  selector: 'app-choix-formulaire',
  imports: [PlurielPipe, TranslocoPipe, DateLPipe, 
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatRadioModule,
    MatSlideToggleModule,
    MessageErreur,
  ],
  template: `
    <div class="barre-outils">
      <mat-slide-toggle [checked]="modelesSeulement()" (change)="filtrer($event.checked)">
        {{ 'sondages.choix.modelesSeulement' | transloco }}
      </mat-slide-toggle>
    </div>

    <div class="zone-progression">
      @if (chargement()) {
        <mat-progress-bar mode="indeterminate" [attr.aria-label]="'sondages.choix.chargement' | transloco" />
      }
    </div>
    <app-message-erreur [erreur]="erreur()" [parDefaut]="'sondages.choix.erreur' | transloco">
      <p><button matButton type="button" (click)="charger()">{{ 'commun.reessayer' | transloco }}</button></p>
    </app-message-erreur>

    @if (!chargement() && !erreur() && formulaires().length === 0) {
      <p class="etat-vide" role="status">
        {{ (modelesSeulement() ? 'sondages.choix.aucunModele' : 'sondages.choix.aucun') | transloco }}
      </p>
    } @else if (formulaires().length) {
      <mat-radio-group
        class="liste-formulaires"
        [attr.aria-label]="'sondages.creation.aReutiliser' | transloco"
        [value]="choisi()?.id ?? null"
        (change)="choisir($event.value)"
      >
        @for (f of formulaires(); track f.id) {
          <mat-radio-button [value]="f.id" class="formulaire" [class.choisi]="choisi()?.id === f.id">
            <span class="titre">
              <span dir="auto">{{ f.titre }}</span>
              @if (f.estModele) {
                <span class="pastille-statut etiquette-modele">{{ 'sondages.liste.modele' | transloco }}</span>
              }
            </span>
            <span class="cellule-secondaire">
              {{ 'statistiques.filtres.version' | transloco: { version: f.version } }} · {{ libellesStatut[f.statut] }} ·
              {{ 'sondages.choix.questions' | pluriel: f.nombreQuestions }} ·
              {{ 'sondages.liste.modifieLe' | transloco: { date: (f.dateModification | dateL: 'court') } }}
            </span>
          </mat-radio-button>
        }
      </mat-radio-group>
      @if (total() > taille) {
        <mat-paginator
          [length]="total()"
          [pageIndex]="page()"
          [pageSize]="taille"
          [hidePageSize]="true"
          (page)="changerPage($event)"
          [attr.aria-label]="'sondages.choix.pagination' | transloco"
        />
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .liste-formulaires {
      display: flex;
      flex-direction: column;
      gap: var(--bt-espace-2);
    }

    .formulaire {
      padding: var(--bt-espace-2) var(--bt-espace-3);
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--bt-rayon);
      background: var(--mat-sys-surface);

      &.choisi {
        border-color: var(--mat-sys-primary);
        background: var(--mat-sys-primary-container);
      }
    }

    .titre {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--bt-espace-2);
      font: var(--mat-sys-title-small);
      overflow-wrap: anywhere;
    }
  `,
})
export class ChoixFormulaire {
  private readonly service = inject(SondageService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly libellesStatut = LIBELLES_STATUT_SONDAGE;
  protected readonly taille = TAILLE_FORMULAIRES;

  readonly choisi = model<FormulaireResponse | null>(null);

  protected readonly modelesSeulement = signal(false);
  protected readonly page = signal(0);
  protected readonly formulaires = signal<FormulaireResponse[]>([]);
  protected readonly total = signal(0);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<unknown>(null);

  constructor() {
    effect(() => {
      const modeles = this.modelesSeulement();
      const page = this.page();
      untracked(() => this.charger(modeles, page));
    });
  }

  protected filtrer(modeles: boolean): void {
    if (modeles !== this.modelesSeulement()) {
      this.page.set(0);
      this.modelesSeulement.set(modeles);
    }
  }

  protected changerPage(evenement: PageEvent): void {
    this.page.set(evenement.pageIndex);
  }

  protected choisir(id: number): void {
    this.choisi.set(this.formulaires().find((f) => f.id === id) ?? null);
  }

  protected charger(modeles = this.modelesSeulement(), page = this.page()): void {
    this.chargement.set(true);
    this.erreur.set(null);
    this.service
      .formulaires(modeles, page, TAILLE_FORMULAIRES)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultat) => {
          this.formulaires.set(resultat.contenu);
          this.total.set(resultat.totalElements);
          this.chargement.set(false);
        },
        error: (erreur: unknown) => {
          this.erreur.set(erreur);
          this.chargement.set(false);
        },
      });
  }
}
