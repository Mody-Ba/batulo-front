import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AdminDetailResponse } from '../../../../core/models/super-admin.model';
import { UtilisateurResponse } from '../../../../core/models/utilisateur.model';
import { SuperAdminService } from '../../../../core/services/super-admin.service';
import { nonVide } from '../../../../core/utils/validateurs';
import { MessageErreur } from '../../../../shared/components/message-erreur/message-erreur';

export interface DonneesDialogueAdmin {
  /** Absent : création. */
  admin?: UtilisateurResponse;
}

/**
 * Création ou modification d'un admin et du nom de son entreprise. La requête part depuis la boîte :
 * une erreur (409 courriel déjà utilisé) s'affiche sans perdre la saisie. À la création, le nom de
 * l'entreprise est facultatif (« Entreprise de Prénom Nom » par défaut) ; à la modification, il est obligatoire.
 */
@Component({
  selector: 'app-dialogue-admin',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MessageErreur,
  ],
  templateUrl: './dialogue-admin.html',
})
export class DialogueAdmin {
  private readonly service = inject(SuperAdminService);
  private readonly reference = inject<MatDialogRef<DialogueAdmin, AdminDetailResponse>>(MatDialogRef);
  protected readonly admin = inject<DonneesDialogueAdmin>(MAT_DIALOG_DATA).admin;

  protected readonly formulaire = inject(NonNullableFormBuilder).group({
    prenom: [this.admin?.prenom ?? '', [Validators.required, nonVide, Validators.maxLength(100)]],
    nom: [this.admin?.nom ?? '', [Validators.required, nonVide, Validators.maxLength(100)]],
    courriel: [
      this.admin?.courriel ?? '',
      [Validators.required, nonVide, Validators.email, Validators.maxLength(255)],
    ],
    nomEntreprise: [
      this.admin?.entreprise ?? '',
      this.admin ? [Validators.required, nonVide, Validators.maxLength(150)] : [Validators.maxLength(150)],
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
    const identite = {
      prenom: valeurs.prenom.trim(),
      nom: valeurs.nom.trim(),
      courriel: valeurs.courriel.trim(),
    };
    const nomEntreprise = valeurs.nomEntreprise.trim();
    this.enCours.set(true);
    this.erreur.set(null);
    this.reference.disableClose = true;

    const requete = this.admin
      ? this.service.modifierAdmin(this.admin.id, { ...identite, nomEntreprise })
      : this.service.creerAdmin({ ...identite, nomEntreprise: nomEntreprise || null });
    requete.subscribe({
      next: (detail) => this.reference.close(detail),
      error: (erreur: unknown) => {
        this.enCours.set(false);
        this.reference.disableClose = false;
        this.erreur.set(erreur);
      },
    });
  }
}
