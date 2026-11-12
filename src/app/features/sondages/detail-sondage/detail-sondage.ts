import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { filter, switchMap } from 'rxjs';
import { AssignationResponse } from '../../../core/models/assignation.model';
import { nomComplet } from '../../../core/models/gestionnaire.model';
import {
  classeEtatSondage,
  libelleEtatSondage,
  SondageResponse,
  SuiviCollecteResponse,
  VersionResponse,
} from '../../../core/models/sondage.model';
import { AssignationService } from '../../../core/services/assignation.service';
import { AuthService, MESSAGE_LECTURE_SEULE } from '../../../core/services/auth.service';
import { SondageService } from '../../../core/services/sondage.service';
import { messageErreur } from '../../../core/utils/erreur-http';
import { confirmer } from '../../../shared/components/dialogue-confirmation/dialogue-confirmation';
import { EntetePage } from '../../../shared/components/entete-page/entete-page';
import { MessageErreur } from '../../../shared/components/message-erreur/message-erreur';
import {
  DialogueAssignerGestionnaires,
  DonneesAssignerGestionnaires,
} from '../dialogue-assigner-gestionnaires/dialogue-assigner-gestionnaires';

/**
 * Détail d'un sondage en lecture seule (l'édition arrive en F5) : informations, collecte, versions
 * et, pour l'admin, les gestionnaires assignés (assigner, retirer).
 */
@Component({
  selector: 'app-detail-sondage',
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTooltipModule,
    EntetePage,
    MessageErreur,
  ],
  templateUrl: './detail-sondage.html',
  styleUrl: './detail-sondage.scss',
})
export class DetailSondage {
  private readonly service = inject(SondageService);
  private readonly assignationService = inject(AssignationService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly auth = inject(AuthService);
  protected readonly messageLectureSeule = MESSAGE_LECTURE_SEULE;
  protected readonly nomComplet = nomComplet;
  protected readonly libelleEtat = libelleEtatSondage;
  protected readonly classeEtat = classeEtatSondage;

  /** Paramètre de route :id. */
  readonly id = input.required<string>();
  private readonly identifiant = computed(() => Number(this.id()));

  protected readonly estAdmin = computed(() => this.auth.role() === 'ADMIN');

  protected readonly sondage = signal<SondageResponse | null>(null);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<unknown>(null);
  protected readonly collecte = signal<SuiviCollecteResponse | null>(null);
  protected readonly versions = signal<VersionResponse[]>([]);
  protected readonly assignations = signal<AssignationResponse[]>([]);
  protected readonly chargementAssignations = signal(false);
  protected readonly erreurAssignations = signal<unknown>(null);

  constructor() {
    effect(() => {
      const id = this.identifiant();
      untracked(() => this.charger(id));
    });
  }

  protected charger(id = this.identifiant()): void {
    this.chargement.set(true);
    this.erreur.set(null);
    this.collecte.set(null);
    this.versions.set([]);
    this.service
      .detail(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sondage) => {
          this.sondage.set(sondage);
          this.chargement.set(false);
        },
        error: (erreur: unknown) => {
          this.sondage.set(null);
          this.erreur.set(erreur);
          this.chargement.set(false);
        },
      });
    // Compléments : une erreur n'empêche pas d'afficher le reste.
    this.service
      .collecte(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (c) => this.collecte.set(c), error: () => this.collecte.set(null) });
    this.service
      .versions(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (v) => this.versions.set(v), error: () => this.versions.set([]) });
    if (this.estAdmin()) {
      this.chargerAssignations(id);
    }
  }

  protected chargerAssignations(id = this.identifiant()): void {
    this.chargementAssignations.set(true);
    this.erreurAssignations.set(null);
    this.assignationService
      .lister(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (liste) => {
          this.assignations.set(liste);
          this.chargementAssignations.set(false);
        },
        error: (erreur: unknown) => {
          this.erreurAssignations.set(erreur);
          this.chargementAssignations.set(false);
        },
      });
  }

  protected assigner(sondage: SondageResponse): void {
    this.dialog
      .open<DialogueAssignerGestionnaires, DonneesAssignerGestionnaires, AssignationResponse[]>(
        DialogueAssignerGestionnaires,
        {
          data: {
            sondageId: sondage.id,
            titre: sondage.titre,
            dejaAssignes: this.assignations().map((a) => a.gestionnaireId),
            createurId: sondage.creePar?.id ?? null,
          },
          width: '560px',
          maxWidth: 'calc(100vw - 32px)',
        },
      )
      .afterClosed()
      .pipe(filter((liste): liste is AssignationResponse[] => !!liste))
      .subscribe((liste) => {
        this.assignations.set(liste);
        this.snackBar.open('Assignations enregistrées.', 'Fermer', { duration: 5000 });
      });
  }

  protected retirer(sondage: SondageResponse, assignation: AssignationResponse): void {
    confirmer(this.dialog, {
      titre: 'Retirer cette assignation ?',
      message: `${nomComplet(assignation)} ne verra plus « ${sondage.titre} » (toutes ses versions), sauf s’il en a créé une. Il en sera notifié.`,
      action: 'Retirer',
      destructive: true,
    })
      .pipe(
        filter(Boolean),
        switchMap(() => this.assignationService.retirer(sondage.id, assignation.gestionnaireId)),
      )
      .subscribe({
        next: () => {
          this.assignations.update((liste) =>
            liste.filter((a) => a.gestionnaireId !== assignation.gestionnaireId),
          );
          this.snackBar.open('Assignation retirée.', 'Fermer', { duration: 5000 });
        },
        error: (erreur: unknown) => this.snackBar.open(messageErreur(erreur), 'Fermer', { duration: 6000 }),
      });
  }
}
