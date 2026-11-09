import { Component, computed, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink } from '@angular/router';
import { LIBELLES_ROLE } from '../../core/models/role.model';
import { AuthService } from '../../core/services/auth.service';
import { ClocheNotifications } from '../cloche-notifications/cloche-notifications';

/** Barre du haut : bouton du menu (petit écran), marque, notifications et menu du compte. */
@Component({
  selector: 'app-barre-haut',
  imports: [
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatDividerModule,
    RouterLink,
    ClocheNotifications,
  ],
  templateUrl: './barre-haut.html',
  styleUrl: './barre-haut.scss',
})
export class BarreHaut {
  protected readonly auth = inject(AuthService);
  protected readonly libellesRole = LIBELLES_ROLE;

  /** Affiche le bouton qui ouvre le menu latéral (petit écran). */
  readonly boutonMenu = input(false);
  readonly basculerMenu = output<void>();

  protected readonly initiales = computed(() => {
    const utilisateur = this.auth.utilisateur();
    if (!utilisateur) {
      return '?';
    }
    return `${utilisateur.prenom.charAt(0)}${utilisateur.nom.charAt(0)}`.toUpperCase();
  });

  /** Pas de notifications tant qu'une page est imposée : le serveur refuserait l'appel (403). */
  protected readonly notificationsDisponibles = computed(
    () => this.auth.estConnecte() && this.auth.redirectionObligatoire() === null,
  );

  protected seDeconnecter(): void {
    this.auth.deconnexion();
  }
}
