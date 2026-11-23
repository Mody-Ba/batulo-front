import { Component, ElementRef, HostListener, inject, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SECTIONS_VITRINE } from '../contenu-vitrine';
import { SelecteurLangue } from '../../../shared/components/selecteur-langue/selecteur-langue';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * Barre du haut de la vitrine, collée en haut de l'écran : marque, liens vers les sections, « Connexion » et « Créer un
 * compte ». Sous 840 px, un bouton menu (aria-expanded) ouvre un panneau, fermé par Échap, un lien ou un clic ailleurs.
 */
@Component({
  selector: 'app-barre-vitrine',
  imports: [TranslocoPipe, SelecteurLangue, RouterLink],
  templateUrl: './barre-vitrine.html',
  styleUrl: './barre-vitrine.scss',
})
export class BarreVitrine {
  private readonly hote = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly sections = SECTIONS_VITRINE;

  /** Lien d'une section : la page fait défiler jusqu'à elle. */
  readonly aller = output<string>();

  protected readonly menuOuvert = signal(false);

  protected choisir(evenement: Event, id: string): void {
    evenement.preventDefault();
    this.menuOuvert.set(false);
    this.aller.emit(id);
  }

  protected basculer(): void {
    this.menuOuvert.update((ouvert) => !ouvert);
  }

  @HostListener('document:keydown.escape')
  protected fermerParEchap(): void {
    if (this.menuOuvert()) {
      this.menuOuvert.set(false);
      this.hote.nativeElement.querySelector<HTMLElement>('.bouton-menu')?.focus();
    }
  }

  @HostListener('document:click', ['$event'])
  protected fermerSiAilleurs(evenement: MouseEvent): void {
    if (this.menuOuvert() && !this.hote.nativeElement.contains(evenement.target as Node)) {
      this.menuOuvert.set(false);
    }
  }
}
