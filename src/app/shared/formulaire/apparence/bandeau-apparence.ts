import { Component, computed, effect, input, signal } from '@angular/core';
import { ApparenceResponse } from '../../../core/models/personnalisation.model';
import { urlLogoSure } from './apparence';
import { traduire } from '../../../core/i18n/traduire';

/**
 * Bandeau à l'image de l'entreprise, en haut du formulaire public et de l'aperçu : seulement s'il y a un logo (sans
 * logo, l'apparence actuelle ne change pas ; le nom affiché ne se distingue pas encore du nom de l'entreprise).
 * Logo : texte alternatif = nom affiché (le nom écrit à côté est donc caché aux lecteurs d'écran), taille limitée.
 */
@Component({
  selector: 'app-bandeau-apparence',
  template: `
    @if (logo(); as url) {
      @if (!illisible()) {
        <div class="bandeau-apparence">
          <img [src]="url" [alt]="nom()" class="logo-apparence" decoding="async" (error)="illisible.set(true)" />
          <span class="nom-apparence" aria-hidden="true" dir="auto">{{ nom() }}</span>
        </div>
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .bandeau-apparence {
      display: flex;
      align-items: center;
      gap: var(--bt-espace-3);
      min-width: 0;
      margin-bottom: var(--bt-espace-3);
    }

    .logo-apparence {
      display: block;
      flex: none;
      width: auto;
      height: auto;
      max-width: min(60%, 220px);
      max-height: 56px;
      object-fit: contain;
    }

    .nom-apparence {
      min-width: 0;
      overflow-wrap: anywhere;
      font: var(--mat-sys-title-medium);
    }
  `,
})
export class BandeauApparence {
  readonly apparence = input<Pick<ApparenceResponse, 'nomAffiche' | 'logoUrl'> | null | undefined>(null);
  protected readonly logo = computed(() => urlLogoSure(this.apparence()?.logoUrl));
  protected readonly nom = computed(() => this.apparence()?.nomAffiche?.trim() || traduire('public.apparence.logo'));
  /** Image introuvable ou illisible : pas d'icône cassée devant le répondant, le bandeau est retiré. */
  protected readonly illisible = signal(false);

  constructor() {
    effect(() => {
      this.logo();
      this.illisible.set(false);
    });
  }
}
