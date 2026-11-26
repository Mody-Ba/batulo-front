import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';
import { EMPTY, expand, reduce } from 'rxjs';
import { RapportImportResponse } from '../../../core/models/invitation.model';
import { libelleEtatSondage, SondageResumeResponse } from '../../../core/models/sondage.model';
import { InvitationService } from '../../../core/services/invitation.service';
import { SondageService } from '../../../core/services/sondage.service';
import { MessageErreur } from '../../../shared/components/message-erreur/message-erreur';
import { RapportImport } from './rapport-import';

export interface DonneesDialogueReprise {
  sondageId: number;
  /** Ids des versions de ce sondage (même lignée : 400 REPRISE_INVALIDE), exclues des sources. */
  versionsExclues: number[];
}

/** Taille des pages lues pour la liste des sources, et nombre maximal de pages. */
const TAILLE_SOURCES = 100;
const PAGES_SOURCES_MAX = 10;

/**
 * « Reprendre la liste d'un autre sondage » (POST .../invitations/reprendre) : sources = sondages de l'entreprise que
 * l'utilisateur voit (une ligne par lignée), sauf celui-ci. Copie l'identité des invités, sans statut ni lien ; rapport
 * des personnes ajoutées et ignorées (déjà invitées).
 */
@Component({
  selector: 'app-dialogue-reprise',
  imports: [TranslocoPipe, MatButtonModule, MatDialogModule, MatFormFieldModule, MatProgressBarModule, MatSelectModule, MessageErreur, RapportImport],
  template: `
    <h2 mat-dialog-title>{{ 'invitations.reprise.titre' | transloco }}</h2>
    <mat-dialog-content>
      <p class="texte-aide">{{ 'invitations.reprise.aide' | transloco }}</p>
      <div class="zone-progression">
        @if (chargement()) {
          <mat-progress-bar mode="indeterminate" [attr.aria-label]="'invitations.reprise.chargement' | transloco" />
        }
      </div>
      @if (rapport(); as r) {
        <app-rapport-import [rapport]="r" mode="reprise" />
      } @else {
        <app-message-erreur [erreur]="erreurSources()" [parDefaut]="'invitations.reprise.erreurSources' | transloco" />
        @if (!chargement() && !erreurSources() && sources().length === 0) {
          <p role="status">{{ 'invitations.reprise.aucuneSource' | transloco }}</p>
        } @else if (sources().length) {
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="champ-source">
            <mat-label>{{ 'invitations.reprise.source' | transloco }}</mat-label>
            <mat-select [value]="choisi()" (selectionChange)="choisi.set($event.value)">
              @for (s of sources(); track s.id) {
                <mat-option [value]="s.id">
                  <span dir="auto">{{ s.titre }}</span> · {{ 'statistiques.filtres.version' | transloco: { version: s.version } }} · {{ libelleEtat(s) }}
                </mat-option>
              }
            </mat-select>
          </mat-form-field>
        }
        <app-message-erreur [erreur]="erreur()" [parDefaut]="'invitations.reprise.erreur' | transloco" />
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      @if (rapport()) {
        <button matButton="filled" type="button" [mat-dialog-close]="rapport()">{{ 'commun.fermer' | transloco }}</button>
      } @else {
        <button matButton type="button" mat-dialog-close>{{ 'commun.annuler' | transloco }}</button>
        <button matButton="filled" type="button" (click)="reprendre()" [disabled]="choisi() === null || enCours()">
          {{ (enCours() ? 'invitations.reprise.enCours' : 'invitations.reprise.reprendre') | transloco }}
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: `
    .champ-source {
      width: 100%;
    }
  `,
})
export class DialogueReprise {
  private readonly donnees = inject<DonneesDialogueReprise>(MAT_DIALOG_DATA);
  private readonly service = inject(InvitationService);
  private readonly sondages = inject(SondageService);
  protected readonly libelleEtat = libelleEtatSondage;

  private readonly tous = signal<SondageResumeResponse[]>([]);
  protected readonly sources = computed(() => {
    const exclus = new Set([this.donnees.sondageId, ...this.donnees.versionsExclues]);
    return this.tous().filter((s) => !exclus.has(s.id));
  });
  protected readonly choisi = signal<number | null>(null);
  protected readonly chargement = signal(true);
  protected readonly erreurSources = signal<unknown>(null);
  protected readonly enCours = signal(false);
  protected readonly erreur = signal<unknown>(null);
  protected readonly rapport = signal<RapportImportResponse | null>(null);

  constructor() {
    // Une ligne par lignée ; toutes les pages (dans une limite raisonnable).
    const page = (n: number) => this.sondages.lister({ derniereVersion: true, page: n, taille: TAILLE_SOURCES });
    page(0)
      .pipe(
        expand((p) => (p.page + 1 < p.totalPages && p.page + 1 < PAGES_SOURCES_MAX ? page(p.page + 1) : EMPTY)),
        reduce((acc, p) => [...acc, ...p.contenu], [] as SondageResumeResponse[]),
      )
      .subscribe({
        next: (liste) => {
          this.tous.set(liste);
          this.chargement.set(false);
        },
        error: (erreur: unknown) => {
          this.erreurSources.set(erreur);
          this.chargement.set(false);
        },
      });
  }

  protected reprendre(): void {
    const source = this.choisi();
    if (source === null || this.enCours()) {
      return;
    }
    this.enCours.set(true);
    this.erreur.set(null);
    this.service.reprendre(this.donnees.sondageId, source).subscribe({
      next: (rapport) => {
        this.enCours.set(false);
        this.rapport.set(rapport);
      },
      error: (erreur: unknown) => {
        this.enCours.set(false);
        this.erreur.set(erreur);
      },
    });
  }
}
