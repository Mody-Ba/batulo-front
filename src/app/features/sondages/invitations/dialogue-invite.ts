import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  InvitationRequest,
  InvitationResponse,
  REGLES_INVITATION,
} from '../../../core/models/invitation.model';
import { LANGUES_CONTENU, LangueContenu, LIBELLES_LANGUE } from '../../../core/models/traduction.model';
import { InvitationService } from '../../../core/services/invitation.service';
import { MessageErreur } from '../../../shared/components/message-erreur/message-erreur';

export interface DonneesDialogueInvite {
  sondageId: number;
  /** Absent : ajout. */
  invitation?: InvitationResponse;
}

/**
 * Ajout ou modification d'un invité : courriel obligatoire (unique dans le sondage : 409 INVITE_EXISTANT), prénom, nom,
 * téléphone et langue préférée facultatifs. Se ferme avec l'invité enregistré.
 */
@Component({
  selector: 'app-dialogue-invite',
  imports: [TranslocoPipe, ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MessageErreur],
  template: `
    <h2 mat-dialog-title>{{ (donnees.invitation ? 'invitations.dialogue.modifier' : 'invitations.dialogue.ajouter') | transloco }}</h2>
    <form [formGroup]="formulaire" (ngSubmit)="enregistrer()" novalidate>
      <mat-dialog-content class="champs">
        <app-message-erreur [erreur]="erreur()" [parDefaut]="'invitations.dialogue.erreur' | transloco" />
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ 'invitations.champs.courriel' | transloco }}</mat-label>
          <input matInput type="email" formControlName="courriel" required dir="ltr" autocomplete="off" [maxlength]="regles.courrielMax" />
          @if (formulaire.controls.courriel.hasError('required')) {
            <mat-error>{{ 'invitations.dialogue.courrielObligatoire' | transloco }}</mat-error>
          } @else if (formulaire.controls.courriel.hasError('email')) {
            <mat-error>{{ 'invitations.dialogue.courrielInvalide' | transloco }}</mat-error>
          }
        </mat-form-field>
        <div class="ligne">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'invitations.champs.prenom' | transloco }}</mat-label>
            <input matInput formControlName="prenom" dir="auto" autocomplete="off" [maxlength]="regles.prenomMax" />
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'invitations.champs.nom' | transloco }}</mat-label>
            <input matInput formControlName="nom" dir="auto" autocomplete="off" [maxlength]="regles.nomMax" />
          </mat-form-field>
        </div>
        <div class="ligne">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'invitations.champs.telephone' | transloco }}</mat-label>
            <input matInput type="tel" formControlName="telephone" dir="ltr" autocomplete="off" [maxlength]="regles.telephoneMax" />
            <mat-hint>{{ 'invitations.dialogue.telephoneAide' | transloco }}</mat-hint>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'invitations.champs.langue' | transloco }}</mat-label>
            <mat-select formControlName="langue">
              <mat-option [value]="null">{{ 'invitations.dialogue.languePrincipale' | transloco }}</mat-option>
              @for (l of langues; track l) {
                <mat-option [value]="l">{{ nomLangue(l) }}</mat-option>
              }
            </mat-select>
            <mat-hint>{{ 'invitations.dialogue.langueAide' | transloco }}</mat-hint>
          </mat-form-field>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close>{{ 'commun.annuler' | transloco }}</button>
        <button matButton="filled" type="submit" [disabled]="enCours()">
          {{ (donnees.invitation ? 'commun.enregistrer' : 'invitations.dialogue.ajouterBouton') | transloco }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .champs {
      display: flex;
      flex-direction: column;
      gap: var(--bt-espace-3);
    }

    .ligne {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--bt-espace-3);

      @media (max-width: 599.98px) {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class DialogueInvite {
  protected readonly donnees = inject<DonneesDialogueInvite>(MAT_DIALOG_DATA);
  private readonly reference = inject<MatDialogRef<DialogueInvite, InvitationResponse>>(MatDialogRef);
  private readonly service = inject(InvitationService);
  protected readonly regles = REGLES_INVITATION;
  protected readonly langues = LANGUES_CONTENU;
  protected readonly nomLangue = (l: LangueContenu) => LIBELLES_LANGUE[l];
  protected readonly enCours = signal(false);
  protected readonly erreur = signal<unknown>(null);

  protected readonly formulaire = inject(NonNullableFormBuilder).group({
    courriel: [
      this.donnees.invitation?.courriel ?? '',
      [Validators.required, Validators.email, Validators.maxLength(REGLES_INVITATION.courrielMax)],
    ],
    prenom: [this.donnees.invitation?.prenom ?? '', Validators.maxLength(REGLES_INVITATION.prenomMax)],
    nom: [this.donnees.invitation?.nom ?? '', Validators.maxLength(REGLES_INVITATION.nomMax)],
    telephone: [this.donnees.invitation?.telephone ?? '', Validators.maxLength(REGLES_INVITATION.telephoneMax)],
    langue: [(this.donnees.invitation?.langue ?? null) as LangueContenu | null],
  });

  protected enregistrer(): void {
    if (this.enCours()) {
      return;
    }
    if (this.formulaire.invalid) {
      this.formulaire.markAllAsTouched();
      return;
    }
    const v = this.formulaire.getRawValue();
    const demande: InvitationRequest = {
      courriel: v.courriel.trim(),
      prenom: v.prenom.trim() || null,
      nom: v.nom.trim() || null,
      telephone: v.telephone.trim() || null,
      langue: v.langue,
    };
    this.enCours.set(true);
    this.erreur.set(null);
    const { sondageId, invitation } = this.donnees;
    (invitation ? this.service.modifier(sondageId, invitation.id, demande) : this.service.ajouter(sondageId, demande)).subscribe({
      next: (enregistree) => this.reference.close(enregistree),
      error: (erreur: unknown) => {
        this.enCours.set(false);
        this.erreur.set(erreur);
      },
    });
  }
}
