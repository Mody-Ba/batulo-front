import { Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { EnvoiStatistiqueResponse, FiltresStatistiques } from '../../../core/models/statistiques.model';
import { StatistiquesService } from '../../../core/services/statistiques.service';
import { MessageErreur } from '../../../shared/components/message-erreur/message-erreur';

/** Longueur maximale du commentaire (message de la messagerie). */
export const COMMENTAIRE_MAX = 2000;

export interface DonneesEnvoi {
  sondageId: number;
  filtres: FiltresStatistiques;
  resume: string[];
}

/**
 * Gestionnaire : envoyer les statistiques d'un sondage terminé à son admin, avec les filtres en cours et un
 * commentaire facultatif (posté dans la conversation avec l'admin, qui est notifié). 409 SONDAGE_NON_TERMINE affiché.
 */
@Component({
  selector: 'app-dialogue-envoi-statistiques',
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatProgressSpinnerModule, MessageErreur],
  template: `
    <h2 mat-dialog-title>Envoyer les statistiques à l’admin</h2>
    <mat-dialog-content>
      <app-message-erreur [erreur]="erreur()" titre="Les statistiques n’ont pas été envoyées" />
      <p class="texte-aide">
        L’admin recevra ces statistiques, recalculées à l’ouverture avec les filtres suivants :
        {{ donnees.resume.join(' · ') }}.
      </p>
      <mat-form-field class="commentaire">
        <mat-label>Commentaire (facultatif)</mat-label>
        <textarea matInput [formControl]="commentaire" rows="4" [maxlength]="max"></textarea>
        <mat-hint align="end">{{ commentaire.value.length }} / {{ max }}</mat-hint>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" mat-dialog-close [disabled]="enCours()">Annuler</button>
      <button matButton="filled" type="button" class="bouton-principal" (click)="envoyer()" [disabled]="enCours()">
        @if (enCours()) {
          <mat-spinner diameter="20" aria-label="Envoi en cours" />
        } @else {
          Envoyer
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .commentaire {
      width: 100%;
      margin-top: var(--bt-espace-3);
    }
  `,
})
export class DialogueEnvoiStatistiques {
  private readonly service = inject(StatistiquesService);
  private readonly reference = inject<MatDialogRef<DialogueEnvoiStatistiques, EnvoiStatistiqueResponse>>(MatDialogRef);
  protected readonly donnees = inject<DonneesEnvoi>(MAT_DIALOG_DATA);
  protected readonly max = COMMENTAIRE_MAX;
  protected readonly commentaire = new FormControl('', { nonNullable: true, validators: Validators.maxLength(COMMENTAIRE_MAX) });
  protected readonly enCours = signal(false);
  protected readonly erreur = signal<unknown>(null);

  protected envoyer(): void {
    const { sondageId, filtres } = this.donnees;
    this.enCours.set(true);
    this.erreur.set(null);
    this.reference.disableClose = true;
    this.service
      .envoyer(sondageId, {
        commentaire: this.commentaire.value.trim() || null,
        lignee: filtres.lignee,
        du: filtres.du,
        au: filtres.au,
        critere: filtres.criteres,
        granulariteDate: filtres.granularite,
      })
      .subscribe({
        next: (envoi) => this.reference.close(envoi),
        error: (erreur: unknown) => {
          this.enCours.set(false);
          this.reference.disableClose = false;
          this.erreur.set(erreur);
        },
      });
  }
}
