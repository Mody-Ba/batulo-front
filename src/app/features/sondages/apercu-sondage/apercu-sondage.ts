import { Component, computed, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { accueilNecessaire, ApercuResponse } from '../../../core/models/sondage.model';
import { SondageService } from '../../../core/services/sondage.service';
import { MessageErreur } from '../../../shared/components/message-erreur/message-erreur';
import { AccueilSondage } from '../../../shared/formulaire/accueil/accueil-sondage';
import { variablesApparence } from '../../../shared/formulaire/apparence/apparence';
import { BandeauApparence } from '../../../shared/formulaire/apparence/bandeau-apparence';
import { FormulaireSondage } from '../../../shared/formulaire/formulaire-sondage';
import { TranslocoPipe } from '@jsverse/transloco';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { LangueService } from '../../../core/i18n/langue.service';
import { estLangue } from '../../../core/i18n/langues';
import { LangueContenu, LIBELLES_LANGUE } from '../../../core/models/traduction.model';

export type Appareil = 'ordinateur' | 'telephone';

/**
 * Prévisualisation (GET .../apercu) : le formulaire tel que le verra le répondant, avec les composants du formulaire
 * public (F6), sans envoi. Le cadre « téléphone » (390 px) montre la mise en page mobile, les champs suivant la
 * largeur du formulaire (container queries). La page d'accueil (objet, confidentialité, consentement) vient d'abord,
 * comme pour le répondant ; « Recommencer » y ramène. Sondage en plusieurs langues : sélecteur « Langue du contenu »
 * propre à l'aperçu (la langue de l'interface de l'admin ne change pas), contenu relu sans perdre les réponses, cadre en
 * RTL pour l'arabe.
 */
@Component({
  selector: 'app-apercu-sondage',
  imports: [TranslocoPipe, RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
    MatProgressBarModule,
    MessageErreur,
    AccueilSondage,
    FormulaireSondage,
    BandeauApparence,
  ],
  template: `
    <section class="conteneur-page">
      <div class="barre">
        <a matButton [routerLink]="['/sondages', id()]" class="retour">
          <mat-icon fontIcon="arrow_back" aria-hidden="true" />{{ 'sondages.diffuser.fiche' | transloco }}
        </a>
        <h1 class="titre-page">{{ 'sondages.apercu.titre' | transloco }}</h1>
        <span class="espace"></span>
        @if (languesContenu(); as langues) {
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="champ-langue">
            <mat-label>{{ 'sondages.apercu.langueContenu' | transloco }}</mat-label>
            <mat-select [value]="apercu()?.langue" (selectionChange)="changerLangue($event.value)">
              @for (l of langues; track l) {
                <mat-option [value]="l">{{ nomLangue(l) }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }
        <mat-button-toggle-group
          [attr.aria-label]="'sondages.apercu.taille' | transloco"
          [value]="appareil()"
          (change)="appareil.set($event.value)"
          [hideSingleSelectionIndicator]="true"
        >
          <mat-button-toggle value="ordinateur">
            <mat-icon fontIcon="computer" aria-hidden="true" />{{ 'sondages.apercu.ordinateur' | transloco }}
          </mat-button-toggle>
          <mat-button-toggle value="telephone">
            <mat-icon fontIcon="smartphone" aria-hidden="true" />{{ 'sondages.apercu.telephone' | transloco }}
          </mat-button-toggle>
        </mat-button-toggle-group>
      </div>

      <div class="zone-progression">
        @if (chargement()) {
          <mat-progress-bar mode="indeterminate" [attr.aria-label]="'sondages.apercu.chargement' | transloco" />
        }
      </div>
      <app-message-erreur [erreur]="erreur()" [parDefaut]="'sondages.apercu.erreur' | transloco">
        <p><button matButton type="button" (click)="charger()">{{ 'commun.reessayer' | transloco }}</button></p>
      </app-message-erreur>

      @if (apercu(); as a) {
        <div class="scene" [class.telephone]="appareil() === 'telephone'">
          <!-- Couleurs de l'entreprise limitées au cadre : le reste de la page garde celles de Batulo. -->
          <div class="cadre" [style]="variablesApparence()">
            <app-bandeau-apparence [apparence]="a.apparence" />
            @if (accueilAffiche()) {
              <app-accueil-sondage [contenu]="a" mode="apercu" [niveauTitre]="2" (commencer)="accueilPasse.set(true)" />
            } @else {
              <app-formulaire-sondage [contenu]="a" mode="apercu" (recommence)="accueilPasse.set(false)" />
            }
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
        margin-inline-end: var(--bt-espace-1);
        vertical-align: middle;
      }
    }

    .champ-langue {
      width: 180px;
    }

    .retour {
      margin-inline-start: calc(-1 * var(--bt-espace-3));
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
  private readonly langueInterface = inject(LangueService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly nomLangue = (l: LangueContenu) => LIBELLES_LANGUE[l];

  /** Paramètre de route :id. */
  readonly id = input.required<string>();

  protected readonly appareil = signal<Appareil>('ordinateur');
  /** « Commencer » cliqué sur la page d'accueil de l'aperçu. */
  protected readonly accueilPasse = signal(false);
  protected readonly accueilAffiche = computed(() => {
    const a = this.apercu();
    return !!a && accueilNecessaire(a) && !this.accueilPasse();
  });
  protected readonly apercu = signal<ApercuResponse | null>(null);
  /** Couleur de l'entreprise (variables CSS du cadre), seulement si elle est valide et personnalisée. */
  protected readonly variablesApparence = computed(() => variablesApparence(this.apercu()?.apparence));
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<unknown>(null);
  /** Langues du sondage s'il en a plusieurs (sélecteur « Langue du contenu », à part de celui de l'interface). */
  protected readonly languesContenu = computed<LangueContenu[] | null>(() => {
    const disponibles = (this.apercu()?.languesDisponibles ?? []).filter(estLangue);
    return disponibles.length > 1 ? disponibles : null;
  });
  /**
   * Langue demandée : d'abord celle de l'interface (le serveur sert la principale si elle n'est pas proposée), puis
   * celle choisie dans le sélecteur.
   */
  private langueDemandee: string | null = null;

  constructor() {
    effect(() => {
      const id = Number(this.id());
      untracked(() => this.charger(id));
    });
  }

  /** Contenu relu dans une autre langue ; réponses saisies et page d'accueil passée gardées (même formulaire). */
  protected changerLangue(langue: LangueContenu): void {
    this.langueDemandee = langue;
    this.charger();
  }

  protected charger(id = Number(this.id())): void {
    this.chargement.set(true);
    this.erreur.set(null);
    this.service
      .apercu(id, this.langueDemandee ?? this.langueInterface.langue())
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
