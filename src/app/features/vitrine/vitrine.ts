import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, ElementRef, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BarreVitrine } from './barre-vitrine/barre-vitrine';
import { ANNEE_COPYRIGHT, COURRIEL_CONTACT, ETAPES, FAQ, FONCTIONNALITES } from './contenu-vitrine';
import { HerosVitrine } from './heros-vitrine/heros-vitrine';
import { TarifsVitrine } from './tarifs-vitrine/tarifs-vitrine';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * Vitrine publique de Batulo (« / » pour un visiteur ; un compte connecté est renvoyé vers son accueil par
 * inviteGuard). Chargée à la demande, en éléments natifs (sans Angular Material), couleurs du thème.
 * Les liens de la barre font défiler jusqu'à la section et y placent le focus, sans changer de route.
 */
@Component({
  selector: 'app-vitrine',
  imports: [TranslocoPipe, RouterLink, BarreVitrine, HerosVitrine, TarifsVitrine],
  templateUrl: './vitrine.html',
  styleUrl: './vitrine.scss',
})
export class Vitrine {
  private readonly hote = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  protected readonly fonctionnalites = FONCTIONNALITES;
  protected readonly etapes = ETAPES;
  protected readonly faq = FAQ;
  protected readonly courriel = COURRIEL_CONTACT;
  protected readonly annee = ANNEE_COPYRIGHT;

  constructor() {
    // Lien partagé vers une section (/#tarifs) : on y va une fois la page affichée.
    afterNextRender(() => {
      const ancre = this.document.location?.hash?.slice(1);
      if (ancre) {
        this.aller(ancre, false);
      }
    });
  }

  /** Défilement jusqu'à la section (doux, sauf si l'utilisateur réduit les animations) et focus sur son titre. */
  aller(id: string, animer = true): void {
    const cible = this.hote.nativeElement.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    if (!cible) {
      return;
    }
    const reduit = this.document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;
    cible.scrollIntoView?.({ behavior: animer && !reduit ? 'smooth' : 'auto', block: 'start' });
    cible.querySelector<HTMLElement>('h1, h2')?.focus({ preventScroll: true });
  }

  /** Lien d'évitement : directement au contenu, sous la barre. */
  protected allerAuContenu(evenement: Event): void {
    evenement.preventDefault();
    this.aller('haut', false);
  }
}
