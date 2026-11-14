import { Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { CritereResponse, FiltresStatistiques, GranulariteDate } from '../../../core/models/statistiques.model';
import { decouperCritere, filtresActifs } from './filtres-url';

/** Filtre actif, affiché en pastille retirable (« Région = Kayes »). */
interface Pastille {
  critere: string;
  texte: string;
}

/**
 * Filtres des statistiques, sur une ligne au-dessus des résultats : portée (cette version ou toutes), période,
 * critères d'analyse (plusieurs valeurs d'un critère : OU ; plusieurs critères : ET) et granularité des dates.
 * Chaque changement émet les nouveaux filtres ; le parent les met dans l'URL.
 */
@Component({
  selector: 'app-filtres-statistiques',
  imports: [MatButtonModule, MatButtonToggleModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule],
  templateUrl: './filtres-statistiques.html',
  styleUrl: './filtres-statistiques.scss',
})
export class FiltresStatistiquesComposant {
  readonly filtres = input.required<FiltresStatistiques>();
  readonly criteres = input.required<CritereResponse[]>();
  readonly version = input.required<number>();
  /** Une seule version : la portée « toutes les versions » ne change rien, elle est masquée. */
  readonly plusieursVersions = input(true);
  readonly changer = output<FiltresStatistiques>();

  protected readonly actifs = computed(() => filtresActifs(this.filtres()));

  protected readonly pastilles = computed<Pastille[]>(() =>
    this.filtres().criteres.map((critere) => {
      const [cle, valeur] = decouperCritere(critere);
      const def = this.criteres().find((c) => c.cle === cle);
      const libelleValeur = def?.valeurs.find((v) => v.valeur === valeur)?.libelle ?? valeur;
      return { critere, texte: `${def?.libelle ?? cle} = ${libelleValeur}` };
    }),
  );

  /** Valeurs choisies pour un critère. */
  protected valeursChoisies(cle: string): string[] {
    return this.filtres()
      .criteres.map(decouperCritere)
      .filter(([c]) => c === cle)
      .map(([, v]) => v);
  }

  protected changerPortee(lignee: boolean): void {
    // Les valeurs de critères peuvent différer selon la portée : on garde les filtres, le serveur les applique.
    this.changer.emit({ ...this.filtres(), lignee });
  }

  protected changerDate(champ: 'du' | 'au', valeur: string): void {
    this.changer.emit({ ...this.filtres(), [champ]: valeur || null });
  }

  protected changerGranularite(granularite: GranulariteDate | null): void {
    this.changer.emit({ ...this.filtres(), granularite });
  }

  protected changerCritere(cle: string, valeurs: string[]): void {
    const autres = this.filtres().criteres.filter((c) => decouperCritere(c)[0] !== cle);
    this.changer.emit({ ...this.filtres(), criteres: [...autres, ...valeurs.map((v) => `${cle}:${v}`)] });
  }

  protected retirer(critere: string): void {
    this.changer.emit({ ...this.filtres(), criteres: this.filtres().criteres.filter((c) => c !== critere) });
  }

  protected toutEffacer(): void {
    this.changer.emit({ lignee: false, du: null, au: null, granularite: null, criteres: [] });
  }
}
