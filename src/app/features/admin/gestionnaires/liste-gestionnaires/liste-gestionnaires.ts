import { BreakpointObserver } from '@angular/cdk/layout';
import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { GestionnaireResponse, nomComplet } from '../../../../core/models/gestionnaire.model';
import { AuthService, MESSAGE_LECTURE_SEULE } from '../../../../core/services/auth.service';
import { GestionnaireService } from '../../../../core/services/gestionnaire.service';
import { EntetePage } from '../../../../shared/components/entete-page/entete-page';
import { MessageErreur } from '../../../../shared/components/message-erreur/message-erreur';
import { ActionsGestionnaire } from '../actions-gestionnaire';
import { numeroPageUrl, parametresPage, taillePageUrl, TAILLES_PAGE } from '../../../../core/utils/pagination-url';

/** Délai après la dernière frappe avant de lancer la recherche. */
export const DELAI_RECHERCHE_MS = 300;

/** Filtre d'état : ?actif=true|false dans l'URL, absent pour tous. */
export type FiltreActif = 'tous' | 'actifs' | 'desactives';

/**
 * Gestionnaires de l'entreprise : liste paginée, recherche (prénom, nom, courriel, sans majuscules ni accents) et
 * filtre d'état, tous dans l'URL (?recherche=&actif=&page=&taille=).
 */
@Component({
  selector: 'app-liste-gestionnaires',
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSlideToggleModule,
    MatTableModule,
    MatTooltipModule,
    EntetePage,
    MessageErreur,
  ],
  templateUrl: './liste-gestionnaires.html',
  styleUrl: './liste-gestionnaires.scss',
})
export class ListeGestionnaires {
  private readonly service = inject(GestionnaireService);
  private readonly actions = inject(ActionsGestionnaire);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly auth = inject(AuthService);
  protected readonly messageLectureSeule = MESSAGE_LECTURE_SEULE;
  protected readonly nomComplet = nomComplet;
  protected readonly tailles = [...TAILLES_PAGE];
  /** Garde les lignes (et le focus) quand un élément est mis à jour. */
  protected readonly parId = (_index: number, element: GestionnaireResponse) => element.id;
  protected readonly colonnes = ['nom', 'etat', 'permission', 'actions'];

  /** Paramètres d'URL ?recherche=&actif=&page=&taille= (liaison des entrées par le routeur). */
  readonly recherche = input<string | undefined>(undefined);
  readonly actif = input<string | undefined>(undefined);
  readonly page = input<string | undefined>(undefined);
  readonly taille = input<string | undefined>(undefined);

  protected readonly termeRecherche = computed(() => this.recherche()?.trim() ?? '');
  protected readonly filtreActif = computed<FiltreActif>(() => {
    const actif = this.actif();
    return actif === 'true' ? 'actifs' : actif === 'false' ? 'desactives' : 'tous';
  });
  protected readonly filtre = computed(() => !!this.termeRecherche() || this.filtreActif() !== 'tous');
  protected readonly messageAucunResultat = computed(() => {
    const etat = { tous: '', actifs: ' actif', desactives: ' désactivé' }[this.filtreActif()];
    const terme = this.termeRecherche();
    return terme
      ? `Aucun gestionnaire${etat} ne correspond à « ${terme} ».`
      : `Aucun gestionnaire${etat}.`;
  });
  /** Champ de recherche ; l'URL reste la source de vérité (retour arrière, rechargement). */
  protected readonly champRecherche = new FormControl('', { nonNullable: true });

  protected readonly numeroPage = computed(() => numeroPageUrl(this.page()));
  protected readonly taillePage = computed(() => taillePageUrl(this.taille()));

  protected readonly gestionnaires = signal<GestionnaireResponse[]>([]);
  protected readonly total = signal(0);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<unknown>(null);
  /** Interrupteurs en cours d'enregistrement (id du gestionnaire). */
  protected readonly permissionsEnCours = signal<ReadonlySet<number>>(new Set());

