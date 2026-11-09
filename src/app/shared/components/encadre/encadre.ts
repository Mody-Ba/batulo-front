import { Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

export type TypeEncadre = 'info' | 'succes' | 'avertissement' | 'erreur';

const ICONES: Record<TypeEncadre, string> = {
  info: 'info',
  succes: 'check_circle',
  avertissement: 'warning',
  erreur: 'error',
};

/**
 * Encadre de message : icone + texte projete. Le role ARIA se pose sur l'element lui-meme
 * quand le message doit etre annonce (<app-encadre type="erreur" role="alert">).
 * L'icone est decorative : le type est toujours exprime par le texte.
 */
@Component({
  selector: 'app-encadre',
  imports: [MatIconModule],
  templateUrl: './encadre.html',
  styleUrl: './encadre.scss',
  host: {
    class: 'encadre',
    '[class.encadre-info]': "type() === 'info'",
    '[class.encadre-succes]': "type() === 'succes'",
    '[class.encadre-avertissement]': "type() === 'avertissement'",
    '[class.encadre-erreur]': "type() === 'erreur'",
  },
})
export class Encadre {
  readonly type = input<TypeEncadre>('info');
  readonly titre = input<string | null>(null);
  /** Remplace l'icone associee au type. */
  readonly icone = input<string | null>(null);

  protected readonly nomIcone = computed(() => this.icone() ?? ICONES[this.type()]);
}
