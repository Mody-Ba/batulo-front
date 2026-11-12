import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { filter, switchMap } from 'rxjs';
import { GestionnaireResponse, nomComplet } from '../../../../core/models/gestionnaire.model';
import { PageResponse } from '../../../../core/models/page.model';
import {
  classeEtatSondage,
  LIBELLES_RELATION,
  libelleEtatSondage,
  SondageGestionnaireResponse,
} from '../../../../core/models/sondage.model';
import { AssignationService } from '../../../../core/services/assignation.service';
import { AuthService, MESSAGE_LECTURE_SEULE } from '../../../../core/services/auth.service';
import { GestionnaireService } from '../../../../core/services/gestionnaire.service';
import { messageErreur } from '../../../../core/utils/erreur-http';
import { confirmer } from '../../../../shared/components/dialogue-confirmation/dialogue-confirmation';
import { EntetePage } from '../../../../shared/components/entete-page/entete-page';
import { MessageErreur } from '../../../../shared/components/message-erreur/message-erreur';
import { ActionsGestionnaire } from '../actions-gestionnaire';
import {
  DialogueAssignerSondages,
  DonneesAssignerSondages,
} from '../dialogue-assigner-sondages/dialogue-assigner-sondages';

const TAILLE_SONDAGES = 10;

/** Détail d'un gestionnaire : compte, actions, et ses sondages (créés ou assignés). */
@Component({
  selector: 'app-detail-gestionnaire',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSlideToggleModule,
    MatTooltipModule,
    EntetePage,
    MessageErreur,
  ],
  templateUrl: './detail-gestionnaire.html',
  styleUrl: './detail-gestionnaire.scss',
})
export class DetailGestionnaire {
  private readonly service = inject(GestionnaireService);
  private readonly assignationService = inject(AssignationService);
  private readonly actions = inject(ActionsGestionnaire);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly auth = inject(AuthService);
  protected readonly messageLectureSeule = MESSAGE_LECTURE_SEULE;
  protected readonly nomComplet = nomComplet;
  protected readonly libelleEtat = libelleEtatSondage;
  protected readonly classeEtat = classeEtatSondage;
  protected readonly libellesRelation = LIBELLES_RELATION;
  protected readonly tailleSondages = TAILLE_SONDAGES;

  /** Paramètre de route :id. */
  readonly id = input.required<string>();
  private readonly identifiant = computed(() => Number(this.id()));

  protected readonly gestionnaire = signal<GestionnaireResponse | null>(null);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<unknown>(null);
  protected readonly permissionEnCours = signal(false);

  protected readonly sondages = signal<PageResponse<SondageGestionnaireResponse> | null>(null);
  protected readonly pageSondages = signal(0);
  protected readonly chargementSondages = signal(false);
  protected readonly erreurSondages = signal<unknown>(null);

  constructor() {
    effect(() => {
      const id = this.identifiant();
      untracked(() => {
        this.pageSondages.set(0);
        this.charger(id);
        this.chargerSondages();
      });
    });
  }

  protected charger(id = this.identifiant()): void {
    this.chargement.set(true);
    this.erreur.set(null);
    this.service
      .detail(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (g) => {
          this.gestionnaire.set(g);
          this.chargement.set(false);
        },
        error: (erreur: unknown) => {
          this.erreur.set(erreur);
          this.chargement.set(false);
        },
      });
  }

  protected chargerSondages(): void {
    this.chargementSondages.set(true);
    this.erreurSondages.set(null);
    this.service
      .sondages(this.identifiant(), this.pageSondages(), TAILLE_SONDAGES)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.sondages.set(page);
          this.chargementSondages.set(false);
        },
        error: (erreur: unknown) => {
          this.erreurSondages.set(erreur);
          this.chargementSondages.set(false);
        },
      });
  }

  protected changerPageSondages(evenement: PageEvent): void {
    this.pageSondages.set(evenement.pageIndex);
    this.chargerSondages();
  }

  protected modifier(g: GestionnaireResponse): void {
    this.actions.modifier(g).subscribe((maj) => this.gestionnaire.set(maj));
  }

  protected renvoyerMotDePasse(g: GestionnaireResponse): void {
    this.actions.renvoyerMotDePasse(g).subscribe((maj) => this.gestionnaire.set(maj));
  }

  protected basculerActif(g: GestionnaireResponse): void {
    this.actions.basculerActif(g).subscribe((maj) => this.gestionnaire.set(maj));
  }

  protected supprimer(g: GestionnaireResponse): void {
    this.actions.supprimer(g).subscribe(() => void this.router.navigateByUrl('/admin/gestionnaires'));
  }

  protected changerPermission(g: GestionnaireResponse, evenement: MatSlideToggleChange): void {
    this.permissionEnCours.set(true);
    this.gestionnaire.set({ ...g, peutCreerSondages: evenement.checked });
    this.actions.changerPermission(g, evenement.checked).subscribe({
      next: (maj) => {
        this.permissionEnCours.set(false);
        this.gestionnaire.set(maj);
      },
      error: () => {
        this.permissionEnCours.set(false);
        this.gestionnaire.set(g);
        evenement.source.checked = g.peutCreerSondages;
      },
    });
  }

  protected assignerSondages(g: GestionnaireResponse): void {
    this.dialog
      .open<DialogueAssignerSondages, DonneesAssignerSondages, boolean>(DialogueAssignerSondages, {
        data: { gestionnaire: g },
        width: '640px',
        maxWidth: 'calc(100vw - 32px)',
      })
      .afterClosed()
      .pipe(filter(Boolean))
      .subscribe(() => {
        this.snackBar.open('Assignations enregistrées.', 'Fermer', { duration: 5000 });
        this.chargerSondages();
      });
  }

  protected retirerAssignation(g: GestionnaireResponse, sondage: SondageGestionnaireResponse): void {
    confirmer(this.dialog, {
      titre: 'Retirer cette assignation ?',
      message: `${nomComplet(g)} ne verra plus le sondage « ${sondage.titre} » (toutes ses versions). Il en sera notifié.`,
      action: 'Retirer',
      destructive: true,
    })
      .pipe(
        filter(Boolean),
        switchMap(() => this.assignationService.retirer(sondage.id, g.id)),
      )
      .subscribe({
        next: () => {
          this.snackBar.open('Assignation retirée.', 'Fermer', { duration: 5000 });
          this.chargerSondages();
        },
        error: (erreur: unknown) => this.snackBar.open(messageErreur(erreur), 'Fermer', { duration: 6000 }),
      });
  }
}
