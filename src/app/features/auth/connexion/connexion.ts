import { Component, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { cheminInterne } from '../../../core/utils/redirection';
import { nonVide } from '../../../core/utils/validateurs';
import { Encadre } from '../../../shared/components/encadre/encadre';
import { MessageErreur } from '../../../shared/components/message-erreur/message-erreur';
import { traduireSiConnu } from '../../../core/i18n/traduire';
import { SelecteurLangue } from '../../../shared/components/selecteur-langue/selecteur-langue';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-connexion',
  imports: [TranslocoPipe, SelecteurLangue, ReactiveFormsModule,
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

  /** ?retour= : page demandée avant la connexion (posé par les gardes), chemin interne seulement. */
  readonly retour = input<string | undefined>(undefined);

  protected readonly formulaire = inject(NonNullableFormBuilder).group({
    courriel: ['', [Validators.required, nonVide, Validators.email, Validators.maxLength(255)]],
    motDePasse: ['', [Validators.required, Validators.maxLength(72)]],
  });

  protected readonly enCours = signal(false);
  protected readonly erreur = signal<unknown>(null);
  protected readonly motDePasseVisible = signal(false);
  /** Message laissé par une déconnexion automatique ou une réinitialisation. */
  /** Message laissé par la session précédente : clé de traduction (relue au changement de langue) ou texte. */
  private readonly messageRecu = this.auth.consommerMessageConnexion();
  private readonly informationVisible = signal(this.messageRecu !== null);
  protected readonly information = computed(() =>
    this.informationVisible() && this.messageRecu ? (traduireSiConnu(this.messageRecu) ?? this.messageRecu) : null,
  );

  protected seConnecter(): void {
    if (this.formulaire.invalid || this.enCours()) {
      this.formulaire.markAllAsTouched();
      return;
    }
    this.enCours.set(true);
    this.erreur.set(null);
    this.informationVisible.set(false);

    const { courriel, motDePasse } = this.formulaire.getRawValue();
    this.auth.connexion({ courriel: courriel.trim(), motDePasse }).subscribe({
      next: () => {
        this.enCours.set(false);
        // Une page imposée (mot de passe temporaire, paiement…) reste prioritaire : les gardes y renvoient.
        void this.router.navigateByUrl(cheminInterne(this.retour()) ?? this.auth.urlAccueil());
      },
      error: (erreur: unknown) => {
        this.enCours.set(false);
        this.erreur.set(erreur);
        this.formulaire.controls.motDePasse.reset();
      },
    });
  }
}
