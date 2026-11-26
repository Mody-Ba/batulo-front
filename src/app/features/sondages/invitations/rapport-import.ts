import { Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { PlurielPipe } from '../../../core/i18n/formats.pipes';
import { traduireSiConnu } from '../../../core/i18n/traduire';
import { LigneRefusee, RapportImportResponse } from '../../../core/models/invitation.model';

/** Raison d'un refus en clair (clés invitations.refus.*), sinon le message du serveur, sinon le code. */
export function libelleRefus(ligne: Pick<LigneRefusee, 'raison' | 'message'>): string {
  return traduireSiConnu(`invitations.refus.${ligne.raison}`) ?? ligne.message ?? ligne.raison;
}

/**
 * Rapport d'un import CSV ou d'une reprise : lignes acceptées, refusées avec leur raison. Pour une reprise, les adresses
 * déjà invitées (DEJA_INVITE) sont comptées à part comme « ignorées (doublons) ».
 */
@Component({
  selector: 'app-rapport-import',
  imports: [TranslocoPipe, PlurielPipe],
  template: `
    <div class="rapport" role="status">
      <p class="acceptees">{{ (mode() === 'reprise' ? 'invitations.rapport.ajoutees' : 'invitations.rapport.acceptees') | pluriel: rapport().acceptees }}</p>
      @if (mode() === 'reprise' && doublons() > 0) {
        <p>{{ 'invitations.rapport.doublons' | pluriel: doublons() }}</p>
      }
      @if (refusees().length) {
        <p class="refusees">{{ 'invitations.rapport.refusees' | pluriel: refusees().length }}</p>
        <div class="defilement">
          <table>
            <caption class="visuellement-cache">{{ 'invitations.rapport.caption' | transloco }}</caption>
            <thead>
              <tr>
                @if (mode() === 'import') {
                  <th scope="col">{{ 'invitations.rapport.ligne' | transloco }}</th>
                }
                <th scope="col">{{ 'invitations.champs.courriel' | transloco }}</th>
                <th scope="col">{{ 'invitations.rapport.raison' | transloco }}</th>
              </tr>
            </thead>
            <tbody>
              @for (r of refusees(); track $index) {
                <tr>
                  @if (mode() === 'import') {
                    <td>{{ r.ligne }}</td>
                  }
                  <td dir="ltr" class="courriel">{{ r.courriel || '—' }}</td>
                  <td>{{ libelleRefus(r) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: `
    .rapport p {
      margin: 0 0 var(--bt-espace-2);
    }

    .acceptees {
      font: var(--mat-sys-title-small);
      color: var(--bt-succes-texte);
    }

    .refusees {
      color: var(--mat-sys-error);
    }

    .defilement {
      max-height: 280px;
      overflow: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th,
    td {
      padding: var(--bt-espace-1) var(--bt-espace-2);
      border-block-end: 1px solid var(--mat-sys-outline-variant);
      text-align: start;
      vertical-align: top;
    }

    .courriel {
      overflow-wrap: anywhere;
      text-align: start;
    }
  `,
})
export class RapportImport {
  readonly rapport = input.required<RapportImportResponse>();
  readonly mode = input<'import' | 'reprise'>('import');
  protected readonly libelleRefus = libelleRefus;
  protected readonly doublons = computed(() => this.rapport().refusees.filter((r) => r.raison === 'DEJA_INVITE').length);
  /** Reprise : les doublons sont comptés à part ; seules les autres raisons sont listées. */
  protected readonly refusees = computed(() =>
    this.mode() === 'reprise' ? this.rapport().refusees.filter((r) => r.raison !== 'DEJA_INVITE') : this.rapport().refusees,
  );
}
