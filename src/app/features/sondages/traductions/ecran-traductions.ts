import { TextFieldModule } from '@angular/cdk/text-field';
import { Component, computed, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { PlurielPipe } from '../../../core/i18n/formats.pipes';
import { forkJoin, Observable, of } from 'rxjs';
import { definitionLangue, estLangue } from '../../../core/i18n/langues';
import { traduire } from '../../../core/i18n/traduire';
import { SondageResponse } from '../../../core/models/sondage.model';
import {
  LangueContenu,
  LIBELLES_LANGUE,
  TexteTraduction,
  TraductionsLangueResponse,
} from '../../../core/models/traduction.model';
import { AuthService } from '../../../core/services/auth.service';
import { SondageService } from '../../../core/services/sondage.service';
import { TraductionService } from '../../../core/services/traduction.service';
import { confirmer } from '../../../shared/components/dialogue-confirmation/dialogue-confirmation';
import { Encadre } from '../../../shared/components/encadre/encadre';
import { MessageErreur } from '../../../shared/components/message-erreur/message-erreur';
import { raisonLectureSeule } from '../droits-sondage';
import type { PeutQuitter } from '../editeur/editeur-sondage';
import { grouperTraductions, libelleChamp, texteLong } from './groupes-traductions';

/**
 * Écran « Traductions » d'une langue supplémentaire (/sondages/:id/traductions/:langue[?manquants=true]) : texte
 * principal en lecture seule à gauche, traduction à droite (dir de la langue traduite), regroupés par section et
 * question. Complétude en direct, filtre « seulement les textes manquants », enregistrement en une fois des seuls
 * textes modifiés (PUT, vide = effacé). Écriture : brouillon et droits de modification ; sinon lecture seule.
 */
@Component({
  selector: 'app-ecran-traductions',
  imports: [
    TranslocoPipe,
    PlurielPipe,
    RouterLink,
    TextFieldModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    Encadre,
    MessageErreur,
  ],
  templateUrl: './ecran-traductions.html',
  styleUrl: './ecran-traductions.scss',
  host: { '(window:beforeunload)': 'avantDechargement($event)' },
})
export class EcranTraductions implements PeutQuitter {
  private readonly sondages = inject(SondageService);
  private readonly service = inject(TraductionService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly libelleChamp = libelleChamp;
  protected readonly texteLong = texteLong;
  protected readonly nomLangue = (l: LangueContenu) => LIBELLES_LANGUE[l];
  protected readonly dir = (l: LangueContenu) => definitionLangue(l).dir;

  /** Paramètres de route :id, :langue et ?manquants=true. */
  readonly id = input.required<string>();
  readonly langue = input.required<string>();
  readonly manquants = input<string | undefined>(undefined);

  protected readonly sondage = signal<SondageResponse | null>(null);
  protected readonly donnees = signal<TraductionsLangueResponse | null>(null);
  /** Saisies en cours, par clé (initialisées avec les traductions enregistrées). */
  protected readonly saisies = signal<Readonly<Record<string, string>>>({});
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<unknown>(null);
  protected readonly enregistrement = signal(false);
  protected readonly erreurEnregistrement = signal<unknown>(null);
  protected readonly succes = signal<string | null>(null);
  /** Filtre « seulement les textes manquants » : clés manquantes au moment où il a été coché (elles restent visibles pendant la saisie). */
  protected readonly filtreManquants = signal<ReadonlySet<string> | null>(null);

  protected readonly langueValide = computed<LangueContenu | null>(() => {
    const l = this.langue();
    return estLangue(l) ? l : null;
  });
  protected readonly raisonLectureSeule = computed(() => {
    const s = this.sondage();
    return s
      ? raisonLectureSeule(s, { role: this.auth.role(), utilisateur: this.auth.utilisateur(), lectureSeule: this.auth.lectureSeule() })
      : null;
  });
  protected readonly modifiable = computed(() => !!this.sondage() && !!this.donnees() && this.raisonLectureSeule() === null);
  /** Autres langues supplémentaires du sondage (liens vers leur écran). */
  protected readonly autresLangues = computed(() =>
    (this.sondage()?.languesSupplementaires ?? []).filter((l) => l !== this.langueValide()),
  );

  private readonly textes = computed(() => this.donnees()?.textes ?? []);
  protected readonly total = computed(() => this.textes().length);
  protected readonly traduits = computed(() => {
    const saisies = this.saisies();
    return this.textes().filter((t) => (saisies[t.cle] ?? '').trim() !== '').length;
  });
  protected readonly pourcentage = computed(() => (this.total() ? Math.round((this.traduits() / this.total()) * 100) : 100));
  /** Textes dont la saisie diffère de la traduction enregistrée. */
  protected readonly modifies = computed(() => {
    const saisies = this.saisies();
    return this.textes().filter((t) => (saisies[t.cle] ?? '').trim() !== (t.traduction ?? '').trim());
  });
  protected readonly groupes = computed(() => {
    const filtre = this.filtreManquants();
    const groupes = grouperTraductions(this.textes());
    return filtre
      ? groupes.map((g) => ({ ...g, textes: g.textes.filter((t) => filtre.has(t.cle)) })).filter((g) => g.textes.length > 0)
      : groupes;
  });

  constructor() {
    effect(() => {
      const id = Number(this.id());
      const langue = this.langueValide();
      untracked(() => this.charger(id, langue));
    });
  }

  protected charger(id = Number(this.id()), langue = this.langueValide()): void {
    this.chargement.set(true);
    this.erreur.set(null);
    this.succes.set(null);
    forkJoin({
      sondage: this.sondages.detail(id),
      traductions: langue ? this.service.traductions(id, langue) : of(null),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ sondage, traductions }) => {
          this.sondage.set(sondage);
          this.appliquer(traductions);
          if (traductions && this.manquants() === 'true') {
            this.filtreManquants.set(this.clesManquantes());
          }
          this.chargement.set(false);
        },
        error: (erreur: unknown) => {
          this.erreur.set(erreur);
          this.chargement.set(false);
        },
      });
  }

  protected saisie(texte: TexteTraduction): string {
    return this.saisies()[texte.cle] ?? '';
  }

  protected changer(texte: TexteTraduction, valeur: string): void {
    this.saisies.update((s) => ({ ...s, [texte.cle]: valeur }));
    this.succes.set(null);
  }

  protected basculerFiltre(actif: boolean): void {
    this.filtreManquants.set(actif ? this.clesManquantes() : null);
  }

  protected manquant(texte: TexteTraduction): boolean {
    return this.saisie(texte).trim() === '';
  }

  /** En une fois : seulement les textes modifiés ; vide = traduction effacée. */
  protected enregistrer(): void {
    const donnees = this.donnees();
    const langue = this.langueValide();
    const modifies = this.modifies();
    if (!donnees || !langue || this.enregistrement() || !this.modifiable()) {
      return;
    }
    if (!modifies.length) {
      this.succes.set(traduire('traductions.rienAEnregistrer'));
      return;
    }
    const saisies = this.saisies();
    this.enregistrement.set(true);
    this.erreurEnregistrement.set(null);
    this.succes.set(null);
    this.service
      .enregistrer(donnees.sondageId, langue, {
        textes: modifies.map((t) => ({ cle: t.cle, traduction: (saisies[t.cle] ?? '').trim() || null })),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (reponse) => {
          this.enregistrement.set(false);
          this.appliquer(reponse);
          this.succes.set(traduire('traductions.enregistrees', { traduits: reponse.traduits, total: reponse.total }));
        },
        error: (erreur: unknown) => {
          this.enregistrement.set(false);
          this.erreurEnregistrement.set(erreur);
        },
      });
  }

  peutQuitter(): Observable<boolean> {
    if (!this.modifies().length) {
      return of(true);
    }
    return confirmer(this.dialog, {
      titre: traduire('traductions.quitterTitre'),
      message: traduire('traductions.quitterMessage'),
      action: traduire('traductions.quitter'),
      destructive: true,
    });
  }

  protected avantDechargement(evenement: BeforeUnloadEvent): void {
    if (this.modifies().length) {
      evenement.preventDefault();
    }
  }

  private appliquer(traductions: TraductionsLangueResponse | null): void {
    this.donnees.set(traductions);
    const saisies: Record<string, string> = {};
    for (const t of traductions?.textes ?? []) {
      saisies[t.cle] = t.traduction ?? '';
    }
    this.saisies.set(saisies);
  }

  private clesManquantes(): ReadonlySet<string> {
    return new Set(this.textes().filter((t) => this.manquant(t)).map((t) => t.cle));
  }
}
