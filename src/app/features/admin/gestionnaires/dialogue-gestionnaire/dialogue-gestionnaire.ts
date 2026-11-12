import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { GestionnaireResponse } from '../../../../core/models/gestionnaire.model';
import { GestionnaireService } from '../../../../core/services/gestionnaire.service';
import { nonVide } from '../../../../core/utils/validateurs';
import { MessageErreur } from '../../../../shared/components/message-erreur/message-erreur';

export interface DonneesDialogueGestionnaire {
  /** Absent : création. */
  gestionnaire?: GestionnaireResponse;
}

/**
 * Création ou modification d'un gestionnaire (prénom, nom, courriel). La requête part depuis la
 * boîte : une erreur (409 courriel déjà utilisé) s'affiche sans perdre la saisie.
 */
@Component({
  selector: 'app-dialogue-gestionnaire',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MessageErreur,
  ],
  templateUrl: './dialogue-gestionnaire.html',
})
export class DialogueGestionnaire {
  private readonly service = inject(GestionnaireService);
  private readonly reference = inject<MatDialogRef<DialogueGestionnaire, GestionnaireResponse>>(MatDialogRef);
  protected readonly gestionnaire = inject<DonneesDialogueGestionnaire>(MAT_DIALOG_DATA).gestionnaire;

  protected readonly formulaire = inject(NonNullableFormBuilder).group({
    prenom: [this.gestionnaire?.prenom ?? '', [Validators.required, nonVide, Validators.maxLength(100)]],
    nom: [this.gestionnaire?.nom ?? '', [Validators.required, nonVide, Validators.maxLength(100)]],
    courriel: [
      this.gestionnaire?.courriel ?? '',
      [Validators.required, nonVide, Validators.email, Validators.maxLength(255)],
    ],
  });

  protected readonly enCours = signal(false);
  protected readonly erreur = signal<unknown>(null);

  protected enregistrer(): void {
    if (this.formulaire.invalid || this.enCours()) {
      this.formulaire.markAllAsTouched();
      return;
    }
    const valeurs = this.formulaire.getRawValue();
    const demande = {
      prenom: valeurs.prenom.trim(),
      nom: valeurs.nom.trim(),
      courriel: valeurs.courriel.trim(),
    };
    this.enCours.set(true);
    this.erreur.set(null);
    this.reference.disableClose = true;

    const requete = this.gestionnaire
      ? this.service.modifier(this.gestionnaire.id, demande)
      : this.service.creer(demande);
    requete.subscribe({
      next: (gestionnaire) => this.reference.close(gestionnaire),
      error: (erreur: unknown) => {
        this.enCours.set(false);
        this.reference.disableClose = false;
        this.erreur.set(erreur);
      },
    });
  }
}
