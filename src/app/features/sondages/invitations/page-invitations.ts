import { BreakpointObserver } from '@angular/cdk/layout';
import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { debounceTime, distinctUntilChanged, filter, forkJoin, interval, map, Observable, Subscription, switchMap } from 'rxjs';
import { DateLPipe, NombreLPipe, PlurielPipe } from '../../../core/i18n/formats.pipes';
import { traduire, traduireSiConnu, traduirePluriel } from '../../../core/i18n/traduire';
import {
  InvitationResponse,
  LIBELLES_STATUT_INVITATION,
  nomInvite,
  RapportEnvoiResponse,
  RapportImportResponse,
  ResumeInvitationsResponse,
  STATUTS_INVITATION,
  StatutInvitation,
} from '../../../core/models/invitation.model';
import { PageResponse } from '../../../core/models/page.model';
import { classeEtatSondage, libelleEtatSondage, SondageResponse, VersionResponse } from '../../../core/models/sondage.model';
import { LangueContenu, LIBELLES_LANGUE } from '../../../core/models/traduction.model';
import { AuthService } from '../../../core/services/auth.service';
import { ExportService } from '../../../core/services/export.service';
import { InvitationService } from '../../../core/services/invitation.service';
import { SondageService } from '../../../core/services/sondage.service';
import { aLeCode, messageErreur } from '../../../core/utils/erreur-http';
import { interrogationPeriodique } from '../../../core/utils/interrogation';
import { numeroPageUrl, parametresPage, taillePageUrl, TAILLES_PAGE } from '../../../core/utils/pagination-url';
import { DELAI_RECHERCHE_MS } from '../../../core/utils/recherche';
import { confirmer } from '../../../shared/components/dialogue-confirmation/dialogue-confirmation';
import { Encadre } from '../../../shared/components/encadre/encadre';
import { EntetePage } from '../../../shared/components/entete-page/entete-page';
import { MessageErreur } from '../../../shared/components/message-erreur/message-erreur';
import { OngletsSondage } from '../onglets-sondage/onglets-sondage';
import { DialogueImport, DonneesDialogueImport } from './dialogue-import';
import { DialogueInvite, DonneesDialogueInvite } from './dialogue-invite';
import { DialogueReprise, DonneesDialogueReprise } from './dialogue-reprise';
import { ouvertureEnvoi, raisonEnvoiImpossible, raisonRelanceImpossible } from './regles-envoi';

/** Suivi pendant un envoi en arrière-plan : relecture toutes les 3 s, au plus 10 min. */
export const INTERVALLE_SUIVI_MS = 3000;
export const DUREE_SUIVI_MAX_MS = 10 * 60_000;
/** Après un 429 LIMITE_ENVOIS, les envois sont bloqués pour cette visite pendant une heure. */
export const DUREE_BLOCAGE_LIMITE_MS = 3_600_000;

/** Résultat d'un envoi ou d'une relance, affiché au-dessus du tableau. */
interface ResultatEnvoi {
  type: 'envoi' | 'relance';
  rapport: RapportEnvoiResponse;
}

/**
 * Onglet « Invitations » (/sondages/:id/invitations[?statut&recherche&page&taille]) : liste nominative de la lignée.
 * Compteurs, tableau des invités (recherche, filtre par statut, sélection multiple gardée d'une page à l'autre), ajout,
 * modification, suppression et révocation, import CSV, reprise de la liste d'un autre sondage, envoi et relance (202 :
 * relecture périodique tant qu'un envoi est en cours), export du suivi. Accès : tous ceux qui voient le sondage ;
 * écritures désactivées en lecture seule.
 */
