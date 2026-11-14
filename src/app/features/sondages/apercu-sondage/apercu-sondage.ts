import { Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { ApercuResponse } from '../../../core/models/sondage.model';
import { SondageService } from '../../../core/services/sondage.service';
import { MessageErreur } from '../../../shared/components/message-erreur/message-erreur';
import { FormulaireSondage } from '../../../shared/formulaire/formulaire-sondage';

export type Appareil = 'ordinateur' | 'telephone';

/**
 * Prévisualisation (GET .../apercu) : le formulaire tel que le verra le répondant, avec les composants du formulaire
 * public (F6), sans envoi. Le cadre « téléphone » (390 px) montre la mise en page mobile, les champs suivant la
 * largeur du formulaire (container queries).
 */
@Component({
  selector: 'app-apercu-sondage',
  imports: [
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatProgressBarModule,
    MessageErreur,
    FormulaireSondage,
  ],
  template: `
    <section class="conteneur-page">
      <div class="barre">
        <a matButton [routerLink]="['/sondages', id()]" class="retour">
          <mat-icon fontIcon="arrow_back" aria-hidden="true" />Fiche du sondage
        </a>
        <h1 class="titre-page">Aperçu</h1>
        <span class="espace"></span>
        <mat-button-toggle-group
          aria-label="Taille de l’aperçu"
          [value]="appareil()"
          (change)="appareil.set($event.value)"
          [hideSingleSelectionIndicator]="true"
        >
          <mat-button-toggle value="ordinateur">
            <mat-icon fontIcon="computer" aria-hidden="true" />Ordinateur
          </mat-button-toggle>
          <mat-button-toggle value="telephone">
            <mat-icon fontIcon="smartphone" aria-hidden="true" />Téléphone
          </mat-button-toggle>
        </mat-button-toggle-group>
      </div>

      <div class="zone-progression">
        @if (chargement()) {
          <mat-progress-bar mode="indeterminate" aria-label="Chargement de l’aperçu" />
        }
      </div>
      <app-message-erreur [erreur]="erreur()" parDefaut="L’aperçu n’a pas pu être chargé.">
        <p><button matButton type="button" (click)="charger()">Réessayer</button></p>
      </app-message-erreur>

      @if (apercu(); as a) {
        <div class="scene" [class.telephone]="appareil() === 'telephone'">
          <div class="cadre">
            <app-formulaire-sondage [contenu]="a" mode="apercu" />
          </div>
        </div>
      }
    </section>
  `,
  styles: `
    .barre {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--bt-espace-2) var(--bt-espace-3);
      margin-bottom: var(--bt-espace-2);

      .espace {
        flex: 1;
      }

      .mat-icon {
        margin-right: var(--bt-espace-1);
        vertical-align: middle;
      }
    }

    .retour {
      margin-left: calc(-1 * var(--bt-espace-3));
    }

    .titre-page {
      margin: 0;
      font: var(--mat-sys-title-large);
    }

    .scene {
      padding: var(--bt-espace-4);
      border-radius: var(--bt-rayon);
      background: var(--mat-sys-surface-container);
    }

    .cadre {
      max-width: 760px;
      margin: 0 auto;
    }

    // Téléphone : cadre de 390 px (largeur d'un téléphone courant), bord arrondi, défilement interne.
    .telephone .cadre {
      box-sizing: border-box;
      width: 100%;
      max-width: 390px;
      max-height: 780px;
      padding: var(--bt-espace-3) var(--bt-espace-2);
      overflow-y: auto;
      border: 10px solid var(--mat-sys-on-surface);
      border-radius: 32px;
      background: var(--mat-sys-surface-container-low);
    }

    @media (max-width: 599.98px) {
      .scene {
        padding: var(--bt-espace-2);
      }
    }
  `,
})
export class ApercuSondage {
  private readonly service = inject(SondageService);
  private readonly destroyRef = inject(DestroyRef);

  /** Paramètre de route :id. */
  readonly id = input.required<string>();

  protected readonly appareil = signal<Appareil>('ordinateur');
  protected readonly apercu = signal<ApercuResponse | null>(null);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<unknown>(null);

  constructor() {
    effect(() => {
      const id = Number(this.id());
      untracked(() => this.charger(id));
    });
  }

  protected charger(id = Number(this.id())): void {
    this.chargement.set(true);
    this.erreur.set(null);
    this.service
      .apercu(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (apercu) => {
          this.apercu.set(apercu);
          this.chargement.set(false);
        },
        error: (erreur: unknown) => {
          this.erreur.set(erreur);
          this.chargement.set(false);
        },
      });
  }
}
