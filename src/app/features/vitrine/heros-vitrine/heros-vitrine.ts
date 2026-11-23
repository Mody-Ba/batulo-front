import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

/** Héros de la vitrine : accroche, boutons, illustration en HTML/CSS (sans image ni bibliothèque, décorative). */
@Component({
  selector: 'app-heros-vitrine',
  imports: [TranslocoPipe, RouterLink],
  template: `
    <section class="heros" aria-labelledby="titre-vitrine">
      <div class="texte">
        <p class="sur-titre">{{ 'vitrine.heros.surTitre' | transloco }}</p>
        <h1 id="titre-vitrine" tabindex="-1">{{ 'vitrine.heros.titre' | transloco }}</h1>
        <p class="sous-titre">{{ 'vitrine.heros.sousTitre' | transloco }}</p>
        <div class="actions">
          <a class="bouton plein" routerLink="/inscription">{{ 'vitrine.commencer' | transloco }}</a>
          <a class="bouton contour" routerLink="/connexion">{{ 'auth.connexion.seConnecter' | transloco }}</a>
        </div>
      </div>

      <div class="illustration" aria-hidden="true">
        <div class="carte formulaire">
          <span class="ligne titre"></span>
          <span class="choix coche"><span class="rond"></span><span class="ligne"></span></span>
          <span class="choix"><span class="rond"></span><span class="ligne courte"></span></span>
          <span class="choix"><span class="rond"></span><span class="ligne"></span></span>
          <span class="bouton-faux">{{ 'vitrine.heros.envoyer' | transloco }}</span>
        </div>
        <div class="carte resultats">
          <span class="ligne titre"></span>
          <span class="barre" style="--v: 82%"></span>
          <span class="barre" style="--v: 56%"></span>
          <span class="barre" style="--v: 34%"></span>
        </div>
      </div>
    </section>
  `,
  styleUrl: './heros-vitrine.scss',
})
export class HerosVitrine {}
