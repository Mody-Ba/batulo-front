import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import {
  AIDE_MOT_DE_PASSE,
  identiqueA,
  revaliderConfirmation,
  VALIDATEURS_NOUVEAU_MOT_DE_PASSE,
} from '../../../core/utils/validateurs';
import { Encadre } from '../../../shared/components/encadre/encadre';
import { MessageErreur } from '../../../shared/components/message-erreur/message-erreur';

/**
 * Changement du mot de passe : obligatoire après un mot de passe temporaire (les gardes y
 * renvoient), ou volontaire depuis le menu du compte.
 */
@Component({
  selector: 'app-changer-mot-de-passe',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    Encadre,
    MessageErreur,
  ],
  templateUrl: './changer-mot-de-passe.html',
  styleUrl: '../auth-formulaire.scss',
  host: { class: 'page-auth' },
})
export class ChangerMotDePasse {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly aideMotDePasse = AIDE_MOT_DE_PASSE;

  protected readonly formulaire = inject(NonNullableFormBuilder).group({
    motDePasseActuel: ['', [Validators.required, Validators.maxLength(72)]],
    nouveauMotDePasse: ['', VALIDATEURS_NOUVEAU_MOT_DE_PASSE],
    confirmationMotDePasse: ['', [Validators.required, identiqueA('nouveauMotDePasse')]],
  });

  protected readonly enCours = signal(false);
  protected readonly erreur = signal<unknown>(null);
  protected readonly motDePasseVisible = signal(false);

  constructor() {
    revaliderConfirmation(
      this.formulaire.controls.nouveauMotDePasse,
      this.formulaire.controls.confirmationMotDePasse,
    );
  }

  protected changer(): void {
    if (this.formulaire.invalid || this.enCours()) {
      this.formulaire.markAllAsTouched();
      return;
    }
    this.enCours.set(true);
    this.erreur.set(null);

    this.auth.changerMotDePasse(this.formulaire.getRawValue()).subscribe({
      next: () => {
        this.enCours.set(false);
        this.snackBar.open('Votre mot de passe a été modifié.', 'Fermer', { duration: 5000 });
        void this.router.navigateByUrl(this.auth.urlAccueil());
      },
      error: (erreur: unknown) => {
        this.enCours.set(false);
        this.erreur.set(erreur);
      },
    });
  }

  protected seDeconnecter(): void {
    this.auth.deconnexion();
  }
}