  protected readonly petitEcran = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 719.98px)')
      .pipe(map((etat) => etat.matches)),
    { initialValue: false },
  );

  constructor() {
    effect(() => {
      const page = this.numeroPage();
      const taille = this.taillePage();
      const recherche = this.termeRecherche();
      const actif = this.filtreActif();
      untracked(() => this.charger(page, taille, recherche, actif));
    });
    // L'URL change (retour arrière, lien du tableau de bord) : le champ suit, sans relancer de recherche.
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

  protected recharger(): void {
    this.charger(this.numeroPage(), this.taillePage(), this.termeRecherche(), this.filtreActif());
  }

  protected effacerRecherche(): void {
    this.champRecherche.setValue('');
  }

  protected filtrerActif(filtre: FiltreActif | null): void {
    const actif = filtre === 'actifs' ? 'true' : filtre === 'desactives' ? 'false' : null;
    void this.router.navigate([], { queryParams: { actif, page: null }, queryParamsHandling: 'merge' });
  }

  protected changerPage(evenement: PageEvent): void {
    void this.router.navigate([], {
      queryParams: parametresPage(evenement.pageIndex, evenement.pageSize),
      queryParamsHandling: 'merge',
    });
  }

  protected creer(): void {
    this.actions
      .creer()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        // Le plus récent est en tête de la première page.
        if (this.numeroPage() === 0) {
          this.recharger();
        } else {
          void this.router.navigate([], { queryParams: { page: null }, queryParamsHandling: 'merge' });
        }
      });
  }

  protected modifier(gestionnaire: GestionnaireResponse): void {
    this.actions.modifier(gestionnaire).subscribe((g) => this.remplacer(g));
  }

  protected basculerActif(gestionnaire: GestionnaireResponse): void {
    this.actions.basculerActif(gestionnaire).subscribe((g) => this.remplacer(g));
  }

  protected renvoyerMotDePasse(gestionnaire: GestionnaireResponse): void {
    this.actions.renvoyerMotDePasse(gestionnaire).subscribe((g) => this.remplacer(g));
  }

  protected supprimer(gestionnaire: GestionnaireResponse): void {
    this.actions.supprimer(gestionnaire).subscribe(() => {
      // Dernier élément d'une page : on revient à la précédente.
      if (this.gestionnaires().length === 1 && this.numeroPage() > 0) {
        void this.router.navigate([], {
          queryParams: { page: this.numeroPage() - 1 || null },
          queryParamsHandling: 'merge',
        });
      } else {
        this.recharger();
      }
    });
  }

  /** Mise à jour optimiste ; l'interrupteur revient en arrière si le serveur refuse. */
  protected changerPermission(gestionnaire: GestionnaireResponse, evenement: MatSlideToggleChange): void {
    const autorise = evenement.checked;
    this.marquerPermission(gestionnaire.id, true);
    this.remplacer({ ...gestionnaire, peutCreerSondages: autorise });
    this.actions.changerPermission(gestionnaire, autorise).subscribe({
      next: (g) => {
        this.marquerPermission(gestionnaire.id, false);
        this.remplacer(g);
      },
      error: () => {
        this.marquerPermission(gestionnaire.id, false);
        this.remplacer(gestionnaire);
        evenement.source.checked = gestionnaire.peutCreerSondages;
      },
    });
  }

  private charger(page: number, taille: number, recherche: string, actif: FiltreActif): void {
    this.chargement.set(true);
    this.erreur.set(null);
    this.service
      .lister({ recherche, actif: actif === 'tous' ? null : actif === 'actifs', page, taille })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultat) => {
          this.gestionnaires.set(resultat.contenu);
          this.total.set(resultat.totalElements);
          this.chargement.set(false);
        },
        error: (erreur: unknown) => {
          this.erreur.set(erreur);
          this.chargement.set(false);
        },
      });
  }

  private remplacer(gestionnaire: GestionnaireResponse): void {
    this.gestionnaires.update((liste) => liste.map((g) => (g.id === gestionnaire.id ? gestionnaire : g)));
  }

  private marquerPermission(id: number, enCours: boolean): void {
    this.permissionsEnCours.update((ids) => {
      const copie = new Set(ids);
      if (enCours) {
        copie.add(id);
      } else {
        copie.delete(id);
      }
      return copie;
    });
  }
}
