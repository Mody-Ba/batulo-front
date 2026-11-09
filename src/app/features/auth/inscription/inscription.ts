import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { InscriptionService } from '../../../core/services/inscription.service';
import {
  AIDE_MOT_DE_PASSE,
  identiqueA,
  nonVide,
  revaliderConfirmation,
  VALIDATEURS_NOUVEAU_MOT_DE_PASSE,
} from '../../../core/utils/validateurs';
import { MessageErreur } from '../../../shared/components/message-erreur/message-erreur';

/**
 * Inscription de l'admin d'une entreprise. Le backend crée l'entreprise, le compte et un
 * abonnement en attente de paiement ; on connecte ensuite le compte automatiquement, ce qui mène
 * à la page abonnement.
 */
@Component({
  selector: 'app-inscription',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MessageErreur,
  ],
  templateUrl: './inscription.html',
  styleUrl: '../auth-formulaire.scss',
  host: { class: 'page-auth' },
})
export class Inscription {
  private readonly auth = inject(AuthService);
  private readonly inscriptionService = inject(InscriptionService);
  private readonly router = inject(Router);

  protected readonly aideMotDePasse = AIDE_MOT_DE_PASSE;

  protected readonly formulaire = inject(NonNullableFormBuilder).group({
    prenom: ['', [Validators.required, nonVide, Validators.maxLength(100)]],
    nom: ['', [Validators.required, nonVide, Validators.maxLength(100)]],
    courriel: ['', [Validators.required, nonVide, Validators.email, Validators.maxLength(255)]],
    nomEntreprise: ['', [Validators.maxLength(150)]],
    motDePasse: ['', VALIDATEURS_NOUVEAU_MOT_DE_PASSE],
    confirmationMotDePasse: ['', [Validators.required, identiqueA('motDePasse')]],
  });

  protected readonly enCours = signal(false);
  protected readonly erreur = signal<unknown>(null);
  protected readonly motDePasseVisible = signal(false);

  constructor() {
    revaliderConfirmation(
      this.formulaire.controls.motDePasse,
      this.formulaire.controls.confirmationMotDePasse,
    );
  }

  protected inscrire(): void {
    if (this.formulaire.invalid || this.enCours()) {
      this.formulaire.markAllAsTouched();
      return;
    }
    this.enCours.set(true);
    this.erreur.set(null);

    const valeurs = this.formulaire.getRawValue();
    const nomEntreprise = valeurs.nomEntreprise.trim();
    const demande = {
      prenom: valeurs.prenom.trim(),
      nom: valeurs.nom.trim(),
      courriel: valeurs.courriel.trim(),
      motDePasse: valeurs.motDePasse,
      confirmationMotDePasse: valeurs.confirmationMotDePasse,
      ...(nomEntreprise ? { nomEntreprise } : {}),
    };

    let compteCree = false;
    this.inscriptionService
      .inscrire(demande)
      .pipe(
        switchMap(() => {
          compteCree = true;
          return this.auth.connexion({ courriel: demande.courriel, motDePasse: demande.motDePasse });
        }),
      )
      .subscribe({
        next: () => {
          this.enCours.set(false);
          void this.router.navigateByUrl(this.auth.urlAccueil());
        },
        error: (erreur: unknown) => {
          this.enCours.set(false);
          if (compteCree) {
            // Compte créé, connexion automatique impossible : on laisse l'utilisateur se connecter.
            this.auth.preparerMessageConnexion(
              'Votre compte a été créé. Connectez-vous pour choisir votre abonnement.',
            );
            void this.router.navigateByUrl('/connexion');
            return;
          }
          this.erreur.set(erreur);
        },
      });
  }
}
