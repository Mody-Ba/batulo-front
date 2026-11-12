import { BreakpointObserver } from '@angular/cdk/layout';
import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { LIBELLES_STATUT_ABONNEMENT, StatutAbonnement } from '../../../../core/models/abonnement.model';
import {
  AdminLigneResponse,
  compteDepuisLigne,
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
import { DELAI_RECHERCHE_MS } from '../../../../core/utils/recherche';
import { EcheanceAbonnement } from '../../../../shared/components/echeance-abonnement/echeance-abonnement';
import { EntetePage } from '../../../../shared/components/entete-page/entete-page';
import { FiltreStatutAbonnement } from '../../../../shared/components/filtre-statut-abonnement/filtre-statut-abonnement';
import { MessageErreur } from '../../../../shared/components/message-erreur/message-erreur';
import { ActionsAdmin, libelleGestionnaires } from '../actions-admin';

/**
 * Admins et entreprises (une ligne par admin, jamais le super admin) : recherche (entreprise, prénom, nom ou
 * courriel, sans majuscules ni accents) et filtre par statut d'abonnement affiché, combinables, dans l'URL
 * (?recherche=&statut=&page=&taille=). Après une action, la page est relue : la ligne peut sortir du filtre.
 */
@Component({
  selector: 'app-liste-admins',
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatTableModule,
    EcheanceAbonnement,
    EntetePage,
    FiltreStatutAbonnement,
    MessageErreur,
  ],
  templateUrl: './liste-admins.html',
  styleUrl: './liste-admins.scss',
})
export class ListeAdmins {
  private readonly service = inject(SuperAdminService);
  private readonly actions = inject(ActionsAdmin);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly libelleGestionnaires = libelleGestionnaires;
  protected readonly tailles = [...TAILLES_PAGE];
  /** Garde les lignes (et le focus) quand la page est relue. */
  protected readonly parId = (_index: number, element: AdminLigneResponse) => element.admin.id;
  protected readonly colonnes = ['entreprise', 'statut', 'expiration', 'gestionnaires', 'actions'];

  /** Paramètres d'URL ?recherche=&statut=&page=&taille= (liaison des entrées par le routeur). */
  readonly recherche = input<string | undefined>(undefined);
  readonly statut = input<string | undefined>(undefined);
  readonly page = input<string | undefined>(undefined);
  readonly taille = input<string | undefined>(undefined);

  protected readonly termeRecherche = computed(() => this.recherche()?.trim() ?? '');
  protected readonly filtreStatut = computed(() => statutAbonnementValide(this.statut()));
  protected readonly numeroPage = computed(() => numeroPageUrl(this.page()));
  protected readonly taillePage = computed(() => taillePageUrl(this.taille()));
  protected readonly filtre = computed(() => !!this.termeRecherche() || !!this.filtreStatut());
  protected readonly messageAucunResultat = computed(() => {
    const statut = this.filtreStatut();
    const precision = statut ? ` au statut « ${LIBELLES_STATUT_ABONNEMENT[statut]} »` : '';
    const terme = this.termeRecherche();
    return terme
      ? `Aucune entreprise${precision} ne correspond à « ${terme} ».`
      : `Aucune entreprise${precision}.`;
  });
  /** Champ de recherche ; l'URL reste la source de vérité (retour arrière, rechargement). */
  protected readonly champRecherche = new FormControl('', { nonNullable: true });

  protected readonly lignes = signal<AdminLigneResponse[]>([]);
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
      const recherche = this.termeRecherche();
      const statut = this.filtreStatut();
      const page = this.numeroPage();
      const taille = this.taillePage();
      untracked(() => this.charger(recherche, statut, page, taille));
    });
    // L'URL change (retour arrière) : le champ suit, sans relancer de recherche.
    effect(() => {
      const terme = this.termeRecherche();
      untracked(() => {
        if (this.champRecherche.value.trim() !== terme) {
          this.champRecherche.setValue(terme, { emitEvent: false });
        }
      });
    });
    this.champRecherche.valueChanges
      .pipe(
        debounceTime(DELAI_RECHERCHE_MS),
        map((valeur) => valeur.trim()),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe((terme) => {
        if (terme !== this.termeRecherche()) {
          void this.router.navigate([], {
            queryParams: { recherche: terme || null, page: null },
            queryParamsHandling: 'merge',
          });
        }
      });
  }

  protected libelleStatut(ligne: AdminLigneResponse): string {
    return ligne.abonnement ? LIBELLES_STATUT_ABONNEMENT[ligne.abonnement.statut] : 'Sans abonnement';
  }

  protected enAlerte(ligne: AdminLigneResponse): boolean {
    return !!ligne.abonnement && expireBientot(ligne.abonnement);
  }

  protected recharger(): void {
    this.charger(this.termeRecherche(), this.filtreStatut(), this.numeroPage(), this.taillePage());
  }

  protected effacerRecherche(): void {
    this.champRecherche.setValue('');
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

  /** Nouvelle entreprise : on ouvre son détail. */
  protected creer(): void {
    this.actions
      .creer()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((compte) => void this.router.navigate(['/super-admin/admins', compte.id]));
  }

  protected modifier(ligne: AdminLigneResponse): void {
    this.actions.modifier(compteDepuisLigne(ligne)).subscribe(() => this.recharger());
  }

  protected basculerActif(ligne: AdminLigneResponse): void {
    this.actions
      .basculerActif(compteDepuisLigne(ligne), ligne.nombreGestionnaires)
      .subscribe(() => this.recharger());
  }

  protected renvoyerMotDePasse(ligne: AdminLigneResponse): void {
    this.actions.renvoyerMotDePasse(compteDepuisLigne(ligne)).subscribe(() => this.recharger());
  }

  protected supprimer(ligne: AdminLigneResponse): void {
    this.actions.supprimer(compteDepuisLigne(ligne), ligne.nombreGestionnaires).subscribe(() => {
      // Dernier élément d'une page : on revient à la précédente.
      if (this.lignes().length === 1 && this.numeroPage() > 0) {
        void this.router.navigate([], {
          queryParams: { page: this.numeroPage() - 1 || null },
          queryParamsHandling: 'merge',
        });
      } else {
        this.recharger();
      }
    });
  }

  private charger(recherche: string, statut: StatutAbonnement | null, page: number, taille: number): void {
    this.chargement.set(true);
    this.erreur.set(null);
    this.service
      .listerAdmins({ recherche, statut, page, taille })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultat) => {
          this.lignes.set(resultat.contenu);
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
