import { Component, computed, input, output, signal } from '@angular/core';
import { PageAccueil } from '../../../core/models/sondage.model';

/** Ce qu'affiche la page d'accueil : en-tête du sondage et textes d'accueil. */
export interface ContenuAccueil extends PageAccueil {
  titre: string;
  description: string | null;
}

/** Brouillon à reprendre (section où le répondant s'était arrêté). */
export interface RepriseBrouillon {
  section: number;
  nombreSections: number;
}

/** « Commencer » ou « Reprendre » : consentement donné à cette visite (toujours true s'il est exigé). */
export interface DepartQuestionnaire {
  consentement: boolean;
  reprendre: boolean;
}

/**
 * Page d'accueil du formulaire du répondant (formulaire public F6, aperçu F5b) : titre, description, objet de
 * l'enquête, confidentialité, case de consentement si exigée. « Commencer le questionnaire » reste désactivé tant que la
 * case n'est pas cochée ; avec un brouillon, « Reprendre » (la case est à recocher) ou « Recommencer à zéro ».
 * Éléments natifs, sans Angular Material (formulaire public léger).
 */
@Component({
  selector: 'app-accueil-sondage',
  templateUrl: './accueil-sondage.html',
  styleUrl: './accueil-sondage.scss',
})
export class AccueilSondage {
  readonly contenu = input.required<ContenuAccueil>();
  /** 1 : page publique (titre de la page) ; 2 : aperçu (sous le titre « Aperçu »). */
  readonly niveauTitre = input<1 | 2>(1);
  readonly mode = input<'apercu' | 'reponse'>('reponse');
  readonly reprise = input<RepriseBrouillon | null>(null);
  /** Refus du serveur à l'envoi (consentement manquant) : affiché en haut. */
  readonly erreur = input<string | null>(null);

  /** reprendre false avec un brouillon (« Recommencer à zéro ») : la page l'efface. */
  readonly commencer = output<DepartQuestionnaire>();

  protected readonly coche = signal(false);
  protected readonly bloque = computed(() => !!this.contenu().consentementRequis && !this.coche());
  protected readonly objet = computed(() => this.contenu().objetEnquete?.trim() || null);
  protected readonly confidentialite = computed(() => this.contenu().texteConfidentialite?.trim() || null);

  protected cocher(evenement: Event): void {
    this.coche.set((evenement.target as HTMLInputElement).checked);
  }

  protected demarrer(reprendre: boolean): void {
    if (this.bloque()) {
      return;
    }
    this.commencer.emit({ consentement: !!this.contenu().consentementRequis && this.coche(), reprendre });
  }

  /** Nouvelle visite (collecte terrain, aperçu recommencé) : case décochée. */
  reinitialiser(): void {
    this.coche.set(false);
  }
}
