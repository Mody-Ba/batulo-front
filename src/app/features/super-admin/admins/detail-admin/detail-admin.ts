import { Component, computed, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router, RouterLink } from '@angular/router';
import {
  abonnementEnAlerte,
  LIBELLES_FORMULE,
  LIBELLES_FOURNISSEUR,
  LIBELLES_STATUT_ABONNEMENT,
  PaiementResponse,
} from '../../../../core/models/abonnement.model';
import { PageResponse } from '../../../../core/models/page.model';
import { montantEnClair } from '../../../../core/utils/montant';
import { nomComplet } from '../../../../core/models/gestionnaire.model';
import { AdminDetailResponse, compteDepuisDetail } from '../../../../core/models/super-admin.model';
import { SuperAdminService } from '../../../../core/services/super-admin.service';
import { EntetePage } from '../../../../shared/components/entete-page/entete-page';
import { MessageErreur } from '../../../../shared/components/message-erreur/message-erreur';
import { ActionsAdmin, libelleGestionnaires } from '../actions-admin';
import { couleurValide } from '../../../../core/utils/couleur';
import { urlLogoSure } from '../../../../shared/formulaire/apparence/apparence';
import { DateLPipe } from '../../../../core/i18n/formats.pipes';
import { MontantLPipe } from '../../../../core/i18n/formats.pipes';
import { TranslocoPipe } from '@jsverse/transloco';
import { NombreLPipe, PlurielPipe } from '../../../../core/i18n/formats.pipes';

/** Taille d'une page de l'historique des achats de sondages. */
export const TAILLE_ACHATS = 5;

/**
 * Détail d'un admin : entreprise, compte de l'admin, abonnement (jours restants), sondages achetés (solde et historique
 * des achats, lecture seule) et actions.
 */
@Component({
  selector: 'app-detail-admin',
  imports: [PlurielPipe, NombreLPipe, TranslocoPipe, MontantLPipe, DateLPipe, MatPaginatorModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    EntetePage,
    MessageErreur,
  ],
  templateUrl: './detail-admin.html',
  styleUrl: './detail-admin.scss',
})
export class DetailAdmin {
  private readonly service = inject(SuperAdminService);
  private readonly actions = inject(ActionsAdmin);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly nomComplet = nomComplet;
  protected readonly libelleGestionnaires = libelleGestionnaires;
  protected readonly libellesFormule = LIBELLES_FORMULE;
  protected readonly libellesStatut = LIBELLES_STATUT_ABONNEMENT;
  protected readonly libellesFournisseur = LIBELLES_FOURNISSEUR;
  protected readonly montant = montantEnClair;
  protected readonly tailleAchats = TAILLE_ACHATS;

  /** Historique des achats de sondages (GET .../admins/{id}/achats-sondages), paginé dans la carte. */
  protected readonly achats = signal<PageResponse<PaiementResponse> | null>(null);
  protected readonly erreurAchats = signal<unknown>(null);

  /** Paramètre de route :id. */
  readonly id = input.required<string>();
  private readonly identifiant = computed(() => Number(this.id()));

  protected readonly detail = signal<AdminDetailResponse | null>(null);
  /** Apparence de l'entreprise (lecture seule) : seules une couleur #RRGGBB et une URL http(s) sont affichées. */
  protected readonly urlLogo = urlLogoSure;
  protected readonly couleurSure = (couleur: string | null | undefined) => (couleurValide(couleur) ? couleur : null);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<unknown>(null);

  protected readonly enAlerte = computed(() => abonnementEnAlerte(this.detail()?.abonnement ?? null));

  constructor() {
    effect(() => {
      const id = this.identifiant();
      untracked(() => {
        this.charger(id);
        this.chargerAchats(id, 0);
      });
    });
  }

  protected chargerAchats(id = this.identifiant(), page = this.achats()?.page ?? 0): void {
    this.erreurAchats.set(null);
    this.service
      .achatsSondages(id, page, TAILLE_ACHATS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (achats) => this.achats.set(achats),
        error: (erreur: unknown) => this.erreurAchats.set(erreur),
      });
  }

  protected changerPageAchats(evenement: PageEvent): void {
    this.chargerAchats(this.identifiant(), evenement.pageIndex);
  }

  protected charger(id = this.identifiant()): void {
    this.chargement.set(true);
    this.erreur.set(null);
    this.service
      .detailAdmin(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          this.detail.set(detail);
          this.chargement.set(false);
        },
        error: (erreur: unknown) => {
          this.erreur.set(erreur);
          this.chargement.set(false);
        },
      });
  }

  protected modifier(detail: AdminDetailResponse): void {
    this.actions.modifier(compteDepuisDetail(detail)).subscribe((maj) => this.detail.set(maj));
  }

  protected basculerActif(detail: AdminDetailResponse): void {
    this.actions
      .basculerActif(compteDepuisDetail(detail), detail.nombreGestionnaires)
      .subscribe((maj) => this.detail.set(maj));
  }

  /** L'expiration du mot de passe temporaire change : on relit le détail. */
  protected renvoyerMotDePasse(detail: AdminDetailResponse): void {
    this.actions.renvoyerMotDePasse(compteDepuisDetail(detail)).subscribe(() => this.charger());
  }

  protected supprimer(detail: AdminDetailResponse): void {
    this.actions
      .supprimer(compteDepuisDetail(detail), detail.nombreGestionnaires)
      .subscribe(() => void this.router.navigateByUrl('/super-admin/admins'));
  }
}
