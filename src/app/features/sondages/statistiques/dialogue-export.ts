import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { Observable } from 'rxjs';
import { FiltresStatistiques, SeparateurDecimal, ValeursExport } from '../../../core/models/statistiques.model';
import { ExportService, FichierExporte } from '../../../core/services/export.service';
import { MessageErreur } from '../../../shared/components/message-erreur/message-erreur';

export type ChoixExport = 'reponses-csv' | 'reponses-xlsx' | 'statistiques-pdf' | 'statistiques-xlsx';

export interface DonneesExport {
  sondageId: number;
  filtres: FiltresStatistiques;
  /** Filtres en clair (resumeFiltres). */
  resume: string[];
}

/**
 * Exports avec les filtres en cours : réponses brutes en CSV (libellés ou codes ; séparateur pour Excel ou pour
 * Python et R) ou Excel, rapport des statistiques en PDF ou Excel. Le fichier est enregistré sous le nom donné par le
 * backend ; une erreur s'affiche dans la boîte.
 */
@Component({
  selector: 'app-dialogue-export',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatProgressSpinnerModule, MatRadioModule, MessageErreur],
  template: `
    <h2 mat-dialog-title>Exporter</h2>
    <mat-dialog-content>
      <app-message-erreur [erreur]="erreur()" titre="L’export a échoué" parDefaut="L’export n’a pas pu être créé." />
      <p class="texte-aide">Filtres appliqués : {{ donnees.resume.join(' · ') }}.</p>

      <fieldset>
        <legend>Fichier</legend>
        <mat-radio-group [(ngModel)]="choix" class="colonne" aria-label="Fichier à exporter">
          <mat-radio-button value="statistiques-pdf">Rapport des statistiques (PDF)</mat-radio-button>
          <mat-radio-button value="statistiques-xlsx">Statistiques (Excel : un onglet par question)</mat-radio-button>
          <mat-radio-button value="reponses-csv">Réponses brutes (CSV)</mat-radio-button>
          <mat-radio-button value="reponses-xlsx">Réponses brutes (Excel)</mat-radio-button>
        </mat-radio-group>
      </fieldset>

      @if (choix === 'reponses-csv' || choix === 'reponses-xlsx') {
        <fieldset>
          <legend>Valeurs des choix</legend>
          <mat-radio-group [(ngModel)]="valeurs" class="colonne" aria-label="Valeurs des choix">
            <mat-radio-button value="LIBELLES">Libellés (« Kayes »), pour lire</mat-radio-button>
            <mat-radio-button value="CODES">Codes (« kayes »), pour analyser</mat-radio-button>
          </mat-radio-group>
        </fieldset>
      }
      @if (choix === 'reponses-csv') {
        <fieldset>
          <legend>Format des nombres</legend>
          <mat-radio-group [(ngModel)]="separateur" class="colonne" aria-label="Format des nombres">
            <mat-radio-button value="VIRGULE">Excel en français (« ; » et virgule décimale)</mat-radio-button>
            <mat-radio-button value="POINT">Python, R… (« , » et point décimal)</mat-radio-button>
          </mat-radio-group>
        </fieldset>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" mat-dialog-close [disabled]="enCours()">Annuler</button>
      <button matButton="filled" type="button" class="bouton-principal" (click)="exporter()" [disabled]="enCours()">
        @if (enCours()) {
          <mat-spinner diameter="20" aria-label="Export en cours" />
        } @else {
          Télécharger
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    fieldset {
      margin: var(--bt-espace-4) 0 0;
      padding: 0;
      border: 0;
    }

    legend {
      margin-bottom: var(--bt-espace-1);
      font: var(--mat-sys-title-small);
    }

    .colonne {
      display: flex;
      flex-direction: column;

      mat-radio-button {
        min-height: 44px;
      }
    }
  `,
})
export class DialogueExport {
  private readonly exports = inject(ExportService);
  private readonly reference = inject<MatDialogRef<DialogueExport, boolean>>(MatDialogRef);
  protected readonly donnees = inject<DonneesExport>(MAT_DIALOG_DATA);

  protected choix: ChoixExport = 'statistiques-pdf';
  protected valeurs: ValeursExport = 'LIBELLES';
  protected separateur: SeparateurDecimal = 'VIRGULE';
  protected readonly enCours = signal(false);
  protected readonly erreur = signal<unknown>(null);

  protected exporter(): void {
    this.enCours.set(true);
    this.erreur.set(null);
    this.requete().subscribe({
      next: (fichier) => {
        this.exports.enregistrer(fichier);
        this.reference.close(true);
      },
      error: (erreur: unknown) => {
        this.enCours.set(false);
        this.erreur.set(erreur);
      },
    });
  }

  private requete(): Observable<FichierExporte> {
    const { sondageId, filtres } = this.donnees;
    switch (this.choix) {
      case 'reponses-csv':
        return this.exports.reponses(sondageId, 'CSV', filtres, this.valeurs, this.separateur);
      case 'reponses-xlsx':
        return this.exports.reponses(sondageId, 'XLSX', filtres, this.valeurs);
      case 'statistiques-xlsx':
        return this.exports.statistiques(sondageId, 'XLSX', filtres);
      default:
        return this.exports.statistiques(sondageId, 'PDF', filtres);
    }
  }
}
