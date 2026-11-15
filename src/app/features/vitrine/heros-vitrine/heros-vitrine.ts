import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Héros de la vitrine : accroche, boutons, illustration en HTML/CSS (sans image ni bibliothèque, décorative). */
@Component({
  selector: 'app-heros-vitrine',
  imports: [RouterLink],
  template: `
    <section class="heros" aria-labelledby="titre-vitrine">
      <div class="texte">
        <p class="sur-titre">Sondages et enquêtes terrain pour les entreprises</p>
        <h1 id="titre-vitrine" tabindex="-1">Créez vos sondages, partagez un lien, analysez les résultats.</h1>
        <p class="sous-titre">
          Batulo réunit la création des formulaires, la collecte en ligne ou sur le terrain et l’analyse des réponses,
          pour toute votre équipe.
        </p>
        <div class="actions">
          <a class="bouton plein" routerLink="/inscription">Commencer</a>
          <a class="bouton contour" routerLink="/connexion">Se connecter</a>
        </div>
      </div>

      <div class="illustration" aria-hidden="true">
        <div class="carte formulaire">
          <span class="ligne titre"></span>
          <span class="choix coche"><span class="rond"></span><span class="ligne"></span></span>
          <span class="choix"><span class="rond"></span><span class="ligne courte"></span></span>
          <span class="choix"><span class="rond"></span><span class="ligne"></span></span>
          <span class="bouton-faux">Envoyer</span>
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
