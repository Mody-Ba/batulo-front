import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { abonnementEnAlerte, LIBELLES_FORMULE } from '../../core/models/abonnement.model';
import { AbonnementService } from '../../core/services/abonnement.service';

/**
 * Bandeau de l'admin, en haut de chaque page : formule, jours restants, date d'expiration et bouton
 * « Renouveler ». Style d'alerte à 7 jours ou moins, d'erreur une fois expiré. Masqué sur les pages
 * d'abonnement et le tableau de bord (ils affichent déjà tout) et tant qu'aucune formule n'est payée.
 */
@Component({
  selector: 'app-bandeau-abonnement',
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './bandeau-abonnement.html',
  styleUrl: './bandeau-abonnement.scss',
})
export class BandeauAbonnement {
  private readonly router = inject(Router);
  protected readonly abonnement = inject(AbonnementService).abonnement;
  protected readonly libellesFormule = LIBELLES_FORMULE;

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((evenement) => evenement instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly visible = computed(() => {
    const abonnement = this.abonnement();
    return (
      !!abonnement?.formule &&
      !!abonnement.dateExpiration &&
      abonnement.statut !== 'EN_ATTENTE_PAIEMENT' &&
      abonnement.statut !== 'DESACTIVE' &&
      !this.url().startsWith('/admin/abonnement') &&
      // Le tableau de bord affiche déjà l'abonnement.
      this.url().split('?')[0] !== '/admin'
    );
  });

  protected readonly expire = computed(() => this.abonnement()?.statut === 'EXPIRE');
  protected readonly alerte = computed(() => !this.expire() && abonnementEnAlerte(this.abonnement()));

  protected readonly texteJours = computed(() => {
    const jours = this.abonnement()?.joursRestants ?? 0;
    return `${jours} jour${jours > 1 ? 's' : ''} restant${jours > 1 ? 's' : ''}`;
  });
}
