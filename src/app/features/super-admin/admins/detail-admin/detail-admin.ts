import { CurrencyPipe, DatePipe, UpperCasePipe } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router, RouterLink } from '@angular/router';
import {
  abonnementEnAlerte,
  LIBELLES_FORMULE,
  LIBELLES_STATUT_ABONNEMENT,
} from '../../../../core/models/abonnement.model';
import { nomComplet } from '../../../../core/models/gestionnaire.model';
import { AdminDetailResponse, compteDepuisDetail } from '../../../../core/models/super-admin.model';
import { SuperAdminService } from '../../../../core/services/super-admin.service';
import { EntetePage } from '../../../../shared/components/entete-page/entete-page';
import { MessageErreur } from '../../../../shared/components/message-erreur/message-erreur';
import { ActionsAdmin, libelleGestionnaires } from '../actions-admin';

/** Détail d'un admin : entreprise, compte de l'admin, abonnement (jours restants) et actions. */
@Component({
  selector: 'app-detail-admin',
  imports: [
    CurrencyPipe,
    DatePipe,
    UpperCasePipe,
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

  /** Paramètre de route :id. */
  readonly id = input.required<string>();
  private readonly identifiant = computed(() => Number(this.id()));

  protected readonly detail = signal<AdminDetailResponse | null>(null);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<unknown>(null);

  protected readonly enAlerte = computed(() => abonnementEnAlerte(this.detail()?.abonnement ?? null));

  constructor() {
    effect(() => {
      const id = this.identifiant();
      untracked(() => this.charger(id));
    });
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
