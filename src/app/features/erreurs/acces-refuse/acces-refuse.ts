import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-acces-refuse',
  imports: [MatIconModule, MatButtonModule, RouterLink],
  template: `
    <section class="conteneur-page etroit page-erreur">
      <span class="icone-erreur" aria-hidden="true">
        <mat-icon fontIcon="block" aria-hidden="true" />
      </span>
      <h1>Accès refusé</h1>
      <p>Votre rôle ne permet pas d’accéder à cette page.</p>
      <a mat-flat-button class="bouton-principal" [routerLink]="auth.urlAccueil()">
        <mat-icon fontIcon="home" aria-hidden="true" />Retour à l’accueil
      </a>
    </section>
  `,
  styleUrl: '../page-erreur.scss',
})
export class AccesRefuse {
  protected readonly auth = inject(AuthService);
}
