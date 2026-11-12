import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { catchError, forkJoin, map, of } from 'rxjs';
import { GestionnaireResponse, nomComplet } from '../../../../core/models/gestionnaire.model';
import { libelleEtatSondage, SondageResumeResponse } from '../../../../core/models/sondage.model';
import { AssignationService } from '../../../../core/services/assignation.service';
import { GestionnaireService } from '../../../../core/services/gestionnaire.service';
import { SondageService } from '../../../../core/services/sondage.service';
import { messageErreur } from '../../../../core/utils/erreur-http';
import { MessageErreur } from '../../../../shared/components/message-erreur/message-erreur';

/** Nombre de sondages proposés (les plus récemment modifiés). */
export const LIMITE_SONDAGES = 100;

export interface DonneesAssignerSondages {
  gestionnaire: GestionnaireResponse;
}

export interface ResultatAssignation {
  sondage: SondageResumeResponse;
  /** null : assigné ; sinon le message d'erreur du serveur. */
  erreur: string | null;
}

/** Normalise pour la recherche : minuscules, sans accents. */
function normaliser(texte: string): string {
  return texte.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/**
 * Assigne un ou plusieurs sondages à un gestionnaire : un appel par sondage, une erreur sur l'un
 * (GESTIONNAIRE_CREATEUR...) n'empêche pas les autres. Se ferme avec true si au moins un a réussi.
 */
@Component({
  selector: 'app-dialogue-assigner-sondages',
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatListModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MessageErreur,
  ],
  templateUrl: './dialogue-assigner-sondages.html',
  styleUrl: './dialogue-assigner-sondages.scss',
})
export class DialogueAssignerSondages {
  private readonly sondageService = inject(SondageService);
  private readonly gestionnaireService = inject(GestionnaireService);
  private readonly assignationService = inject(AssignationService);
  private readonly reference = inject<MatDialogRef<DialogueAssignerSondages, boolean>>(MatDialogRef);
  protected readonly gestionnaire = inject<DonneesAssignerSondages>(MAT_DIALOG_DATA).gestionnaire;
  protected readonly nomComplet = nomComplet;
  protected readonly libelleEtat = libelleEtatSondage;
  protected readonly limite = LIMITE_SONDAGES;

  protected readonly chargement = signal(true);
  protected readonly erreurChargement = signal<unknown>(null);
  protected readonly candidats = signal<SondageResumeResponse[]>([]);
  protected readonly totalSondages = signal(0);
  protected readonly recherche = signal('');
  protected readonly selection = signal<number[]>([]);
  protected readonly enCours = signal(false);
  protected readonly resultats = signal<ResultatAssignation[] | null>(null);

  protected readonly candidatsFiltres = computed(() => {
    const terme = normaliser(this.recherche().trim());
    return terme ? this.candidats().filter((s) => normaliser(s.titre).includes(terme)) : this.candidats();
  });
  protected readonly echecs = computed(() => this.resultats()?.filter((r) => r.erreur) ?? []);
  protected readonly reussis = computed(() => this.resultats()?.filter((r) => !r.erreur).length ?? 0);

  constructor() {
    this.charger();
  }

  protected charger(): void {
    this.chargement.set(true);
    this.erreurChargement.set(null);
    forkJoin({
      // Une ligne par sondage : l'assignation porte sur toute la lignée.
      sondages: this.sondageService.lister({ derniereVersion: true, taille: LIMITE_SONDAGES }),
      siens: this.gestionnaireService.sondages(this.gestionnaire.id, 0, LIMITE_SONDAGES),
    }).subscribe({
      next: ({ sondages, siens }) => {
        // Déjà vus par lui (créés ou assignés) : rien à assigner.
        const dejaVus = new Set(siens.contenu.map((s) => s.id));
        this.candidats.set(
          sondages.contenu.filter((s) => !dejaVus.has(s.id) && s.creePar?.id !== this.gestionnaire.id),
        );
        this.totalSondages.set(sondages.totalElements);
        this.chargement.set(false);
      },
      error: (erreur: unknown) => {
        this.erreurChargement.set(erreur);
        this.chargement.set(false);
      },
    });
  }

  protected assigner(): void {
    const choisis = this.candidats().filter((s) => this.selection().includes(s.id));
    if (!choisis.length || this.enCours()) {
      return;
    }
    this.enCours.set(true);
    this.reference.disableClose = true;
    forkJoin(
      choisis.map((sondage) =>
        this.assignationService.assigner(sondage.id, [this.gestionnaire.id]).pipe(
          map((): ResultatAssignation => ({ sondage, erreur: null })),
          catchError((erreur: unknown) => of<ResultatAssignation>({ sondage, erreur: messageErreur(erreur) })),
        ),
      ),
    ).subscribe((resultats) => {
      this.enCours.set(false);
      this.reference.disableClose = false;
      if (resultats.every((r) => !r.erreur)) {
        this.reference.close(true);
        return;
      }
      // Échec partiel ou total : on montre le détail ; les réussis sortent de la liste.
      this.resultats.set(resultats);
      const reussis = new Set(resultats.filter((r) => !r.erreur).map((r) => r.sondage.id));
      this.candidats.update((liste) => liste.filter((s) => !reussis.has(s.id)));
      this.selection.update((ids) => ids.filter((id) => !reussis.has(id)));
    });
  }

  protected fermer(): void {
    this.reference.close(this.reussis() > 0);
  }
}
