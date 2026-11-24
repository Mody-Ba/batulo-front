import { Component, computed, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { PlurielPipe } from '../../../core/i18n/formats.pipes';
import { LangueContenu, LIBELLES_LANGUE, TexteManquant } from '../../../core/models/traduction.model';
import { corpsErreur, aLeCode } from '../../../core/utils/erreur-http';

/** Textes manquants d'une langue. */
export interface ManquantsLangue {
  langue: LangueContenu;
  textes: TexteManquant[];
}

/** 400 TRADUCTIONS_INCOMPLETES : textes non traduits groupés par langue, dans l'ordre reçu ; null pour une autre erreur. */
export function manquantsParLangue(erreur: unknown): ManquantsLangue[] | null {
  if (!aLeCode(erreur, 'TRADUCTIONS_INCOMPLETES')) {
    return null;
  }
  const groupes: ManquantsLangue[] = [];
  for (const texte of corpsErreur(erreur)?.manquants ?? []) {
    let groupe = groupes.find((g) => g.langue === texte.langue);
    if (!groupe) {
      groupe = { langue: texte.langue, textes: [] };
      groupes.push(groupe);
    }
    groupe.textes.push(texte);
  }
  return groupes;
}

/** Nombre de textes montrés par langue (le reste est résumé). */
const APERCU_MAX = 8;

/**
 * Publication refusée faute de traductions : pour chaque langue, les textes manquants (texte principal) et un lien
 * vers son écran « Traductions », filtré sur les textes manquants. Le lien ferme la boîte de dialogue.
 */
@Component({
  selector: 'app-textes-manquants',
  imports: [TranslocoPipe, PlurielPipe, RouterLink, MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <div class="textes-manquants" role="alert">
      <p class="titre">{{ 'sondages.publication.traductionsIncompletes' | transloco }}</p>
      @for (g of groupes(); track g.langue) {
        <section class="langue" [attr.aria-label]="nomLangue(g.langue)">
          <p class="entete-langue">
            <strong>{{ nomLangue(g.langue) }}</strong> ·
            {{ 'sondages.publication.textesManquants' | pluriel: g.textes.length }}
          </p>
          <ul>
            @for (t of g.textes.slice(0, apercuMax); track t.cle) {
              <li dir="auto">{{ t.source }}</li>
            }
          </ul>
          @if (g.textes.length > apercuMax) {
            <p class="reste">{{ 'sondages.publication.etAutres' | pluriel: g.textes.length - apercuMax }}</p>
          }
          <a
            matButton="outlined"
            mat-dialog-close
            [routerLink]="['/sondages', sondageId(), 'traductions', g.langue]"
            [queryParams]="{ manquants: 'true' }"
          >
            <mat-icon fontIcon="translate" aria-hidden="true" />{{ 'sondages.publication.completer' | transloco: { langue: nomLangue(g.langue) } }}
          </a>
        </section>
      }
    </div>
  `,
  styles: `
    .textes-manquants {
      display: flex;
      flex-direction: column;
      gap: var(--bt-espace-3);
      padding: var(--bt-espace-3);
      border: 1px solid var(--mat-sys-error);
      border-radius: var(--bt-rayon);
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }

    .titre,
    .entete-langue,
    .reste {
      margin: 0;
    }

    ul {
      margin: var(--bt-espace-1) 0;
      padding-inline-start: var(--bt-espace-4);
    }

    li {
      overflow-wrap: anywhere;
    }

    .mat-icon {
      margin-inline-end: var(--bt-espace-1);
      vertical-align: middle;
    }
  `,
})
export class TextesManquants {
  readonly sondageId = input.required<number>();
  readonly erreur = input<unknown>(null);
  protected readonly apercuMax = APERCU_MAX;
  protected readonly nomLangue = (l: LangueContenu) => LIBELLES_LANGUE[l];
  protected readonly groupes = computed(() => manquantsParLangue(this.erreur()) ?? []);
}
