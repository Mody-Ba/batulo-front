import { Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Subject, switchMap, catchError, of, debounceTime } from 'rxjs';
import {
  CompletudeLangueResponse,
  LANGUES_CONTENU,
  LANGUES_SUPPLEMENTAIRES_MAX,
  LangueContenu,
  LIBELLES_LANGUE,
} from '../../../../core/models/traduction.model';
import { TraductionService } from '../../../../core/services/traduction.service';
import { MessageErreur } from '../../../../shared/components/message-erreur/message-erreur';
import { EditeurSondageStore } from '../editeur-sondage.store';
import { EtatEnregistrement } from '../enregistrement-auto';
import { EtatEnregistrementIndicateur } from '../etat-enregistrement/etat-enregistrement';

/** Délai avant de relire la complétude après une modification du contenu (plusieurs écritures de suite). */
const DELAI_COMPLETUDE_MS = 600;

/**
 * Carte « Langues du sondage » de l'éditeur : langue principale (celle de la saisie) et langues supplémentaires (2 au
 * plus, la principale exclue), enregistrées tout de suite par la file du store (PUT .../langues, brouillon seulement).
 * Pour chaque langue supplémentaire : complétude (GET .../traductions) et lien vers son écran « Traductions ».
 */
@Component({
  selector: 'app-carte-langues',
  imports: [
    TranslocoPipe,
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
    MessageErreur,
    EtatEnregistrementIndicateur,
  ],
  template: `
    @if (store.sondage(); as s) {
      <section class="carte-langues" aria-labelledby="titre-langues-editeur">
        <div class="ligne-entete">
          <h2 id="titre-langues-editeur" class="titre-carte">{{ 'editeur.langues.titre' | transloco }}</h2>
          <span class="espace"></span>
          @if (store.modifiable() && etat(); as e) {
            <app-etat-enregistrement [etat]="e" />
          }
        </div>
        <p class="texte-aide">{{ 'editeur.langues.aide' | transloco }}</p>

        @if (store.modifiable()) {
          <div class="reglages">
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="champ-principale">
              <mat-label>{{ 'editeur.langues.principale' | transloco }}</mat-label>
              <mat-select [value]="principale()" (selectionChange)="changerPrincipale($event.value)">
                @for (l of langues; track l) {
                  <mat-option [value]="l">{{ nomLangue(l) }}</mat-option>
                }
              </mat-select>
              <mat-hint>{{ 'editeur.langues.principaleAide' | transloco }}</mat-hint>
            </mat-form-field>
            <fieldset class="supplementaires">
              <legend>{{ 'editeur.langues.supplementaires' | transloco: { max: max } }}</legend>
              @for (l of autres(); track l) {
                <mat-checkbox [checked]="supplementaires().includes(l)" (change)="basculer(l, $event.checked)">
                  {{ nomLangue(l) }}
                </mat-checkbox>
              }
            </fieldset>
          </div>
        } @else {
          <p>
            {{ 'editeur.langues.resumePrincipale' | transloco: { langue: nomLangue(principale()) } }}
            @if (supplementaires().length) {
              <br />{{ 'editeur.langues.resumeSupplementaires' | transloco: { langues: nomsSupplementaires() } }}
            }
          </p>
        }
        <app-message-erreur [erreur]="erreur()" [parDefaut]="'editeur.langues.erreur' | transloco" />

        @if (supplementaires().length) {
          <ul class="traductions">
            @for (l of supplementaires(); track l) {
              <li>
                <span class="langue">{{ nomLangue(l) }}</span>
                @if (completude(l); as c) {
                  <span class="etat-traduction" [class.complet]="c.complet">
                    {{ (c.complet ? 'editeur.langues.complet' : 'editeur.langues.progression') | transloco: { traduits: c.traduits, total: c.total } }}
                  </span>
                }
                <a matButton="outlined" [routerLink]="['/sondages', s.id, 'traductions', l]">
                  <mat-icon fontIcon="translate" aria-hidden="true" />{{ (store.modifiable() ? 'editeur.langues.traduire' : 'editeur.langues.voir') | transloco }}
                </a>
              </li>
            }
          </ul>
        }
      </section>
    }
  `,
  styles: `
    .carte-langues {
      display: flex;
      flex-direction: column;
      gap: var(--bt-espace-2);
      padding: var(--bt-espace-4);
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--bt-rayon);
      background: var(--mat-sys-surface);
    }

    .titre-carte {
      margin: 0;
      font: var(--mat-sys-title-medium);
    }

    .ligne-entete {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--bt-espace-2) var(--bt-espace-3);

      .espace {
        flex: 1;
      }
    }

    .texte-aide {
      margin: 0;
    }

    .reglages {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: var(--bt-espace-3) var(--bt-espace-4);
    }

    .champ-principale {
      flex: 1 1 220px;
      max-width: 320px;
    }

    .supplementaires {
      display: flex;
      flex-wrap: wrap;
      gap: var(--bt-espace-1) var(--bt-espace-3);
      margin: 0;
      padding: 0;
      border: 0;

      legend {
        padding: 0;
        margin-block-end: var(--bt-espace-1);
        font: var(--mat-sys-label-large);
      }
    }

    .traductions {
      display: flex;
      flex-direction: column;
      gap: var(--bt-espace-2);
      margin: var(--bt-espace-3) 0 0;
      padding: 0;
      list-style: none;

      li {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--bt-espace-2) var(--bt-espace-3);
      }
    }

    .langue {
      min-width: 6em;
      font: var(--mat-sys-title-small);
    }

    .etat-traduction {
      flex: 1;
      color: var(--bt-avertissement-texte, var(--mat-sys-on-surface-variant));

      &.complet {
        color: var(--bt-succes-texte);
      }
    }

    .mat-icon {
      margin-inline-end: var(--bt-espace-1);
      vertical-align: middle;
    }
  `,
})
export class CarteLangues {
  protected readonly store = inject(EditeurSondageStore);
  private readonly service = inject(TraductionService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly langues = LANGUES_CONTENU;
  protected readonly max = LANGUES_SUPPLEMENTAIRES_MAX;
  protected readonly nomLangue = (l: LangueContenu) => LIBELLES_LANGUE[l];

  protected readonly principale = computed<LangueContenu>(() => this.store.sondage()?.languePrincipale ?? 'fr');
  protected readonly supplementaires = computed<LangueContenu[]>(() =>
    (this.store.sondage()?.languesSupplementaires ?? []).filter((l) => l !== this.principale()),
  );
  protected readonly autres = computed(() => LANGUES_CONTENU.filter((l) => l !== this.principale()));
  protected readonly nomsSupplementaires = computed(() => this.supplementaires().map(this.nomLangue).join(', '));

  protected readonly etat = signal<EtatEnregistrement | null>(null);
  protected readonly erreur = signal<unknown>(null);
  private readonly completudes = signal<readonly CompletudeLangueResponse[]>([]);
  private readonly relire = new Subject<number>();

  constructor() {
    this.relire
      .pipe(
        debounceTime(DELAI_COMPLETUDE_MS),
        switchMap((id) => this.service.completude(id).pipe(catchError(() => of([] as CompletudeLangueResponse[])))),
        takeUntilDestroyed(),
      )
      .subscribe((c) => this.completudes.set(c));
    // Chaque écriture renvoie le sondage : un texte principal modifié peut perdre ses traductions.
    effect(() => {
      const sondage = this.store.sondage();
      if (sondage && (sondage.languesSupplementaires ?? []).length) {
        untracked(() => this.relire.next(sondage.id));
      }
    });
  }

  protected completude(langue: LangueContenu): CompletudeLangueResponse | undefined {
    return this.completudes().find((c) => c.langue === langue);
  }

  /** La nouvelle principale sort des supplémentaires (le backend refuse une principale répétée). */
  protected changerPrincipale(langue: LangueContenu): void {
    this.envoyer(langue, this.supplementaires().filter((l) => l !== langue));
  }

  protected basculer(langue: LangueContenu, coche: boolean): void {
    const actuelles = this.supplementaires().filter((l) => l !== langue);
    const suivantes = coche ? [...actuelles, langue] : actuelles;
    // Ordre stable (celui de LANGUES_CONTENU), au plus deux.
    this.envoyer(
      this.principale(),
      LANGUES_CONTENU.filter((l) => suivantes.includes(l)).slice(0, LANGUES_SUPPLEMENTAIRES_MAX),
    );
  }

  private envoyer(languePrincipale: LangueContenu, languesSupplementaires: LangueContenu[]): void {
    this.etat.set('enregistrement');
    this.erreur.set(null);
    this.store
      .definirLangues({ languePrincipale, languesSupplementaires })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.etat.set('enregistre'),
        error: (erreur: unknown) => {
          this.etat.set('erreur');
          this.erreur.set(erreur);
        },
      });
  }
}
