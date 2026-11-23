import { Component, effect, input, signal } from '@angular/core';
import { traduire } from '../../../../core/i18n/traduire';
import { TranslocoPipe } from '@jsverse/transloco';

interface CodeQrDessine {
  taille: number;
  chemin: string;
}

/** Tracé SVG d'une grille de modules (un carré par module noir). */
export function cheminQr(modules: readonly (readonly boolean[])[]): string {
  let chemin = '';
  modules.forEach((ligne, y) =>
    ligne.forEach((noir, x) => {
      if (noir) {
        chemin += `M${x} ${y}h1v1h-1z`;
      }
    }),
  );
  return chemin;
}

/**
 * Code QR d'un texte, dessiné en SVG (sans innerHTML) à partir de la grille d'uqr. La bibliothèque est chargée à la
 * demande (import dynamique) : elle n'entre que dans la page qui l'affiche. Toujours noir sur blanc, avec une marge de
 * 4 modules, pour être lu par tous les téléphones, même en thème sombre.
 */
@Component({
  selector: 'app-code-qr',
  imports: [TranslocoPipe],
  template: `
    @if (dessin(); as qr) {
      <svg
        [attr.viewBox]="'0 0 ' + qr.taille + ' ' + qr.taille"
        role="img"
        [attr.aria-label]="libelle()"
        shape-rendering="crispEdges"
      >
        <rect [attr.width]="qr.taille" [attr.height]="qr.taille" fill="#fff" />
        <path [attr.d]="qr.chemin" fill="#000" />
      </svg>
    } @else if (echec()) {
      <p class="echec" role="alert">{{ 'abonnement.mobile.qrEchec' | transloco }}</p>
    } @else {
      <div class="attente" role="status" [attr.aria-label]="'abonnement.mobile.qrPreparation' | transloco"></div>
    }
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      max-width: 240px;
    }

    svg,
    .attente {
      display: block;
      width: 100%;
      aspect-ratio: 1;
      border-radius: 8px;
    }

    .attente {
      background: var(--mat-sys-surface-container-high);
    }

    .echec {
      margin: 0;
      color: var(--mat-sys-error);
    }
  `,
})
export class CodeQr {
  readonly texte = input.required<string>();
  readonly libelle = input(traduire('abonnement.mobile.codeQr'));

  protected readonly dessin = signal<CodeQrDessine | null>(null);
  protected readonly echec = signal(false);

  constructor() {
    effect(() => {
      const texte = this.texte();
      this.dessin.set(null);
      this.echec.set(false);
      import('uqr')
        .then(({ encode }) => {
          if (texte !== this.texte()) {
            return;
          }
          const qr = encode(texte, { ecc: 'M', border: 4 });
          this.dessin.set({ taille: qr.size, chemin: cheminQr(qr.data) });
        })
        .catch(() => this.echec.set(true));
    });
  }
}
