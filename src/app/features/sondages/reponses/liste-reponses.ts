import { Component, computed, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, Observable, of, tap } from 'rxjs';
import { PageResponse } from '../../../core/models/page.model';
import { classeEtatSondage, libelleEtatSondage, SondageResponse, VersionResponse } from '../../../core/models/sondage.model';
import { ReponseResponse } from '../../../core/models/statistiques.model';
import { SondageService } from '../../../core/services/sondage.service';
import { messageErreur } from '../../../core/utils/erreur-http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { StatistiquesService } from '../../../core/services/statistiques.service';
import { numeroPageUrl, parametresPage, taillePageUrl, TAILLES_PAGE } from '../../../core/utils/pagination-url';
import { EntetePage } from '../../../shared/components/entete-page/entete-page';
import { MessageErreur } from '../../../shared/components/message-erreur/message-erreur';
import { OngletsSondage } from '../onglets-sondage/onglets-sondage';
import { DialogueReponse, DonneesDialogueReponse } from './dialogue-reponse';
import { DateLPipe } from '../../../core/i18n/formats.pipes';

/**
 * Onglet « Réponses » : réponses de la version affichée, ou de toutes les versions (?lignee=true), les plus récentes
 * d'abord (?page=&taille= dans l'URL) ; chaque réponse indique sa version. Un clic ouvre le détail, question par
 * question, avec les libellés de SA version (contenu relu au besoin, gardé en mémoire).
 */
@Component({
  selector: 'app-liste-reponses',
  imports: [DateLPipe, 
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressBarModule,
    EntetePage,
    MessageErreur,
    OngletsSondage,
  ],
  templateUrl: './liste-reponses.html',
  styleUrl: './liste-reponses.scss',
})
export class ListeReponses {
  private readonly service = inject(StatistiquesService);
  private readonly sondages = inject(SondageService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly tailles = [...TAILLES_PAGE];
  protected readonly libelleEtat = libelleEtatSondage;
  protected readonly classeEtat = classeEtatSondage;

  /** Paramètre de route :id et paramètres d'URL ?lignee=&page=&taille=. */
  readonly id = input.required<string>();
  readonly lignee = input<string | undefined>(undefined);
  protected readonly toutesVersions = computed(() => this.lignee() === 'true');
  readonly page = input<string | undefined>(undefined);
  readonly taille = input<string | undefined>(undefined);

  private readonly identifiant = computed(() => Number(this.id()));
  protected readonly numeroPage = computed(() => numeroPageUrl(this.page()));
  protected readonly taillePage = computed(() => taillePageUrl(this.taille()));

  protected readonly sondage = signal<SondageResponse | null>(null);
  protected readonly versions = signal<VersionResponse[]>([]);
  /** Contenu des autres versions, relu une fois (libellés des options pour le détail). */
  private readonly contenus = new Map<number, SondageResponse>();
  protected readonly reponses = signal<PageResponse<ReponseResponse> | null>(null);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<unknown>(null);

  constructor() {
    effect(() => {
      const id = this.identifiant();
      const page = this.numeroPage();
      const taille = this.taillePage();
      this.toutesVersions();
      untracked(() => this.charger(id, page, taille));
    });
    effect(() => {
      const id = this.identifiant();
      untracked(() =>
        this.sondages
          .versions(id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({ next: (v) => this.versions.set(v), error: () => this.versions.set([]) }),
      );
    });
  }

  protected charger(id = this.identifiant(), page = this.numeroPage(), taille = this.taillePage()): void {
    this.chargement.set(true);
    this.erreur.set(null);
    const sondage = this.sondage();
    forkJoin({
      sondage: sondage?.id === id ? [sondage] : this.sondages.detail(id),
      reponses: this.service.reponses(id, page, taille, this.toutesVersions()),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ sondage, reponses }) => {
          this.sondage.set(sondage);
          this.contenus.set(sondage.id, sondage);
          this.reponses.set(reponses);
          this.chargement.set(false);
        },
        error: (erreur: unknown) => {
          this.erreur.set(erreur);
          this.chargement.set(false);
        },
      });
  }

  protected changerPage(evenement: PageEvent): void {
    void this.router.navigate([], {
      queryParams: parametresPage(evenement.pageIndex, evenement.pageSize),
      queryParamsHandling: 'merge',
    });
  }

  protected changerPortee(toutes: boolean): void {
    void this.router.navigate([], {
      queryParams: { lignee: toutes ? 'true' : null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  /** Détail avec le contenu de la version qui a reçu la réponse (relu si c'est une autre version). */
  protected ouvrir(reponse: ReponseResponse): void {
    this.contenu(reponse.sondageId).subscribe({
      next: (sondage) =>
        this.dialog.open<DialogueReponse, DonneesDialogueReponse>(DialogueReponse, {
          data: { reponse, sondage },
          width: '640px',
          maxWidth: 'calc(100vw - 16px)',
        }),
      error: (erreur: unknown) => this.snackBar.open(messageErreur(erreur), 'Fermer', { duration: 6000 }),
    });
  }

  private contenu(sondageId: number): Observable<SondageResponse> {
    const connu = this.contenus.get(sondageId);
    return connu ? of(connu) : this.sondages.detail(sondageId).pipe(tap((s) => this.contenus.set(sondageId, s)));
  }

  /** « 7 questions répondues sur 9 » (le total n'est connu que pour la version affichée). */
  protected resume(reponse: ReponseResponse, sondage: SondageResponse): string {
    const repondues = reponse.valeurs.length;
    const texte = `${repondues} question${repondues > 1 ? 's' : ''} répondue${repondues > 1 ? 's' : ''}`;
    if (reponse.sondageId !== sondage.id) {
      return texte;
    }
    const total = sondage.sections.reduce((n, s) => n + s.questions.length, 0);
    return `${texte} sur ${total}`;
  }
}
