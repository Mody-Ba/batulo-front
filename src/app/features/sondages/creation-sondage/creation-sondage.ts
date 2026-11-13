import { TextFieldModule } from '@angular/cdk/text-field';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { CreationSondageRequest, FormulaireResponse } from '../../../core/models/sondage.model';
import { AuthService, MESSAGE_LECTURE_SEULE } from '../../../core/services/auth.service';
import { SondageService } from '../../../core/services/sondage.service';
import { REGLES_SONDAGE } from '../../../core/utils/regles-question';
import { nonVide } from '../../../core/utils/validateurs';
import { Encadre } from '../../../shared/components/encadre/encadre';
import { EntetePage } from '../../../shared/components/entete-page/entete-page';
import { MessageErreur } from '../../../shared/components/message-erreur/message-erreur';
import { MESSAGE_SANS_PERMISSION } from '../droits-sondage';
import { ChoixFormulaire } from './choix-formulaire/choix-formulaire';

export type ModeCreation = 'vide' | 'source';

/**
 * Création d'un sondage : vide (titre, description, réponse unique), ou à partir d'un formulaire de l'entreprise
 * dont les sections, questions et options sont copiées (description et réponse unique reprises si on ne les donne
 * pas). On arrive ensuite dans l'éditeur du brouillon.
 */
@Component({
  selector: 'app-creation-sondage',
  imports: [
    TextFieldModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    Encadre,
    EntetePage,
    MessageErreur,
    ChoixFormulaire,
  ],
  templateUrl: './creation-sondage.html',
  styleUrl: './creation-sondage.scss',
})
export class CreationSondage {
  private readonly service = inject(SondageService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  protected readonly regles = REGLES_SONDAGE;

  /** Pourquoi la création est impossible (affichage seulement : le serveur décide). */
  protected readonly interdit = computed(() => {
    if (this.auth.lectureSeule()) {
      return MESSAGE_LECTURE_SEULE;
    }
    return this.auth.role() === 'GESTIONNAIRE' && !this.auth.utilisateur()?.peutCreerSondages
      ? MESSAGE_SANS_PERMISSION
      : null;
  });

  protected readonly mode = signal<ModeCreation>('vide');
  protected readonly source = signal<FormulaireResponse | null>(null);
  protected readonly enCours = signal(false);
  protected readonly erreur = signal<unknown>(null);
  /** Une source est requise en mode « à partir d'un formulaire » : signalée après une tentative. */
  protected readonly sourceManquante = signal(false);

  protected readonly formulaire = new FormGroup({
    titre: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, nonVide, Validators.maxLength(REGLES_SONDAGE.titreMax)],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(REGLES_SONDAGE.descriptionMax)],
    }),
    reponseUnique: new FormControl(true, { nonNullable: true }),
  });

  /** Titre proposé quand on choisit une source (tant que la personne n'a pas tapé le sien). */
  private titrePropose: string | null = null;

  constructor() {
    effect(() => {
      const source = this.source();
      if (!source) {
        return;
      }
      this.sourceManquante.set(false);
      const titre = this.formulaire.controls.titre;
      if (!titre.value.trim() || titre.value === this.titrePropose) {
        this.titrePropose = `${source.titre} (copie)`.slice(0, REGLES_SONDAGE.titreMax);
        titre.setValue(this.titrePropose);
      }
    });
  }

  protected changerMode(mode: ModeCreation): void {
    this.mode.set(mode);
    this.erreur.set(null);
  }

  protected creer(): void {
    if (this.enCours() || this.interdit()) {
      return;
    }
    const source = this.mode() === 'source' ? this.source() : null;
    if (this.mode() === 'source' && !source) {
      this.sourceManquante.set(true);
    }
    if (this.formulaire.invalid || (this.mode() === 'source' && !source)) {
      this.formulaire.markAllAsTouched();
      return;
    }
    const { titre, description, reponseUnique } = this.formulaire.getRawValue();
    const demande: CreationSondageRequest = source
      ? // Description et réponse unique de la source sont reprises si on ne les donne pas.
        { titre: titre.trim(), description: description.trim() || null, sondageSourceId: source.id }
      : { titre: titre.trim(), description: description.trim() || null, reponseUnique };
    this.enCours.set(true);
    this.erreur.set(null);
    this.service.creer(demande).subscribe({
      next: (sondage) => void this.router.navigate(['/sondages', sondage.id, 'modifier']),
      error: (erreur: unknown) => {
        this.enCours.set(false);
        this.erreur.set(erreur);
      },
    });
  }
}
