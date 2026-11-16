import { Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Observable } from 'rxjs';
import { ConditionAffichage, SondageResponse } from '../../../../core/models/sondage.model';
import { resumeCondition } from './condition-editeur';
import { DialogueCondition, DonneesCondition } from './dialogue-condition';

/** Ouvre la boîte de condition ; émet le sondage à jour une fois la condition enregistrée (rien si annulée). */
export function ouvrirDialogueCondition(dialog: MatDialog, donnees: DonneesCondition): Observable<SondageResponse | undefined> {
  return dialog
    .open<DialogueCondition, DonneesCondition, SondageResponse>(DialogueCondition, {
      data: donnees,
      width: '720px',
      maxWidth: 'calc(100vw - 32px)',
      autoFocus: 'first-tabbable',
    })
    .afterClosed();
}

/**
 * Résumé d'une condition d'affichage sur la carte d'une question ou d'une section (icône + « Visible si : … »), avec
 * « Modifier » et « Retirer » tant que le brouillon est modifiable ; en lecture seule, le résumé seul.
 */
@Component({
  selector: 'app-resume-condition',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div class="resume-condition" role="note">
      <mat-icon fontIcon="alt_route" aria-hidden="true" />
      <p><strong>Visible si :</strong> {{ texte() }}</p>
      @if (modifiable()) {
        <span class="actions-condition">
          <button matButton type="button" (click)="modifier.emit()" [attr.aria-label]="'Modifier la condition de ' + nomCible()">
            Modifier
          </button>
          <button matButton type="button" (click)="retirer.emit()" [attr.aria-label]="'Retirer la condition de ' + nomCible()">
            Retirer
          </button>
        </span>
      }
    </div>
  `,
  styles: `
    .resume-condition {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--bt-espace-1) var(--bt-espace-2);
      margin: var(--bt-espace-2) 0;
      padding: var(--bt-espace-2) var(--bt-espace-3);
      border-left: 3px solid var(--mat-sys-tertiary);
      border-radius: 4px;
      background: var(--mat-sys-surface-container);

      mat-icon {
        color: var(--mat-sys-tertiary);
      }

      p {
        flex: 1 1 200px;
        margin: 0;
        overflow-wrap: anywhere;
      }
    }

    .actions-condition {
      display: flex;
      gap: var(--bt-espace-1);
    }
  `,
})
export class ResumeCondition {
  readonly condition = input.required<ConditionAffichage>();
  readonly sondage = input<SondageResponse | null>(null);
  readonly nomCible = input('cette question');
  readonly modifiable = input(false);
  readonly modifier = output<void>();
  readonly retirer = output<void>();

  protected readonly texte = computed(() => resumeCondition(this.condition(), this.sondage()));
}
