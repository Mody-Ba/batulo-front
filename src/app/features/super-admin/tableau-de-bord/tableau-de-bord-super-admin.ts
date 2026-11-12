import { DecimalPipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { LIBELLES_STATUT_ABONNEMENT, StatutAbonnement } from '../../../core/models/abonnement.model';
import {
  COMPTEUR_PAR_STATUT,
  STATUTS_ABONNEMENT,
  TableauDeBordSuperAdminResponse,
} from '../../../core/models/super-admin.model';
import { AuthService } from '../../../core/services/auth.service';
import { SuperAdminService } from '../../../core/services/super-admin.service';
import { DernieresNotifications } from '../../../shared/components/dernieres-notifications/dernieres-notifications';
import { EntetePage } from '../../../shared/components/entete-page/entete-page';
import { MessageErreur } from '../../../shared/components/message-erreur/message-erreur';

/** Tuile d'un statut : nombre d'entreprises et lien vers la liste filtrée. */
interface TuileStatut {
  statut: StatutAbonnement;
  libelle: string;
  nombre: number;
  /** À surveiller (expire dans 7 jours ou moins) : tuile mise en évidence si elle n'est pas vide. */
  aSurveiller: boolean;
}

/**
 * Tableau de bord du super admin (GET /api/super-admin/tableau-de-bord) : entreprises par statut d'abonnement
 * affiché, chaque compteur menant à la liste filtrée ; demandes d'augmentation en attente ; 5 dernières
 * notifications (inscriptions, paiements, expirations, demandes...).
 */
@Component({
  selector: 'app-tableau-de-bord-super-admin',
  imports: [
    DecimalPipe,
    RouterLink,
    MatButtonModule,
    MatProgressBarModule,
    DernieresNotifications,
    EntetePage,
    MessageErreur,
  ],
  templateUrl: './tableau-de-bord-super-admin.html',
  styleUrl: './tableau-de-bord-super-admin.scss',
})
export class TableauDeBordSuperAdmin {
  private readonly service = inject(SuperAdminService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);

  protected readonly titre = computed(() => {
    const prenom = this.auth.utilisateur()?.prenom;
    return prenom ? `Bonjour ${prenom}` : 'Tableau de bord';
  });

  protected readonly chiffres = signal<TableauDeBordSuperAdminResponse | null>(null);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<unknown>(null);

  protected readonly tuiles = computed<TuileStatut[]>(() => {
    const entreprises = this.chiffres()?.entreprises;
    if (!entreprises) {
      return [];
    }
    return STATUTS_ABONNEMENT.map((statut) => ({
      statut,
      libelle: LIBELLES_STATUT_ABONNEMENT[statut],
      nombre: entreprises[COMPTEUR_PAR_STATUT[statut]],
      aSurveiller: statut === 'EXPIRE_BIENTOT',
    }));
  });

  constructor() {
    this.charger();
  }

  protected charger(): void {
    this.chargement.set(true);
    this.erreur.set(null);
    this.service
      .tableauDeBord()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (chiffres) => {
          this.chiffres.set(chiffres);
          this.chargement.set(false);
        },
        error: (erreur: unknown) => {
          this.erreur.set(erreur);
          this.chargement.set(false);
        },
      });
  }
}
