import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { map, Observable } from 'rxjs';

export interface DonneesConfirmation {
  titre: string;
  message: string;
  /** Libellé du bouton d'action (ex. « Supprimer »). */
  action: string;
  /** Action irréversible ou destructive : bouton rouge. */
  destructive?: boolean;
}

/**
 * Boîte de confirmation commune. Le focus va sur « Annuler » : une validation par Entrée
 * ne déclenche jamais l'action par mégarde.
 */
@Component({
  selector: 'app-dialogue-confirmation',
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ donnees.titre }}</h2>
    <mat-dialog-content>
      <p>{{ donnees.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" [mat-dialog-close]="false" cdkFocusInitial>Annuler</button>
      <button
        matButton="filled"
        type="button"
        [class.bouton-destructif]="donnees.destructive"
        [mat-dialog-close]="true"
      >
        {{ donnees.action }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    p {
      margin: 0;
    }

    .bouton-destructif {
      --mat-button-filled-container-color: var(--mat-sys-error);
      --mat-button-filled-label-text-color: var(--mat-sys-on-error);
    }
  `,
})
export class DialogueConfirmation {
  protected readonly donnees = inject<DonneesConfirmation>(MAT_DIALOG_DATA);
}

/** Ouvre la confirmation ; émet true seulement si l'utilisateur confirme. */
export function confirmer(dialog: MatDialog, donnees: DonneesConfirmation): Observable<boolean> {
  return dialog
    .open<DialogueConfirmation, DonneesConfirmation, boolean>(DialogueConfirmation, {
      data: donnees,
      width: '440px',
      maxWidth: 'calc(100vw - 32px)',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
    })
    .afterClosed()
    .pipe(map((resultat) => resultat === true));
}
