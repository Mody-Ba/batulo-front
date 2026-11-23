import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AssignationResponse } from '../../../core/models/assignation.model';
import { GestionnaireResponse, nomComplet } from '../../../core/models/gestionnaire.model';
import { AssignationService } from '../../../core/services/assignation.service';
import { GestionnaireService } from '../../../core/services/gestionnaire.service';
import { MessageErreur } from '../../../shared/components/message-erreur/message-erreur';
import { TranslocoPipe } from '@jsverse/transloco';

/** Nombre de gestionnaires actifs lus pour le choix (les plus récents). */
export const LIMITE_GESTIONNAIRES = 100;

export interface DonneesAssignerGestionnaires {
  sondageId: number;
  titre: string;
  /** Déjà assignés : non proposés. */
  dejaAssignes: number[];
  /** Créateur de cette version : non proposé (409 GESTIONNAIRE_CREATEUR). */
  createurId: number | null;
}

/**
 * Assigne un sondage (toute sa lignée) à un ou plusieurs gestionnaires actifs, en un seul appel.
 * Se ferme avec la liste à jour des assignations.
 */
@Component({
  selector: 'app-dialogue-assigner-gestionnaires',
  imports: [TranslocoPipe, FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatListModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MessageErreur,
  ],
  template: `
    <h2 mat-dialog-title>{{ 'sondages.fiche.assigner' | transloco }}</h2>
    <mat-dialog-content>
      <p class="texte-aide">
        {{ 'assignation.aideSondage' | transloco: { titre: donnees.titre } }}
      </p>
      @if (chargement()) {
        <mat-progress-bar mode="indeterminate" [attr.aria-label]="'gestionnaires.liste.chargement' | transloco" />
      }
      <app-message-erreur [erreur]="erreur()" />

      @if (!chargement() && candidats().length === 0 && !erreurChargement()) {
        <p class="etat-vide">{{ 'assignation.aucunAutreGestionnaire' | transloco }}</p>
      } @else if (candidats().length) {
        <mat-selection-list
          class="liste"
          [ngModel]="selection()"
          (ngModelChange)="selection.set($event)"
          [attr.aria-label]="'assignation.gestionnairesAAssigner' | transloco"
          [disabled]="enCours()"
        >
          @for (g of candidats(); track g.id) {
            <mat-list-option [value]="g.id" togglePosition="before">
              <span matListItemTitle>{{ nomComplet(g) }}</span>
              <span matListItemLine>{{ g.courriel }}</span>
            </mat-list-option>
          }
        </mat-selection-list>
      }
      <app-message-erreur [erreur]="erreurChargement()" [parDefaut]="'gestionnaires.liste.erreur' | transloco" />
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" mat-dialog-close [disabled]="enCours()">{{ 'commun.annuler' | transloco }}</button>
      <button
        matButton="filled"
        type="button"
        class="bouton-principal"
        (click)="assigner()"
        [disabled]="enCours() || selection().length === 0"
      >
        @if (enCours()) {
          <mat-spinner diameter="20" [attr.aria-label]="'assignation.enCours' | transloco" />
        } @else {
          {{ 'assignation.assigner' | transloco }}{{ selection().length ? ' (' + selection().length + ')' : '' }}
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .liste {
      max-height: min(50vh, 420px);
      overflow-y: auto;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--bt-rayon);
    }
  `,
})
export class DialogueAssignerGestionnaires {
  private readonly gestionnaireService = inject(GestionnaireService);
  private readonly assignationService = inject(AssignationService);
  private readonly reference =
    inject<MatDialogRef<DialogueAssignerGestionnaires, AssignationResponse[]>>(MatDialogRef);
  protected readonly donnees = inject<DonneesAssignerGestionnaires>(MAT_DIALOG_DATA);
  protected readonly nomComplet = nomComplet;

  private readonly gestionnaires = signal<GestionnaireResponse[]>([]);
  protected readonly chargement = signal(true);
  protected readonly erreurChargement = signal<unknown>(null);
  protected readonly selection = signal<number[]>([]);
  protected readonly enCours = signal(false);
  protected readonly erreur = signal<unknown>(null);

  /** Ni déjà assignés ni créateur de cette version (les actifs sont filtrés par le backend). */
  protected readonly candidats = computed(() => {
    const exclus = new Set([...this.donnees.dejaAssignes, this.donnees.createurId]);
    return this.gestionnaires().filter((g) => !exclus.has(g.id));
  });

  constructor() {
    // Un gestionnaire désactivé ne peut pas être assigné (409) : le backend ne renvoie que les actifs.
    this.gestionnaireService.lister({ actif: true, taille: LIMITE_GESTIONNAIRES }).subscribe({
      next: (page) => {
        this.gestionnaires.set(page.contenu);
        this.chargement.set(false);
      },
      error: (erreur: unknown) => {
        this.erreurChargement.set(erreur);
        this.chargement.set(false);
      },
    });
  }

  protected assigner(): void {
    if (!this.selection().length || this.enCours()) {
      return;
    }
    this.enCours.set(true);
    this.erreur.set(null);
    this.reference.disableClose = true;
    this.assignationService.assigner(this.donnees.sondageId, this.selection()).subscribe({
      next: (assignations) => this.reference.close(assignations),
      error: (erreur: unknown) => {
        this.enCours.set(false);
        this.reference.disableClose = false;
        this.erreur.set(erreur);
      },
    });
  }
}
