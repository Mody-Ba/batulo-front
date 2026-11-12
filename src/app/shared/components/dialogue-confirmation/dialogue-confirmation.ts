import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { map, Observable } from 'rxjs';

export interface DonneesConfirmation {
  titre: string;
  message: string;
  /** Libellé du bouton d'action (ex. « Supprimer »). */
  action: string;
  /** Action irréversible ou destructive : bouton rouge. */
  destructive?: boolean;
  /**
   * Confirmation forte : le bouton reste désactivé tant que ce texte n'est pas tapé à l'identique
   * (espaces de début et de fin ignorés, majuscules respectées).
   */
  saisieAttendue?: string;
}

/** La saisie correspond-elle au texte attendu ? */
export function saisieConforme(saisie: string, attendue: string): boolean {
  return saisie.trim() === attendue.trim();
}

/**
 * Boîte de confirmation commune. Le focus va sur « Annuler » : une validation par Entrée
 * ne déclenche jamais l'action par mégarde. Avec `saisieAttendue`, il va sur le champ à remplir.
 */
@Component({
  selector: 'app-dialogue-confirmation',
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>{{ donnees.titre }}</h2>
    <mat-dialog-content>
      <p>{{ donnees.message }}</p>
      @if (donnees.saisieAttendue; as attendue) {
        <p class="consigne" id="consigne-saisie">
          Pour confirmer, tapez <strong class="attendu">{{ attendue }}</strong> ci-dessous.
        </p>
        <mat-form-field class="champ-saisie">
          <mat-label>Texte de confirmation</mat-label>
          <input
            matInput
            autocomplete="off"
            spellcheck="false"
            aria-describedby="consigne-saisie"
            cdkFocusInitial
            [value]="saisie()"
            (input)="saisie.set($any($event.target).value)"
          />
        </mat-form-field>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      @if (donnees.saisieAttendue) {
        <button matButton type="button" [mat-dialog-close]="false">Annuler</button>
      } @else {
        <button matButton type="button" [mat-dialog-close]="false" cdkFocusInitial>Annuler</button>
      }
      <button
        matButton="filled"
        type="button"
        [class.bouton-destructif]="donnees.destructive"
        [disabled]="!confirmable()"
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

    .consigne {
      margin-top: var(--bt-espace-4);
    }

    .attendu {
      overflow-wrap: anywhere;
    }

    .champ-saisie {
      width: 100%;
      margin-top: var(--bt-espace-3);
    }

    .bouton-destructif:not(:disabled) {
      --mat-button-filled-container-color: var(--mat-sys-error);
      --mat-button-filled-label-text-color: var(--mat-sys-on-error);
    }
  `,
})
export class DialogueConfirmation {
  protected readonly donnees = inject<DonneesConfirmation>(MAT_DIALOG_DATA);
  protected readonly saisie = signal('');
  protected readonly confirmable = computed(() => {
    const attendue = this.donnees.saisieAttendue;
    return !attendue || saisieConforme(this.saisie(), attendue);
  });
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
