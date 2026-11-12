import { BreakpointObserver } from '@angular/cdk/layout';
import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import {
  LIBELLES_FORMULE,
  LIBELLES_STATUT_ABONNEMENT,
  StatutAbonnement,
} from '../../../../core/models/abonnement.model';
import {
  AbonnementAdminResponse,
  expireBientot,
  statutAbonnementValide,
} from '../../../../core/models/super-admin.model';
import { SuperAdminService } from '../../../../core/services/super-admin.service';
import {
  numeroPageUrl,
  parametresPage,
  taillePageUrl,
  TAILLES_PAGE,
} from '../../../../core/utils/pagination-url';
import { EcheanceAbonnement } from '../../../../shared/components/echeance-abonnement/echeance-abonnement';
import { EntetePage } from '../../../../shared/components/entete-page/entete-page';
import { FiltreStatutAbonnement } from '../../../../shared/components/filtre-statut-abonnement/filtre-statut-abonnement';
import { MessageErreur } from '../../../../shared/components/message-erreur/message-erreur';

/**
 * Abonnements de toutes les entreprises (SA-04, SA-06) : expiration la plus proche d'abord, les jamais payés à
 * la fin (tri du backend). Filtre de statut et page dans l'URL (?statut=&page=&taille=). Ceux qui expirent dans
 * 7 jours ou moins sont mis en évidence.
 */
@Component({
  selector: 'app-liste-abonnements',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    MatButtonModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatTableModule,
    EcheanceAbonnement,
    EntetePage,
    FiltreStatutAbonnement,
    MessageErreur,
  ],
  templateUrl: './liste-abonnements.html',
  styleUrl: './liste-abonnements.scss',
})
export class ListeAbonnements {
  private readonly service = inject(SuperAdminService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly libellesStatut = LIBELLES_STATUT_ABONNEMENT;
  protected readonly expireBientot = expireBientot;
  protected readonly tailles = [...TAILLES_PAGE];
  /** Garde les lignes (et le focus) quand la page est rechargée. */
  protected readonly parId = (_index: number, element: AbonnementAdminResponse) => element.abonnement.id;
  protected readonly colonnes = ['entreprise', 'statut', 'formule', 'expiration'];

  /** Paramètres d'URL ?statut=&page=&taille= (liaison des entrées par le routeur). */
  readonly statut = input<string | undefined>(undefined);
  readonly page = input<string | undefined>(undefined);
  readonly taille = input<string | undefined>(undefined);

  protected readonly filtreStatut = computed(() => statutAbonnementValide(this.statut()));
  protected readonly numeroPage = computed(() => numeroPageUrl(this.page()));
  protected readonly taillePage = computed(() => taillePageUrl(this.taille()));

  protected readonly abonnements = signal<AbonnementAdminResponse[]>([]);
  protected readonly total = signal(0);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<unknown>(null);

  protected readonly petitEcran = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 719.98px)')
      .pipe(map((etat) => etat.matches)),
    { initialValue: false },
  );

  constructor() {
    effect(() => {
      const statut = this.filtreStatut();
      const page = this.numeroPage();
      const taille = this.taillePage();
      untracked(() => this.charger(statut, page, taille));
    });
  }

  protected recharger(): void {
    this.charger(this.filtreStatut(), this.numeroPage(), this.taillePage());
  }

  protected filtrer(statut: StatutAbonnement | null): void {
    void this.router.navigate([], { queryParams: { statut, page: null }, queryParamsHandling: 'merge' });
  }

  protected changerPage(evenement: PageEvent): void {
    void this.router.navigate([], {
      queryParams: parametresPage(evenement.pageIndex, evenement.pageSize),
      queryParamsHandling: 'merge',
    });
  }

  protected libelleStatut(ligne: AbonnementAdminResponse): string {
    return LIBELLES_STATUT_ABONNEMENT[ligne.abonnement.statut];
  }

  protected libelleFormule(ligne: AbonnementAdminResponse, siAucune: string): string {
    return ligne.abonnement.formule ? LIBELLES_FORMULE[ligne.abonnement.formule] : siAucune;
  }

  protected nomAdmin(ligne: AbonnementAdminResponse): string | null {
    return ligne.adminPrenom || ligne.adminNom ? `${ligne.adminPrenom ?? ''} ${ligne.adminNom ?? ''}`.trim() : null;
  }

  private charger(statut: StatutAbonnement | null, page: number, taille: number): void {
    this.chargement.set(true);
    this.erreur.set(null);
    this.service
      .listerAbonnements({ statut, page, taille })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultat) => {
          this.abonnements.set(resultat.contenu);
          this.total.set(resultat.totalElements);
          this.chargement.set(false);
        },
        error: (erreur: unknown) => {
          this.erreur.set(erreur);
          this.chargement.set(false);
        },
      });
  }
}