@Component({
  selector: 'app-page-invitations',
  imports: [
    TranslocoPipe,
    PlurielPipe,
    DateLPipe,
    NombreLPipe,
    NgTemplateOutlet,
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatTableModule,
    EntetePage,
    Encadre,
    MessageErreur,
    OngletsSondage,
  ],
  templateUrl: './page-invitations.html',
  styleUrl: './page-invitations.scss',
})
export class PageInvitations {
  private readonly service = inject(InvitationService);
  private readonly sondages = inject(SondageService);
  private readonly exports = inject(ExportService);
  protected readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly battements = (ms: number) => interrogationPeriodique(ms, this.document);
  protected readonly tailles = [...TAILLES_PAGE];
  protected readonly statuts = STATUTS_INVITATION;
  protected readonly libelleStatut = (s: StatutInvitation) => LIBELLES_STATUT_INVITATION[s];
  protected readonly nomLangue = (l: LangueContenu) => LIBELLES_LANGUE[l];
  protected readonly nomInvite = nomInvite;
  protected readonly libelleEtat = libelleEtatSondage;
  protected readonly classeEtat = classeEtatSondage;
  protected readonly parId = (_index: number, i: InvitationResponse) => i.id;
  protected readonly colonnes = ['selection', 'nom', 'courriel', 'langue', 'statut', 'envoi', 'relance', 'reponse', 'actions'];

  /** Paramètre de route :id et paramètres d'URL ?statut=&recherche=&page=&taille=. */
  readonly id = input.required<string>();
  readonly statut = input<string | undefined>(undefined);
  readonly recherche = input<string | undefined>(undefined);
  readonly page = input<string | undefined>(undefined);
  readonly taille = input<string | undefined>(undefined);

  protected readonly identifiant = computed(() => Number(this.id()));
  protected readonly filtreStatut = computed<StatutInvitation | null>(() => {
    const s = this.statut();
    return STATUTS_INVITATION.includes(s as StatutInvitation) ? (s as StatutInvitation) : null;
  });
  protected readonly termeRecherche = computed(() => this.recherche()?.trim() ?? '');
  protected readonly numeroPage = computed(() => numeroPageUrl(this.page()));
  protected readonly taillePage = computed(() => taillePageUrl(this.taille()));
  /** Champ de recherche ; l'URL reste la source de vérité. */
  protected readonly champRecherche = new FormControl('', { nonNullable: true });

  protected readonly sondage = signal<SondageResponse | null>(null);
  protected readonly versions = signal<VersionResponse[]>([]);
  protected readonly resume = signal<ResumeInvitationsResponse | null>(null);
  protected readonly invitations = signal<PageResponse<InvitationResponse> | null>(null);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<unknown>(null);
  /** Sélection, gardée d'une page et d'un filtre à l'autre (par id). */
  protected readonly selection = signal<ReadonlyMap<number, InvitationResponse>>(new Map());
  protected readonly envoiEnCours = signal(false);
  protected readonly erreurEnvoi = signal<unknown>(null);
  protected readonly resultat = signal<ResultatEnvoi | null>(null);
  protected readonly limiteJusqua = signal<number | null>(null);
  /** Relu chaque minute : les délais (24 h, limite horaire) se débloquent sans recharger. */
  private readonly maintenant = signal(Date.now());
  /** Suivi d'un envoi en arrière-plan en cours. */
  protected readonly suiviActif = signal(false);
  private suivi: Subscription | null = null;

