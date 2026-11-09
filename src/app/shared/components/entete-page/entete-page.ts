import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * En-tete de page : titre (h1), sous-titre facultatif et actions projetees a droite
 * (<app-entete-page titre="..."><a mat-flat-button>...</a></app-entete-page>).
 */
@Component({
  selector: 'app-entete-page',
  imports: [MatIconModule],
  templateUrl: './entete-page.html',
  styleUrl: './entete-page.scss',
})
export class EntetePage {
  readonly titre = input.required<string>();
  readonly sousTitre = input<string | null>(null);
  /** Nom d'une icone Material, decorative. */
  readonly icone = input<string | null>(null);
}
