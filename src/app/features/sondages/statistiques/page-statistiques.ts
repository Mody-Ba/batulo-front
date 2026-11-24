import { Component, computed, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { classeEtatSondage, libelleEtatSondage, SondageResponse, VersionResponse } from '../../../core/models/sondage.model';
import {
  CritereResponse,
  EnvoiStatistiqueResponse,
  FiltresStatistiques,
  StatistiquesResponse,
} from '../../../core/models/statistiques.model';
import { AuthService } from '../../../core/services/auth.service';
import { SondageService } from '../../../core/services/sondage.service';
import { StatistiquesService } from '../../../core/services/statistiques.service';
import { EntetePage } from '../../../shared/components/entete-page/entete-page';
import { MessageErreur } from '../../../shared/components/message-erreur/message-erreur';
import { OngletsSondage } from '../onglets-sondage/onglets-sondage';
import { CarteQuestionStat } from './carte-question-stat';
import { DialogueEnvoiStatistiques, DonneesEnvoi } from './dialogue-envoi-statistiques';
import { DialogueExport, DonneesExport } from './dialogue-export';
import { FiltresStatistiquesComposant } from './filtres-statistiques';
import { filtresDepuisUrl, parametresUrl } from './filtres-url';
import { nombre } from './graphiques/format';
import { resumeFiltres, totalUneVersion } from './resume-filtres';
import { grouperParSection } from './groupes-questions';
import { TableauCroise } from './tableau-croise';
import { DateLPipe } from '../../../core/i18n/formats.pipes';
import { traduire } from '../../../core/i18n/traduire';
import { TranslocoPipe } from '@jsverse/transloco';
import { languesDuSondage, LIBELLES_LANGUE, LangueContenu } from '../../../core/models/traduction.model';
import { PlurielPipe } from '../../../core/i18n/formats.pipes';

/**
 * Onglet « Statistiques » : filtres dans l'URL (?lignee=&du=&au=&granularite=&critere=cle:valeur), résumé, une carte
 * par question, tableau croisé, exports (mêmes filtres) et, pour un gestionnaire sur un sondage terminé, l'envoi à
 * l'admin. Lecture permise avec un abonnement expiré.
 */
@Component({
  selector: 'app-page-statistiques',
  imports: [PlurielPipe, TranslocoPipe, DateLPipe, 
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    EntetePage,
    MessageErreur,
    OngletsSondage,
    CarteQuestionStat,
    FiltresStatistiquesComposant,
    TableauCroise,
  ],
  templateUrl: './page-statistiques.html',
  styleUrl: './page-statistiques.scss',
})
export class PageStatistiques {
  private readonly service = inject(StatistiquesService);
  private readonly sondages = inject(SondageService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly nombre = nombre;
  protected readonly totalUneVersion = totalUneVersion;
  protected readonly libelleEtat = libelleEtatSondage;
  protected readonly classeEtat = classeEtatSondage;
  protected readonly nomLangue = (l: LangueContenu) => LIBELLES_LANGUE[l];

  /** Paramètre de route :id et paramètres d'URL des filtres. */
  readonly id = input.required<string>();
  readonly lignee = input<string | undefined>(undefined);
  readonly du = input<string | undefined>(undefined);
  readonly au = input<string | undefined>(undefined);
  readonly granularite = input<string | undefined>(undefined);
  readonly critere = input<string | string[] | undefined>(undefined);
  readonly langue = input<string | undefined>(undefined);
  readonly langueReponse = input<string | string[] | undefined>(undefined);

  protected readonly identifiant = computed(() => Number(this.id()));
  protected readonly filtres = computed<FiltresStatistiques>(() =>
    filtresDepuisUrl({
      lignee: this.lignee(),
      du: this.du(),
      au: this.au(),
      granularite: this.granularite(),
      critere: this.critere(),
      langue: this.langue(),
      langueReponse: this.langueReponse(),
    }),
  );
  /** Langues du sondage (libellés et filtre par langue de réponse), la principale d'abord. */
  protected readonly languesSondage = computed(() => {
    const s = this.sondage();
    return s ? languesDuSondage(s) : [];
  });

  protected readonly sondage = signal<SondageResponse | null>(null);
  protected readonly versions = signal<VersionResponse[]>([]);
  protected readonly criteres = signal<CritereResponse[]>([]);
  protected readonly statistiques = signal<StatistiquesResponse | null>(null);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<unknown>(null);

  protected readonly groupes = computed(() => grouperParSection(this.statistiques()?.questions ?? []));
  /** Gestionnaire (créateur ou assigné, sinon il ne verrait pas le sondage), sondage terminé. */
  protected readonly peutEnvoyer = computed(
    () => this.auth.role() === 'GESTIONNAIRE' && !!this.sondage()?.publie && this.sondage()?.statut === 'TERMINE',
  );

  constructor() {
    effect(() => {
      const id = this.identifiant();
      untracked(() => this.chargerSondage(id));
    });
    // Les valeurs des critères dépendent de la portée (version ou lignée) ; leurs libellés, de la langue.
    effect(() => {
      const id = this.identifiant();
      const lignee = this.filtres().lignee;
      const langue = this.filtres().langue ?? null;
      untracked(() =>
        this.service
          .criteres(id, lignee, langue)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({ next: (c) => this.criteres.set(c), error: () => this.criteres.set([]) }),
      );
    });
    effect(() => {
      const id = this.identifiant();
      const filtres = this.filtres();
      untracked(() => this.charger(id, filtres));
    });
  }

  protected charger(id = this.identifiant(), filtres = this.filtres()): void {
    this.chargement.set(true);
    this.erreur.set(null);
    this.service
      .statistiques(id, filtres)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (statistiques) => {
          this.statistiques.set(statistiques);
          this.chargement.set(false);
        },
        error: (erreur: unknown) => {
          this.erreur.set(erreur);
          this.chargement.set(false);
        },
      });
  }

  protected changerFiltres(filtres: FiltresStatistiques): void {
    void this.router.navigate([], { queryParams: parametresUrl(filtres), queryParamsHandling: 'merge' });
  }

  protected exporter(sondage: SondageResponse): void {
    this.dialog.open<DialogueExport, DonneesExport>(DialogueExport, {
      data: { sondageId: sondage.id, filtres: this.filtres(), resume: this.resume(sondage) },
      width: '520px',
      maxWidth: 'calc(100vw - 32px)',
    });
  }

  protected envoyer(sondage: SondageResponse): void {
    this.dialog
      .open<DialogueEnvoiStatistiques, DonneesEnvoi, EnvoiStatistiqueResponse>(DialogueEnvoiStatistiques, {
        data: { sondageId: sondage.id, filtres: this.filtres(), resume: this.resume(sondage) },
        width: '560px',
        maxWidth: 'calc(100vw - 32px)',
      })
      .afterClosed()
      .pipe(filter((envoi): envoi is EnvoiStatistiqueResponse => !!envoi))
      .subscribe(() =>
        this.snackBar.open(traduire('statistiques.page.envoyees'), traduire('commun.fermer'), { duration: 6000 }),
      );
  }

  private resume(sondage: SondageResponse): string[] {
    return resumeFiltres(this.filtres(), this.criteres(), sondage.version, this.languesSondage().length > 1);
  }

  private chargerSondage(id: number): void {
    this.sondages
      .detail(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (s) => this.sondage.set(s), error: () => this.sondage.set(null) });
    this.sondages
      .versions(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (v) => this.versions.set(v), error: () => this.versions.set([]) });
  }
}
