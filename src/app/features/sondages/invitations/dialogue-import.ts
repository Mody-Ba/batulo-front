import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { RapportImportResponse } from '../../../core/models/invitation.model';
import { ExportService } from '../../../core/services/export.service';
import { InvitationService } from '../../../core/services/invitation.service';
import { MessageErreur } from '../../../shared/components/message-erreur/message-erreur';
import { estFichierCsv, modeleCsv, NOM_MODELE_CSV } from './modele-csv';
import { RapportImport } from './rapport-import';

export interface DonneesDialogueImport {
  sondageId: number;
}

/**
 * Import d'invités par CSV : zone de dépôt (ou « Choisir un fichier »), modèle téléchargeable, puis rapport des lignes
 * acceptées et refusées avec la raison. Se ferme avec le rapport (la page relit la liste s'il y a des acceptées).
 */
@Component({
  selector: 'app-dialogue-import',
  imports: [TranslocoPipe, MatButtonModule, MatDialogModule, MatIconModule, MessageErreur, RapportImport],
  template: `
    <h2 mat-dialog-title>{{ 'invitations.import.titre' | transloco }}</h2>
    <mat-dialog-content>
      <p class="texte-aide">{{ 'invitations.import.aide' | transloco }}</p>
      <p>
        <button matButton type="button" (click)="telechargerModele()">
          <mat-icon fontIcon="download" aria-hidden="true" />{{ 'invitations.import.modele' | transloco }}
        </button>
      </p>

      @if (rapport(); as r) {
        <app-rapport-import [rapport]="r" mode="import" />
      } @else {
        <div
          class="zone-depot"
          [class.survol]="survol()"
          (dragover)="survoler($event, true)"
          (dragleave)="survoler($event, false)"
          (drop)="deposer($event)"
        >
          <mat-icon fontIcon="upload_file" aria-hidden="true" />
          <p>{{ 'invitations.import.deposer' | transloco }}</p>
          <label class="choisir">
            <input type="file" accept=".csv,text/csv" class="visuellement-cache" (change)="choisir($event)" />
            <span class="bouton-choisir">{{ 'invitations.import.choisir' | transloco }}</span>
          </label>
          @if (fichier(); as f) {
            <p class="fichier" dir="auto">{{ f.name }}</p>
          }
        </div>
        @if (formatInvalide()) {
          <p class="erreur-format" role="alert">{{ 'invitations.import.formatInvalide' | transloco }}</p>
        }
        <app-message-erreur [erreur]="erreur()" [parDefaut]="'invitations.import.erreur' | transloco" />
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      @if (rapport(); as r) {
        <button matButton type="button" (click)="recommencer()">{{ 'invitations.import.autreFichier' | transloco }}</button>
        <button matButton="filled" type="button" (click)="fermer()">{{ 'commun.fermer' | transloco }}</button>
      } @else {
        <button matButton type="button" mat-dialog-close>{{ 'commun.annuler' | transloco }}</button>
        <button matButton="filled" type="button" (click)="importer()" [disabled]="!fichier() || enCours()">
          {{ (enCours() ? 'invitations.import.enCours' : 'invitations.import.importer') | transloco }}
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: `
    .zone-depot {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--bt-espace-2);
      padding: var(--bt-espace-6) var(--bt-espace-4);
      border: 2px dashed var(--mat-sys-outline);
      border-radius: var(--bt-rayon);
      text-align: center;

      &.survol {
        border-color: var(--mat-sys-primary);
        background: var(--mat-sys-primary-container);
      }

      p {
        margin: 0;
      }

      .mat-icon {
        width: 40px;
        height: 40px;
        font-size: 40px;
      }
    }

    .bouton-choisir {
      display: inline-flex;
      align-items: center;
      min-height: 40px;
      padding: 0 var(--bt-espace-4);
      border: 1px solid var(--mat-sys-outline);
      border-radius: 20px;
      color: var(--mat-sys-primary);
      font: var(--mat-sys-label-large);
      cursor: pointer;
    }

    .choisir:focus-within .bouton-choisir {
      outline: 3px solid var(--mat-sys-primary);
      outline-offset: 2px;
    }

    .fichier {
      font: var(--mat-sys-title-small);
      overflow-wrap: anywhere;
    }

    .erreur-format {
      color: var(--mat-sys-error);
    }

    .mat-icon {
      margin-inline-end: var(--bt-espace-1);
      vertical-align: middle;
    }
  `,
})
export class DialogueImport {
  private readonly donnees = inject<DonneesDialogueImport>(MAT_DIALOG_DATA);
  private readonly reference = inject<MatDialogRef<DialogueImport, RapportImportResponse | undefined>>(MatDialogRef);
  private readonly service = inject(InvitationService);
  private readonly exports = inject(ExportService);

  protected readonly fichier = signal<File | null>(null);
  protected readonly survol = signal(false);
  protected readonly formatInvalide = signal(false);
  protected readonly enCours = signal(false);
  protected readonly erreur = signal<unknown>(null);
  protected readonly rapport = signal<RapportImportResponse | null>(null);
  /** Dernier rapport avec des lignes acceptées, rendu à la fermeture (même après « Importer un autre fichier »). */
  private dernierRapport: RapportImportResponse | undefined;

  protected telechargerModele(): void {
    this.exports.enregistrer({ nom: NOM_MODELE_CSV, contenu: modeleCsv() });
  }

  protected survoler(evenement: DragEvent, actif: boolean): void {
    evenement.preventDefault();
    this.survol.set(actif);
  }

  protected deposer(evenement: DragEvent): void {
    evenement.preventDefault();
    this.survol.set(false);
    this.retenir(evenement.dataTransfer?.files?.[0] ?? null);
  }

  protected choisir(evenement: Event): void {
    const champ = evenement.target as HTMLInputElement;
    this.retenir(champ.files?.[0] ?? null);
    champ.value = '';
  }

  protected importer(): void {
    const fichier = this.fichier();
    if (!fichier || this.enCours()) {
      return;
    }
    this.enCours.set(true);
    this.erreur.set(null);
    this.service.importer(this.donnees.sondageId, fichier).subscribe({
      next: (rapport) => {
        this.enCours.set(false);
        this.rapport.set(rapport);
        if (rapport.acceptees > 0) {
          this.dernierRapport = rapport;
        }
      },
      error: (erreur: unknown) => {
        this.enCours.set(false);
        this.erreur.set(erreur);
      },
    });
  }

  protected recommencer(): void {
    this.rapport.set(null);
    this.fichier.set(null);
  }

  protected fermer(): void {
    this.reference.close(this.dernierRapport);
  }

  private retenir(fichier: File | null): void {
    this.erreur.set(null);
    if (!fichier) {
      return;
    }
    const valide = estFichierCsv(fichier);
    this.formatInvalide.set(!valide);
    this.fichier.set(valide ? fichier : null);
  }
}
