import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { MotDePasseService } from '../../../core/services/mot-de-passe.service';
import { nonVide } from '../../../core/utils/validateurs';
import { Encadre } from '../../../shared/components/encadre/encadre';
import { MessageErreur } from '../../../shared/components/message-erreur/message-erreur';

/** Demande d'un lien de réinitialisation (même réponse que le compte existe ou non). */
@Component({
  selector: 'app-mot-de-passe-oublie',
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
  templateUrl: './mot-de-passe-oublie.html',
  styleUrl: '../auth-formulaire.scss',
  host: { class: 'page-auth' },
})
export class MotDePasseOublie {
  private readonly service = inject(MotDePasseService);

  protected readonly formulaire = inject(NonNullableFormBuilder).group({
    courriel: ['', [Validators.required, nonVide, Validators.email, Validators.maxLength(255)]],
  });

  protected readonly enCours = signal(false);
  protected readonly erreur = signal<unknown>(null);
  /** Message du serveur une fois la demande envoyée. */
  protected readonly confirmation = signal<string | null>(null);

  protected envoyer(): void {
    if (this.formulaire.invalid || this.enCours()) {
      this.formulaire.markAllAsTouched();
      return;
    }
    this.enCours.set(true);
    this.erreur.set(null);

    this.service
      .demanderReinitialisation({ courriel: this.formulaire.getRawValue().courriel.trim() })
      .subscribe({
        next: (reponse) => {
          this.enCours.set(false);
          this.confirmation.set(reponse.message);
        },
        error: (erreur: unknown) => {
          this.enCours.set(false);
          this.erreur.set(erreur);
        },
      });
  }
}
