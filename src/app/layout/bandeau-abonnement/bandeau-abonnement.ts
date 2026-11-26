import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { abonnementEnAlerte, LIBELLES_FORMULE } from '../../core/models/abonnement.model';
import { AbonnementService } from '../../core/services/abonnement.service';
import { AuthService } from '../../core/services/auth.service';
import { DateLPipe, NombreLPipe } from '../../core/i18n/formats.pipes';
import { traduirePluriel } from '../../core/i18n/traduire';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * Bandeau de l'admin, en haut de chaque page : formule, jours restants, date d'expiration et bouton
 * « Renouveler ». Style d'alerte à 7 jours ou moins, d'erreur une fois expiré. Sans abonnement en cours, avec des
 * sondages achetés : « Sondages disponibles : X » et « Acheter des sondages » (rien pour un abonné : illimité).
 * Masqué sur les pages d'abonnement et le tableau de bord (ils affichent déjà tout) et tant que rien n'est payé.
 */
@Component({
  selector: 'app-bandeau-abonnement',
  imports: [TranslocoPipe, DateLPipe, NombreLPipe, RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './bandeau-abonnement.html',
  styleUrl: './bandeau-abonnement.scss',
})
export class BandeauAbonnement {
  private readonly router = inject(Router);
  protected readonly abonnement = inject(AbonnementService).abonnement;
  /** Sondages disponibles, ou null (abonnement en cours, ou aucun achat). */
  protected readonly solde = inject(AuthService).soldeAffiche;
  protected readonly libellesFormule = LIBELLES_FORMULE;

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((evenement) => evenement instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** Pages qui affichent déjà l'abonnement et le solde. */
  private readonly pageAbonnement = computed(
    () => this.url().startsWith('/admin/abonnement') || this.url().split('?')[0] === '/admin',
  );

  /** Partie « abonnement » : une formule payée, pas en attente ni désactivée. */
  protected readonly avecAbonnement = computed(() => {
    const abonnement = this.abonnement();
    return (
      !!abonnement?.formule &&
      !!abonnement.dateExpiration &&
      abonnement.statut !== 'EN_ATTENTE_PAIEMENT' &&
      abonnement.statut !== 'DESACTIVE'
    );
  });

  protected readonly visible = computed(() => !this.pageAbonnement() && (this.avecAbonnement() || this.solde() !== null));
  /** Plus aucun sondage disponible : style d'alerte. */
  protected readonly soldeEpuise = computed(() => this.solde() === 0);

  protected readonly expire = computed(() => this.avecAbonnement() && this.abonnement()?.statut === 'EXPIRE');
  protected readonly alerte = computed(() => !this.expire() && abonnementEnAlerte(this.abonnement()));

  protected readonly texteJours = computed(() => {
    const jours = this.abonnement()?.joursRestants ?? 0;
    return traduirePluriel('bandeau.joursRestants', jours);
  });
}
