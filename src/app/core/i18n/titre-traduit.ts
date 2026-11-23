import { effect, inject, Injectable, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { traduireSiConnu } from './traduire';

/**
 * Titres de page traduits : le `title` des routes est une clé (« titres.connexion » -> « Connexion · Batulo »),
 * réappliquée au changement de langue. Un titre qui n'est pas une clé est affiché tel quel. Une page peut imposer le
 * sien (`personnaliser`, ex. titre du sondage), recalculé lui aussi au changement de langue, jusqu'à la navigation
 * suivante.
 */
@Injectable({ providedIn: 'root' })
export class TitreTraduit extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly cle = signal<string | undefined>(undefined);
  private readonly personnalise = signal<(() => string) | null>(null);

  constructor() {
    super();
    effect(() => {
      const titre = this.titreCourant();
      if (titre !== null) {
        this.title.setTitle(titre);
      }
    });
  }

  override updateTitle(etat: RouterStateSnapshot): void {
    this.personnalise.set(null);
    this.cle.set(this.buildTitle(etat));
    const titre = this.titreCourant();
    if (titre !== null) {
      this.title.setTitle(titre);
    }
  }

  /** Titre propre à la page affichée (fonction : relue au changement de langue). */
  personnaliser(titre: () => string): void {
    this.personnalise.set(titre);
    this.title.setTitle(titre());
  }

  private titreCourant(): string | null {
    const personnalise = this.personnalise();
    if (personnalise) {
      return personnalise();
    }
    const cle = this.cle();
    return cle === undefined ? null : (traduireSiConnu(cle) ?? cle);
  }
}
