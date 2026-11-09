import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { nonVide } from '../../../core/utils/validateurs';
import { Encadre } from '../../../shared/components/encadre/encadre';
import { MessageErreur } from '../../../shared/components/message-erreur/message-erreur';

@Component({
  selector: 'app-connexion',
  imports: [
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
  templateUrl: './connexion.html',
  styleUrl: '../auth-formulaire.scss',
  host: { class: 'page-auth' },
})
export class Connexion {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly formulaire = inject(NonNullableFormBuilder).group({
    courriel: ['', [Validators.required, nonVide, Validators.email, Validators.maxLength(255)]],
    motDePasse: ['', [Validators.required, Validators.maxLength(72)]],
  });

  protected readonly enCours = signal(false);
  protected readonly erreur = signal<unknown>(null);
  protected readonly motDePasseVisible = signal(false);
  /** Message laissé par une déconnexion automatique ou une réinitialisation. */
  protected readonly information = signal(this.auth.consommerMessageConnexion());

  protected seConnecter(): void {
    if (this.formulaire.invalid || this.enCours()) {
      this.formulaire.markAllAsTouched();
      return;
    }
    this.enCours.set(true);
    this.erreur.set(null);
    this.information.set(null);

    const { courriel, motDePasse } = this.formulaire.getRawValue();
    this.auth.connexion({ courriel: courriel.trim(), motDePasse }).subscribe({
      next: () => {
        this.enCours.set(false);
        void this.router.navigateByUrl(this.auth.urlAccueil());
      },
      error: (erreur: unknown) => {
        this.enCours.set(false);
        this.erreur.set(erreur);
        this.formulaire.controls.motDePasse.reset();
      },
    });
  }
}
