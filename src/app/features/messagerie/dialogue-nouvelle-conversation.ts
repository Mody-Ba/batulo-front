import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { catchError, debounceTime, distinctUntilChanged, map, Observable, of, switchMap, tap } from 'rxjs';
import { ConversationResponse, OuvertureConversationRequest } from '../../core/models/messagerie.model';
import { AuthService } from '../../core/services/auth.service';
import { GestionnaireService } from '../../core/services/gestionnaire.service';
import { MessagerieService } from '../../core/services/messagerie.service';
import { SuperAdminService } from '../../core/services/super-admin.service';
import { DELAI_RECHERCHE_MS } from '../../core/utils/recherche';
import { MessageErreur } from '../../shared/components/message-erreur/message-erreur';
import { traduire } from '../../core/i18n/traduire';
import { TranslocoPipe } from '@jsverse/transloco';

/** Un interlocuteur proposé : seuls ceux que le backend autorise. */
export interface InterlocuteurPropose {
  /** null : Batulo (conversation de l'admin avec les super admins). */
  id: number | null;
  nom: string;
  detail: string;
  inactif: boolean;
}

/**
 * Nouvelle conversation (ou celle qui existe déjà, le backend la retrouve). Admin : Batulo et ses gestionnaires ;
 * super admin : les admins. Le gestionnaire n'a pas de choix (son admin) : la page ouvre sa conversation directement.
 * Se ferme avec la conversation ouverte.
 */
@Component({
  selector: 'app-dialogue-nouvelle-conversation',
  imports: [TranslocoPipe, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressBarModule, MessageErreur],
  template: `
    <h2 mat-dialog-title>{{ 'messagerie.nouvelle' | transloco }}</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="recherche">
        <mat-label>{{ (estSuperAdmin ? 'messagerie.dialogue.rechercherAdmin' : 'messagerie.dialogue.rechercherGestionnaire') | transloco }}</mat-label>
        <mat-icon matPrefix fontIcon="search" aria-hidden="true" />
        <input matInput type="search" [value]="recherche()" (input)="recherche.set($any($event.target).value)" />
      </mat-form-field>
      <div class="zone-progression">
        @if (chargement()) {
          <mat-progress-bar mode="indeterminate" [attr.aria-label]="'messagerie.dialogue.chargement' | transloco" />
        }
      </div>
      <app-message-erreur [erreur]="erreur()" />

      <ul class="interlocuteurs" [attr.aria-label]="'messagerie.dialogue.interlocuteurs' | transloco">
        @for (i of proposes(); track i.id ?? 'batulo') {
          <li>
            <button type="button" class="interlocuteur" (click)="choisir(i)" [disabled]="ouverture()">
              <mat-icon [fontIcon]="i.id === null ? 'support_agent' : 'person'" aria-hidden="true" />
              <span class="texte">
                <span class="nom" dir="auto">{{ i.nom }}</span>
                <span class="detail">
                  {{ i.detail }}
                  @if (i.inactif) {
                    · {{ 'messagerie.dialogue.desactive' | transloco }}
                  }
                </span>
              </span>
            </button>
          </li>
        } @empty {
          @if (!chargement()) {
            <li class="vide" role="status">{{ 'messagerie.dialogue.aucun' | transloco }}</li>
          }
        }
      </ul>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" mat-dialog-close>{{ 'commun.annuler' | transloco }}</button>
    </mat-dialog-actions>
  `,
  styles: `
    .recherche {
      width: 100%;
    }

    .interlocuteurs {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .interlocuteur {
      display: flex;
      gap: var(--bt-espace-3);
      align-items: center;
      width: 100%;
      min-height: 52px;
      padding: var(--bt-espace-2) var(--bt-espace-3);
      border: 0;
      border-radius: var(--bt-rayon);
      background: none;
      color: inherit;
      text-align: start;
      cursor: pointer;

      &:hover {
        background: var(--mat-sys-surface-container);
      }

      &:focus-visible {
        outline: 2px solid var(--mat-sys-primary);
      }
    }

    .texte {
      display: flex;
      flex-direction: column;
    }

    .nom {
      font: var(--mat-sys-title-small);
    }

    .detail,
    .vide {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }

    .vide {
      padding: var(--bt-espace-3);
    }
  `,
})
export class DialogueNouvelleConversation {
  private readonly messagerie = inject(MessagerieService);
  private readonly gestionnaires = inject(GestionnaireService);
  private readonly superAdmin = inject(SuperAdminService);
  private readonly reference = inject<MatDialogRef<DialogueNouvelleConversation, ConversationResponse>>(MatDialogRef);
  protected readonly estSuperAdmin = inject(AuthService).role() === 'SUPER_ADMIN';

  protected readonly recherche = signal('');
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<unknown>(null);
  protected readonly ouverture = signal(false);
  private readonly trouves = signal<InterlocuteurPropose[]>([]);

  /** Admin : Batulo d'abord, tant que la recherche ne l'exclut pas. */
  protected readonly proposes = computed(() => {
    if (this.estSuperAdmin) {
      return this.trouves();
    }
    const terme = normaliser(this.recherche());
    const batulo: InterlocuteurPropose = { id: null, nom: 'Batulo', detail: traduire('messagerie.dialogue.detailBatulo'), inactif: false };
    return !terme || normaliser('batulo').includes(terme) ? [batulo, ...this.trouves()] : this.trouves();
  });

  constructor() {
    toObservable(this.recherche)
      .pipe(
        map((t) => t.trim()),
        debounceTime(DELAI_RECHERCHE_MS),
        distinctUntilChanged(),
        tap(() => {
          this.chargement.set(true);
          this.erreur.set(null);
        }),
        switchMap((terme) =>
          this.chercher(terme || null).pipe(
            catchError((erreur: unknown) => {
              this.erreur.set(erreur);
              return of([]);
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((liste) => {
        this.trouves.set(liste);
        this.chargement.set(false);
      });
  }

  protected choisir(interlocuteur: InterlocuteurPropose): void {
    const demande: OuvertureConversationRequest = interlocuteur.id === null ? {} : { interlocuteurId: interlocuteur.id };
    this.ouverture.set(true);
    this.erreur.set(null);
    this.messagerie.ouvrir(demande).subscribe({
      next: (conversation) => this.reference.close(conversation),
      error: (erreur: unknown) => {
        this.ouverture.set(false);
        this.erreur.set(erreur);
      },
    });
  }

  private chercher(recherche: string | null): Observable<InterlocuteurPropose[]> {
    if (this.estSuperAdmin) {
      return this.superAdmin.listerAdmins({ recherche, taille: 50 }).pipe(
        map((page) =>
          page.contenu.map((l) => ({
            id: l.admin.id,
            nom: `${l.admin.prenom} ${l.admin.nom}`,
            detail: l.entreprise.nom,
            inactif: !l.admin.actif,
          })),
        ),
      );
    }
    return this.gestionnaires.lister({ recherche, taille: 50 }).pipe(
      map((page) =>
        page.contenu.map((g) => ({ id: g.id, nom: `${g.prenom} ${g.nom}`, detail: g.courriel, inactif: !g.actif })),
      ),
    );
  }
}

function normaliser(texte: string): string {
  return texte.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}
