import { BreakpointObserver } from '@angular/cdk/layout';
import { DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { nomComplet } from '../../../core/models/gestionnaire.model';
import {
  classeEtatSondage,
  GestionnaireAssigneResponse,
  LIBELLES_STATUT_SONDAGE,
  libelleEtatSondage,
  StatutSondage,
  STATUTS_SONDAGE,
  SondageResumeResponse,
} from '../../../core/models/sondage.model';
import { AuthService, MESSAGE_LECTURE_SEULE } from '../../../core/services/auth.service';
import { FiltreSondages, SondageService } from '../../../core/services/sondage.service';
import { EntetePage } from '../../../shared/components/entete-page/entete-page';
import { MessageErreur } from '../../../shared/components/message-erreur/message-erreur';
import { numeroPageUrl, parametresPage, taillePageUrl, TAILLES_PAGE } from '../../../core/utils/pagination-url';

/** Assignés affichés en clair dans une ligne ; les autres sont résumés par « +N ». */
export const ASSIGNES_VISIBLES = 2;

/** Nom d'un assigné, avec la mention « désactivé » s'il ne peut plus se connecter. */
export function libelleAssigne(gestionnaire: GestionnaireAssigneResponse): string {
  return gestionnaire.actif ? nomComplet(gestionnaire) : `${nomComplet(gestionnaire)} (désactivé)`;
}

/**
 * Sondages de l'entreprise (admin) ou du gestionnaire, en lecture seule en F4. Par défaut une ligne par sondage
 * (sa dernière version publiée en cours ou terminée, sinon son brouillon) ; ?versions=toutes montre chaque version.
 * Filtres et page dans l'URL (?versions=&statut=&page=&taille=).
 */
@Component({
  selector: 'app-liste-sondages',
  imports: [
    DatePipe,
    DecimalPipe,
    NgTemplateOutlet,
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatChipsModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatTableModule,
    MatTooltipModule,
    EntetePage,
    MessageErreur,
  ],
  templateUrl: './liste-sondages.html',
  styleUrl: './liste-sondages.scss',
})
export class ListeSondages {
  private readonly service = inject(SondageService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly auth = inject(AuthService);
  protected readonly messageLectureSeule = MESSAGE_LECTURE_SEULE;
  protected readonly statuts = STATUTS_SONDAGE;
  protected readonly libellesStatut = LIBELLES_STATUT_SONDAGE;
  protected readonly libelleEtat = libelleEtatSondage;
  protected readonly classeEtat = classeEtatSondage;
  protected readonly tailles = [...TAILLES_PAGE];
  /** Garde les lignes (et le focus) quand un élément est mis à jour. */
  protected readonly parId = (_index: number, element: SondageResumeResponse) => element.id;
  protected readonly libelleAssigne = libelleAssigne;
  protected readonly assignesVisibles = ASSIGNES_VISIBLES;

  /** Assignés : admin seulement (le backend renvoie null au gestionnaire). */
  protected readonly voitAssignes = computed(() => this.auth.role() === 'ADMIN');
  protected readonly colonnes = computed(() =>
    this.voitAssignes()
      ? ['titre', 'etat', 'version', 'reponses', 'assignes', 'auteur', 'modification']
      : ['titre', 'etat', 'version', 'reponses', 'auteur', 'modification'],
  );

  readonly versions = input<string | undefined>(undefined);
  readonly statut = input<string | undefined>(undefined);
  readonly page = input<string | undefined>(undefined);
  readonly taille = input<string | undefined>(undefined);

  protected readonly statutFiltre = computed<StatutSondage | null>(() => {
    const statut = this.statut();
    return STATUTS_SONDAGE.includes(statut as StatutSondage) ? (statut as StatutSondage) : null;
  });
  /** Par défaut : dernière version de chaque sondage. */
  protected readonly toutesLesVersions = computed(() => this.versions() === 'toutes');
  protected readonly numeroPage = computed(() => numeroPageUrl(this.page()));
  protected readonly taillePage = computed(() => taillePageUrl(this.taille()));

  protected readonly sondages = signal<SondageResumeResponse[]>([]);
  protected readonly total = signal(0);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<unknown>(null);

  /** Admin, ou gestionnaire autorisé : le bouton mène à l'éditeur (F5). */
  protected readonly peutCreer = computed(
    () => this.auth.role() === 'ADMIN' || !!this.auth.utilisateur()?.peutCreerSondages,
  );

  protected readonly petitEcran = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 719.98px)')
      .pipe(map((etat) => etat.matches)),
    { initialValue: false },
  );

  constructor() {
    effect(() => {
      const filtre = this.filtreCourant();
      untracked(() => this.charger(filtre));
    });
  }

  /** Réponses affichées : celles de toute la lignée en vue « dernière version », sinon celles de la version. */
  protected nombreReponses(sondage: SondageResumeResponse): number {
    return this.toutesLesVersions() ? sondage.nombreReponses : sondage.nombreReponsesLignee;
  }

  /** « dont N pour la v2 » quand la lignée a reçu des réponses sur d'autres versions. */
  protected aDetailReponses(sondage: SondageResumeResponse): boolean {
    return !this.toutesLesVersions() && sondage.nombreReponses !== sondage.nombreReponsesLignee;
  }

  protected tousLesAssignes(assignes: GestionnaireAssigneResponse[]): string {
    return assignes.map(libelleAssigne).join(', ');
  }

  protected changerVue(toutes: boolean): void {
    void this.router.navigate([], {
      queryParams: { versions: toutes ? 'toutes' : null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected filtrer(statut: StatutSondage | null): void {
    void this.router.navigate([], { queryParams: { statut, page: null }, queryParamsHandling: 'merge' });
  }

  protected changerPage(evenement: PageEvent): void {
    void this.router.navigate([], {
      queryParams: parametresPage(evenement.pageIndex, evenement.pageSize),
      queryParamsHandling: 'merge',
    });
  }

  protected recharger(): void {
    this.charger(this.filtreCourant());
  }

  private filtreCourant(): FiltreSondages {
    return {
      statut: this.statutFiltre(),
      derniereVersion: !this.toutesLesVersions(),
      page: this.numeroPage(),
      taille: this.taillePage(),
    };
  }

  private charger(filtre: FiltreSondages): void {
    this.chargement.set(true);
    this.erreur.set(null);
    this.service
      .lister(filtre)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultat) => {
          this.sondages.set(resultat.contenu);
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
