import { Component, computed, input } from '@angular/core';
import { variablesApparence } from '../../shared/formulaire/apparence/apparence';
import { BandeauApparence } from '../../shared/formulaire/apparence/bandeau-apparence';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * Aperçu en direct de l'en-tête du formulaire public : bandeau (logo et nom), bord du titre, barre de progression,
 * choix sélectionné et bouton principal aux couleurs choisies (variablesApparence, comme le vrai formulaire : rien
 * sans personnalisation). Éléments décoratifs (aucun bouton réel), décrits par un résumé.
 */
@Component({
  selector: 'app-apercu-apparence',
  imports: [TranslocoPipe, BandeauApparence],
  template: `
    <figure class="apercu-apparence" [style]="variables()">
      <div class="cadre-apercu">
        <app-bandeau-apparence [apparence]="{ nomAffiche: nom(), logoUrl: logoUrl() }" />
        <div class="entete-exemple" aria-hidden="true">
          <p class="titre-exemple">{{ 'apparence.apercuExemple.titre' | transloco }}</p>
          <p class="texte-exemple">{{ 'apparence.apercuExemple.texte' | transloco }}</p>
          <div class="progression-exemple"><span></span></div>
          <div class="choix-exemple">
            <span class="choisi">{{ 'apparence.apercuExemple.choisie' | transloco }}</span>
            <span>{{ 'apparence.apercuExemple.autre' | transloco }}</span>
          </div>
          <span class="bouton-exemple">{{ 'public.formulaire.suivant' | transloco }} <span class="fleche">→</span></span>
        </div>
      </div>
      <figcaption class="texte-aide">
        {{ logoUrl() ? ('apparence.apercuLegende.avecLogo' | transloco: { nom: nom() }) : ('apparence.apercuLegende.sansLogo' | transloco) }}
        {{
          variables()
            ? ('apparence.apercuLegende.couleur' | transloco: { couleur: couleur(), texte: ((couleurTexte() === '#000000' ? 'apparence.apercuLegende.noir' : 'apparence.apercuLegende.blanc') | transloco) })
            : ('apparence.apercuLegende.batulo' | transloco)
        }}
      </figcaption>
    </figure>
  `,
  styles: `
    .apercu-apparence {
      margin: 0;
    }

    .cadre-apercu {
      padding: var(--bt-espace-4);
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--bt-rayon);
      background: var(--mat-sys-surface-container-low);
    }

    .entete-exemple {
      display: flex;
      flex-direction: column;
      gap: var(--bt-espace-2);
      padding: var(--bt-espace-4);
      border-top: 8px solid var(--bt-marque);
      border-radius: 12px;
      background: var(--mat-sys-surface);

      p {
        margin: 0;
      }
    }

    .titre-exemple {
      font: var(--mat-sys-title-large);
    }

    .texte-exemple {
      color: var(--mat-sys-on-surface-variant);
    }

    .progression-exemple {
      height: 8px;
      border-radius: 4px;
      background: var(--mat-sys-surface-container-highest);

      span {
        display: block;
        width: 40%;
        height: 100%;
        border-radius: 4px;
        background: var(--bt-marque);
      }
    }

    .choix-exemple {
      display: flex;
      flex-wrap: wrap;
      gap: var(--bt-espace-2);

      span {
        padding: 6px 14px;
        border: 1px solid var(--mat-sys-outline);
        border-radius: 18px;
      }

      .choisi {
        border-color: var(--bt-marque);
        background: var(--bt-marque);
        color: var(--bt-sur-marque);
      }
    }

    .bouton-exemple {
      align-self: flex-end;
      padding: 12px 24px;
      border-radius: 24px;
      background: var(--bt-marque);
      color: var(--bt-sur-marque);
      font: var(--mat-sys-label-large);
    }

    figcaption {
      margin-top: var(--bt-espace-2);
    }
  `,
})
export class ApercuApparence {
  readonly nom = input('');
  readonly logoUrl = input<string | null>(null);
  readonly couleur = input('');
  readonly couleurTexte = input('');

  protected readonly variables = computed(() =>
    variablesApparence({ couleurPrincipale: this.couleur(), couleurTexte: this.couleurTexte() }),
  );
}