  protected readonly petitEcran = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 719.98px)')
      .pipe(map((etat) => etat.matches)),
    { initialValue: false },
  );

  protected readonly lignes = computed(() => this.invitations()?.contenu ?? []);
  protected readonly selectionnes = computed(() => [...this.selection().values()]);
  protected readonly toutesCochees = computed(() => this.lignes().length > 0 && this.lignes().every((i) => this.selection().has(i.id)));
  protected readonly certainesCochees = computed(() => !this.toutesCochees() && this.lignes().some((i) => this.selection().has(i.id)));
  protected readonly filtre = computed(() => !!this.filtreStatut() || !!this.termeRecherche());
  protected readonly tauxAffiche = computed(() => Math.min(100, Math.max(0, Number(this.resume()?.tauxReponse ?? 0))));

  private readonly contexteEnvoi = computed(() => ({
    ouverture: ouvertureEnvoi(this.versions().length ? this.versions() : this.sondage() ? [this.sondage()!] : []),
    lectureSeule: this.auth.lectureSeule(),
    limiteJusqua: this.limiteJusqua(),
    resume: this.resume(),
    selection: this.selectionnes(),
    maintenant: this.maintenant(),
  }));
  protected readonly raisonEnvoi = computed(() => (this.sondage() ? raisonEnvoiImpossible(this.contexteEnvoi()) : null));
  protected readonly raisonRelance = computed(() => (this.sondage() ? raisonRelanceImpossible(this.contexteEnvoi()) : null));

  constructor() {
    effect(() => {
      const id = this.identifiant();
      untracked(() => this.chargerSondage(id));
    });
    effect(() => {
      const id = this.identifiant();
      const statut = this.filtreStatut();
      const recherche = this.termeRecherche();
      const page = this.numeroPage();
      const taille = this.taillePage();
      untracked(() => this.charger(id, statut, recherche, page, taille));
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
        map((v) => v.trim()),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe((terme) => {
        if (terme !== this.termeRecherche()) {
          this.naviguer({ recherche: terme || null, page: null });
        }
      });
    interval(60_000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.maintenant.set(Date.now()));
    this.destroyRef.onDestroy(() => this.arreterSuivi());
  }

  protected recharger(): void {
    this.charger(this.identifiant(), this.filtreStatut(), this.termeRecherche(), this.numeroPage(), this.taillePage());
  }

  protected filtrerStatut(statut: StatutInvitation | 'tous' | null | undefined): void {
    // Un nouveau clic sur la pastille choisie la désélectionne dans Material : on la garde.
    if (statut === null || statut === undefined) {
      return;
    }
    this.naviguer({ statut: statut === 'tous' ? null : statut, page: null });
  }

  protected effacerRecherche(): void {
    this.champRecherche.setValue('');
  }

  protected changerPage(evenement: PageEvent): void {
    this.naviguer(parametresPage(evenement.pageIndex, evenement.pageSize));
  }

  // ---------------------------------------------------------------- Sélection

  protected estCoche(i: InvitationResponse): boolean {
    return this.selection().has(i.id);
  }

  protected cocher(i: InvitationResponse, coche: boolean): void {
    this.selection.update((s) => {
      const copie = new Map(s);
      if (coche) {
        copie.set(i.id, i);
      } else {
        copie.delete(i.id);
      }
      return copie;
    });
  }

  protected cocherPage(coche: boolean): void {
    this.selection.update((s) => {
      const copie = new Map(s);
      for (const i of this.lignes()) {
        if (coche) {
          copie.set(i.id, i);
        } else {
          copie.delete(i.id);
        }
      }
      return copie;
    });
  }

  protected viderSelection(): void {
    this.selection.set(new Map());
  }

  // ---------------------------------------------------------------- Actions sur un invité

  protected peutModifier(i: InvitationResponse): boolean {
    return !this.auth.lectureSeule() && i.statut !== 'A_REPONDU' && i.statut !== 'REVOQUEE';
  }

  protected peutSupprimer(i: InvitationResponse): boolean {
    return !this.auth.lectureSeule() && i.statut !== 'A_REPONDU';
  }

  protected peutRevoquer(i: InvitationResponse): boolean {
    return !this.auth.lectureSeule() && i.statut !== 'A_REPONDU' && i.statut !== 'REVOQUEE';
  }

  protected ajouter(): void {
    this.ouvrirInvite({ sondageId: this.identifiant() }, traduire('invitations.actions.ajoute'));
  }

  protected modifier(i: InvitationResponse): void {
    this.ouvrirInvite({ sondageId: this.identifiant(), invitation: i }, traduire('invitations.actions.modifie'));
  }

  protected supprimer(i: InvitationResponse): void {
    this.apresConfirmation(
      {
        titre: traduire('invitations.actions.supprimerTitre'),
        message: traduire('invitations.actions.supprimerMessage', { nom: nomInvite(i) }),
        action: traduire('commun.supprimer'),
        destructive: true,
      },
      () => this.service.supprimer(this.identifiant(), i.id),
      traduire('invitations.actions.supprime'),
      i.id,
    );
  }

  protected revoquer(i: InvitationResponse): void {
    this.apresConfirmation(
      {
        titre: traduire('invitations.actions.revoquerTitre'),
        message: traduire('invitations.actions.revoquerMessage', { nom: nomInvite(i) }),
        action: traduire('invitations.actions.revoquer'),
        destructive: true,
      },
      () => this.service.revoquer(this.identifiant(), i.id),
      traduire('invitations.actions.revoque'),
      i.id,
    );
  }

  protected importer(): void {
    this.dialog
      .open<DialogueImport, DonneesDialogueImport, RapportImportResponse>(DialogueImport, {
        data: { sondageId: this.identifiant() },
        width: '640px',
        maxWidth: 'calc(100vw - 32px)',
      })
      .afterClosed()
      // Le dialogue peut avoir importé un fichier puis été annulé sur un second : on relit toujours.
      .subscribe(() => this.recharger());
  }

  protected reprendre(): void {
    this.dialog
      .open<DialogueReprise, DonneesDialogueReprise, RapportImportResponse>(DialogueReprise, {
        data: { sondageId: this.identifiant(), versionsExclues: this.versions().map((v) => v.id) },
        width: '640px',
        maxWidth: 'calc(100vw - 32px)',
      })
      .afterClosed()
      .pipe(filter((rapport): rapport is RapportImportResponse => !!rapport))
      .subscribe(() => this.recharger());
  }

  protected exporter(): void {
    this.service.exporter(this.identifiant()).subscribe({
      next: (fichier) => this.exports.enregistrer(fichier),
      error: (erreur: unknown) => this.informer(messageErreur(erreur)),
    });
  }

  // ---------------------------------------------------------------- Envoi et relance

  protected envoyer(): void {
    this.lancer('envoi', (ids) => this.service.envoyer(this.identifiant(), ids));
  }

  protected relancer(): void {
    this.lancer('relance', (ids) => this.service.relancer(this.identifiant(), ids));
  }

  /** « 3 ignorés : déjà invités (2), délai de 24 h (1) ». */
  protected resumeIgnorees(rapport: RapportEnvoiResponse): string {
    const parRaison = new Map<string, number>();
    for (const i of rapport.ignorees) {
      parRaison.set(i.raison, (parRaison.get(i.raison) ?? 0) + 1);
    }
    const details = [...parRaison].map(
      ([raison, n]) => `${traduireSiConnu(`invitations.ignorees.${raison}`) ?? raison} (${n})`,
    );
    return `${traduirePluriel('invitations.resultat.ignorees', rapport.ignorees.length)} : ${details.join(', ')}`;
  }

  private lancer(type: ResultatEnvoi['type'], requete: (demande: { invitationIds?: number[] }) => Observable<RapportEnvoiResponse>): void {
    if (this.envoiEnCours() || (type === 'envoi' ? this.raisonEnvoi() : this.raisonRelance())) {
      return;
    }
    const ids = [...this.selection().keys()];
    this.envoiEnCours.set(true);
    this.erreurEnvoi.set(null);
    this.resultat.set(null);
    requete(ids.length ? { invitationIds: ids } : {})
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rapport) => {
          this.envoiEnCours.set(false);
          this.resultat.set({ type, rapport });
          this.viderSelection();
          this.recharger();
          if (rapport.enFile > 0) {
            this.demarrerSuivi();
          }
        },
        error: (erreur: unknown) => {
          this.envoiEnCours.set(false);
          if (aLeCode(erreur, 'LIMITE_ENVOIS')) {
            this.limiteJusqua.set(Date.now() + DUREE_BLOCAGE_LIMITE_MS);
            this.maintenant.set(Date.now());
          }
          this.erreurEnvoi.set(erreur);
        },
      });
  }

  /** Relecture périodique pendant l'envoi en arrière-plan, jusqu'à ce que plus rien ne soit en cours (10 min au plus). */
  protected demarrerSuivi(): void {
    if (this.suivi) {
      return;
    }
    const debut = Date.now();
    this.suiviActif.set(true);
    this.suivi = this.battements(INTERVALLE_SUIVI_MS)
      .pipe(
        switchMap(() =>
          forkJoin({
            page: this.service.lister(this.identifiant(), this.filtreCourant()),
            resume: this.service.resume(this.identifiant()),
          }),
        ),
      )
      .subscribe({
        next: ({ page, resume }) => {
          this.invitations.set(page);
          this.resume.set(resume);
          this.rafraichirSelection(page.contenu);
          if (!page.contenu.some((i) => i.envoiEnCours) || Date.now() - debut > DUREE_SUIVI_MAX_MS) {
            this.arreterSuivi();
          }
        },
        error: () => this.arreterSuivi(),
      });
  }

  private arreterSuivi(): void {
    this.suivi?.unsubscribe();
    this.suivi = null;
    this.suiviActif.set(false);
  }

  // ---------------------------------------------------------------- Chargement

  private charger(id: number, statut: StatutInvitation | null, recherche: string, page: number, taille: number): void {
    this.chargement.set(true);
    this.erreur.set(null);
    forkJoin({
      page: this.service.lister(id, { statut, recherche, page, taille }),
      resume: this.service.resume(id),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ page, resume }) => {
          this.invitations.set(page);
          this.resume.set(resume);
          this.rafraichirSelection(page.contenu);
          this.chargement.set(false);
          if (page.contenu.some((i) => i.envoiEnCours)) {
            this.demarrerSuivi();
          }
        },
        error: (erreur: unknown) => {
          this.erreur.set(erreur);
          this.chargement.set(false);
        },
      });
  }

  private chargerSondage(id: number): void {
    this.sondages
      .detail(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (s) => this.sondage.set(s), error: (e: unknown) => this.erreur.set(e) });
    this.sondages
      .versions(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (v) => this.versions.set(v), error: () => this.versions.set([]) });
  }

  private filtreCourant() {
    return { statut: this.filtreStatut(), recherche: this.termeRecherche(), page: this.numeroPage(), taille: this.taillePage() };
  }

  /** Les invités sélectionnés affichés prennent leur état à jour (statut, dates). */
  private rafraichirSelection(lignes: readonly InvitationResponse[]): void {
    const selection = this.selection();
    if (!lignes.some((i) => selection.has(i.id))) {
      return;
    }
    const copie = new Map(selection);
    for (const i of lignes) {
      if (copie.has(i.id)) {
        copie.set(i.id, i);
      }
    }
    this.selection.set(copie);
  }

  private ouvrirInvite(donnees: DonneesDialogueInvite, succes: string): void {
    this.dialog
      .open<DialogueInvite, DonneesDialogueInvite, InvitationResponse>(DialogueInvite, {
        data: donnees,
        width: '560px',
        maxWidth: 'calc(100vw - 32px)',
      })
      .afterClosed()
      .pipe(filter((i): i is InvitationResponse => !!i))
      .subscribe(() => {
        this.informer(succes);
        this.recharger();
      });
  }

  private apresConfirmation(
    donnees: { titre: string; message: string; action: string; destructive: boolean },
    action: () => Observable<unknown>,
    succes: string,
    invitationId: number,
  ): void {
    confirmer(this.dialog, donnees)
      .pipe(
        filter(Boolean),
        switchMap(() => action()),
      )
      .subscribe({
        next: () => {
          this.informer(succes);
          this.cocher({ id: invitationId } as InvitationResponse, false);
          this.recharger();
        },
        error: (erreur: unknown) => {
          this.informer(messageErreur(erreur));
          this.recharger();
        },
      });
  }

  private naviguer(queryParams: Record<string, unknown>): void {
    void this.router.navigate([], { queryParams, queryParamsHandling: 'merge' });
  }

  private informer(message: string): void {
    this.snackBar.open(message, traduire('commun.fermer'), { duration: 6000 });
  }
}
