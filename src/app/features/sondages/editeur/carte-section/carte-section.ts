import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { TextFieldModule } from '@angular/cdk/text-field';
import { Component, computed, DestroyRef, effect, inject, Injector, input, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { filter, Observable } from 'rxjs';
import { SectionRequest, SectionResponse } from '../../../../core/models/sondage.model';
import { messageErreur } from '../../../../core/utils/erreur-http';
import { REGLES_SONDAGE } from '../../../../core/utils/regles-question';
import { nonVide } from '../../../../core/utils/validateurs';
import { confirmer } from '../../../../shared/components/dialogue-confirmation/dialogue-confirmation';
import { MessageErreur } from '../../../../shared/components/message-erreur/message-erreur';
import { CarteQuestion } from '../carte-question/carte-question';
import { EditeurSondageStore, ElementQuestion } from '../editeur-sondage.store';
import { EnregistrementAuto } from '../enregistrement-auto';
import { EtatEnregistrementIndicateur } from '../etat-enregistrement/etat-enregistrement';

/**
 * Une section : titre et description (enregistrés automatiquement), ses questions (glisser-déposer à l'intérieur de
 * la section seulement en F5a : pas de route pour changer une question de section) et ses actions.
 */
@Component({
  selector: 'app-carte-section',
  imports: [
    CdkDrag,
    CdkDragHandle,
    CdkDropList,
    TextFieldModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MessageErreur,
    CarteQuestion,
    EtatEnregistrementIndicateur,
  ],
  templateUrl: './carte-section.html',
  styleUrl: './carte-section.scss',
  host: { '(focusout)': 'sortieDeChamp($event)' },
})
export class CarteSection implements OnInit {
  protected readonly store = inject(EditeurSondageStore);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  protected readonly regles = REGLES_SONDAGE;

  readonly section = input.required<SectionResponse>();
  /** Position de la section (0 = première) et nombre de sections. */
  readonly position = input.required<number>();
  readonly nombreSections = input.required<number>();

  protected readonly elements = computed<ElementQuestion[]>(
    () => this.store.elements().get(this.section().id) ?? [],
  );
  protected readonly nombreEnregistrees = computed(() => this.section().questions.length);
  protected readonly limiteAtteinte = computed(
    () => this.elements().length >= REGLES_SONDAGE.questionsMaxParSection,
  );
  /** Les questions locales restent à la fin : on ne dépose pas une question enregistrée parmi elles. */
  protected readonly positionAutorisee = (index: number) => index < this.nombreEnregistrees();
  protected readonly parCle = (_index: number, element: ElementQuestion) => element.cle;

  protected readonly formulaire = new FormGroup({
    titre: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, nonVide, Validators.maxLength(REGLES_SONDAGE.titreSectionMax)],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(REGLES_SONDAGE.descriptionMax)],
    }),
  });
  protected auto!: EnregistrementAuto<SectionRequest>;

  ngOnInit(): void {
    const section = this.section();
    this.formulaire.setValue({ titre: section.titre, description: section.description ?? '' });
    this.auto = new EnregistrementAuto<SectionRequest>({
      formulaire: this.formulaire,
      requete: () => this.requete(),
      envoyer: (requete): Observable<unknown> => this.store.modifierSection(this.section().id, requete),
      enregistree: this.requete(),
      destroyRef: this.destroyRef,
    });
    effect(
      () => {
        if (this.store.modifiable()) {
          this.formulaire.enable({ emitEvent: false });
        } else {
          this.formulaire.disable({ emitEvent: false });
        }
      },
      { injector: this.injector },
    );
    const cle = `section-${section.id}`;
    effect(() => this.store.signalerEtat(cle, this.auto.etat()), { injector: this.injector });
    this.destroyRef.onDestroy(() => this.store.oublierEtat(cle));
  }

  /** Sortie d'un champ de la section elle-même (pas d'une de ses questions, qui s'enregistrent seules). */
  protected sortieDeChamp(evenement: FocusEvent): void {
    const cible = evenement.target as HTMLElement | null;
    if (cible?.closest('.entete-section-editeur')) {
      this.auto.maintenant();
    }
  }

  protected ajouterQuestion(): void {
    this.store.ajouterQuestionLocale(this.section().id);
  }

  protected deposer(evenement: CdkDragDrop<unknown>): void {
    this.deplacerQuestion(evenement.previousIndex, evenement.currentIndex);
  }

  protected deplacerSection(vers: number): void {
    this.store.deplacerSection(this.position(), vers).subscribe({ error: (e: unknown) => this.echecOrdre(e) });
  }

  protected supprimer(): void {
    const section = this.section();
    const nombre = this.elements().length;
    confirmer(this.dialog, {
      titre: 'Supprimer cette section ?',
      message:
        nombre === 0
          ? `La section « ${section.titre} » sera supprimée.`
          : `La section « ${section.titre} » sera supprimée avec ${nombre === 1 ? 'sa question' : `ses ${nombre} questions`}.`,
      action: 'Supprimer la section',
      destructive: true,
    })
      .pipe(filter(Boolean))
      .subscribe(() =>
        this.store.supprimerSection(section.id).subscribe({
          next: () => this.snackBar.open('Section supprimée.', 'Fermer', { duration: 4000 }),
          error: (erreur: unknown) => this.snackBar.open(messageErreur(erreur), 'Fermer', { duration: 6000 }),
        }),
      );
  }

  private deplacerQuestion(de: number, vers: number): void {
    this.store
      .deplacerQuestion(this.section().id, de, vers)
      .subscribe({ error: (e: unknown) => this.echecOrdre(e) });
  }

  /** L'ordre affiché revient à celui du serveur. */
  private echecOrdre(erreur: unknown): void {
    this.snackBar.open(messageErreur(erreur), 'Fermer', { duration: 6000 });
    this.store.recharger();
  }

  private requete(): SectionRequest {
    const { titre, description } = this.formulaire.getRawValue();
    return { titre: titre.trim(), description: description.trim() || null };
  }
}
