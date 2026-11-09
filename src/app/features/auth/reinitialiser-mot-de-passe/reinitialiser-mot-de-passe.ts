import { Component, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { CODES_ERREUR } from '../../../core/models/erreur.model';
import { AuthService } from '../../../core/services/auth.service';
import { MotDePasseService } from '../../../core/services/mot-de-passe.service';
import { aLeCode } from '../../../core/utils/erreur-http';
import {
  AIDE_MOT_DE_PASSE,
  identiqueA,
  revaliderConfirmation,
  VALIDATEURS_NOUVEAU_MOT_DE_PASSE,
} from '../../../core/utils/validateurs';
import { Encadre } from '../../../shared/components/encadre/encadre';
import { MessageErreur } from '../../../shared/components/message-erreur/message-erreur';

/** Page du lien reçu par courriel : /reinitialiser-mot-de-passe?jeton=... */
@Component({
  selector: 'app-reinitialiser-mot-de-passe',
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
  templateUrl: './reinitialiser-mot-de-passe.html',
  styleUrl: '../auth-formulaire.scss',
  host: { class: 'page-auth' },
})
export class ReinitialiserMotDePasse {
  private readonly service = inject(MotDePasseService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Paramètre « jeton » du lien (liaison des entrées par le routeur). */
  readonly jeton = input<string | undefined>(undefined);

  protected readonly aideMotDePasse = AIDE_MOT_DE_PASSE;
  protected readonly lienValide = computed(() => !!this.jeton()?.trim());

  protected readonly formulaire = inject(NonNullableFormBuilder).group({
    nouveauMotDePasse: ['', VALIDATEURS_NOUVEAU_MOT_DE_PASSE],
    confirmationMotDePasse: ['', [Validators.required, identiqueA('nouveauMotDePasse')]],
  });

  protected readonly enCours = signal(false);
  protected readonly erreur = signal<unknown>(null);
  protected readonly motDePasseVisible = signal(false);
  /** Lien inconnu, expiré ou déjà utilisé : il faut en demander un autre. */
  protected readonly lienExpire = computed(() => aLeCode(this.erreur(), CODES_ERREUR.JETON_INVALIDE));

  constructor() {
    revaliderConfirmation(
      this.formulaire.controls.nouveauMotDePasse,
      this.formulaire.controls.confirmationMotDePasse,
    );
  }

  protected reinitialiser(): void {
    const jeton = this.jeton()?.trim();
    if (!jeton || this.formulaire.invalid || this.enCours()) {
      this.formulaire.markAllAsTouched();
      return;
    }
    this.enCours.set(true);
    this.erreur.set(null);

    this.service.reinitialiser({ jeton, ...this.formulaire.getRawValue() }).subscribe({
      next: (reponse) => {
        this.enCours.set(false);
        // Le serveur a fermé toutes les sessions du compte, y compris celle de cet onglet.
        if (this.auth.estConnecte()) {
          this.auth.terminerSession(reponse.message);
        } else {
          this.auth.preparerMessageConnexion(reponse.message);
          void this.router.navigateByUrl('/connexion');
        }
      },
      error: (erreur: unknown) => {
        this.enCours.set(false);
        this.erreur.set(erreur);
      },
    });
  }
}
