import { DatePipe } from '@angular/common';
import { Component, computed, inject, LOCALE_ID, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { RouterLink } from '@angular/router';
import { LIBELLES_FORMULE, LIBELLES_STATUT_ABONNEMENT } from '../../../../core/models/abonnement.model';
import {
  DemandeAbonnementResponse,
  LIBELLES_STATUT_DEMANDE,
  LONGUEUR_MAX_REPONSE_DEMANDE,
  TraitementDemandeRequest,
} from '../../../../core/models/demande-abonnement.model';
import { DemandeAbonnementService } from '../../../../core/services/demande-abonnement.service';
import { aLeCode } from '../../../../core/utils/erreur-http';
import { nonVide } from '../../../../core/utils/validateurs';
import { MessageErreur } from '../../../../shared/components/message-erreur/message-erreur';

export interface DonneesDialogueDemande {
  demande: DemandeAbonnementResponse;
}

/**
 * Résultat : la demande traitée, 'recharger' si elle l'a été entre-temps par un autre super admin
 * (409 DEMANDE_DEJA_TRAITEE), rien si la boîte est fermée sans réponse.
 */
export type ResultatDialogueDemande = DemandeAbonnementResponse | 'recharger';

/**
 * Détail d'une demande d'augmentation et, si elle est en attente, réponse TRAITEE (acceptée, message facultatif)
 * ou REFUSEE (message obligatoire, pour expliquer le refus à l'admin). Sans effet sur l'abonnement (RG-09) : acceptée, l'admin paie lui-même la formule.
 */
@Component({
  selector: 'app-dialogue-demande',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatRadioModule,
    MessageErreur,
  ],
  templateUrl: './dialogue-demande.html',
  styleUrl: './dialogue-demande.scss',
})
export class DialogueDemande {
  private readonly service = inject(DemandeAbonnementService);
  private readonly reference =
    inject<MatDialogRef<DialogueDemande, ResultatDialogueDemande>>(MatDialogRef);
  protected readonly demande = inject<DonneesDialogueDemande>(MAT_DIALOG_DATA).demande;
  protected readonly libellesFormule = LIBELLES_FORMULE;
  protected readonly libellesStatutAbonnement = LIBELLES_STATUT_ABONNEMENT;
  protected readonly libellesStatut = LIBELLES_STATUT_DEMANDE;
  protected readonly longueurMax = LONGUEUR_MAX_REPONSE_DEMANDE;
  /** « Refusée par X le 10 novembre 2026 à 14:05 » (demande déjà traitée). */
  protected readonly mentionTraitement = this.decrireTraitement(new DatePipe(inject(LOCALE_ID)));

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly formulaire = this.fb.group({
    // Aucun choix par défaut : accepter ou refuser doit être un geste explicite.
    statut: this.fb.control<TraitementDemandeRequest['statut'] | null>(null, Validators.required),
    reponse: ['', [Validators.maxLength(LONGUEUR_MAX_REPONSE_DEMANDE)]],
  });

  private readonly decision = toSignal(this.formulaire.controls.statut.valueChanges, {
    initialValue: this.formulaire.controls.statut.value,
  });
  /** Refus : le message devient obligatoire. */
  protected readonly messageObligatoire = computed(() => this.decision() === 'REFUSEE');

  protected readonly enCours = signal(false);
  protected readonly erreur = signal<unknown>(null);
  /** La demande a été traitée par quelqu'un d'autre : plus de formulaire, la liste sera relue. */
  protected readonly dejaTraitee = signal(false);

  constructor() {
    const reponse = this.formulaire.controls.reponse;
    this.formulaire.controls.statut.valueChanges.pipe(takeUntilDestroyed()).subscribe((statut) => {
      reponse.setValidators(
        statut === 'REFUSEE'
          ? [Validators.required, nonVide, Validators.maxLength(LONGUEUR_MAX_REPONSE_DEMANDE)]
          : [Validators.maxLength(LONGUEUR_MAX_REPONSE_DEMANDE)],
      );
      reponse.updateValueAndValidity();
    });
  }

  protected enregistrer(): void {
    if (this.formulaire.invalid || this.enCours()) {
      this.formulaire.markAllAsTouched();
      return;
    }
    const { statut, reponse } = this.formulaire.getRawValue();
    if (!statut) {
      return;
    }
    const traitement: TraitementDemandeRequest = { statut, reponse: reponse.trim() || null };
    this.enCours.set(true);
    this.erreur.set(null);
    this.reference.disableClose = true;
    this.service.traiter(this.demande.id, traitement).subscribe({
      next: (demande) => this.reference.close(demande),
      error: (erreur: unknown) => {
        this.enCours.set(false);
        this.erreur.set(erreur);
        if (aLeCode(erreur, 'DEMANDE_DEJA_TRAITEE')) {
          // Seul « Fermer » referme la boîte, pour que la liste soit relue.
          this.dejaTraitee.set(true);
        } else {
          this.reference.disableClose = false;
        }
      },
    });
  }

  private decrireTraitement(dates: DatePipe): string {
    const { statut, traiteeParNom, dateTraitement } = this.demande;
    return [
      statut === 'TRAITEE' ? 'Acceptée' : 'Refusée',
      traiteeParNom ? `par ${traiteeParNom}` : null,
      dateTraitement ? `le ${dates.transform(dateTraitement, 'd MMMM y à HH:mm')}` : null,
    ]
      .filter(Boolean)
      .join(' ');
  }

  protected fermer(): void {
    this.reference.close(this.dejaTraitee() ? 'recharger' : undefined);
  }
}
