import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { TextFieldModule } from '@angular/cdk/text-field';
import { Component, computed, DestroyRef, effect, inject, Injector, input, OnInit, signal } from '@angular/core';
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
import { aLeCode, messageErreur } from '../../../../core/utils/erreur-http';
import { REGLES_SONDAGE } from '../../../../core/utils/regles-question';
import { nonVide } from '../../../../core/utils/validateurs';
import { confirmer } from '../../../../shared/components/dialogue-confirmation/dialogue-confirmation';
import { MessageErreur } from '../../../../shared/components/message-erreur/message-erreur';
import { CarteQuestion } from '../carte-question/carte-question';
import { sourcesPossibles } from '../condition/condition-editeur';
import { ouvrirDialogueCondition, ResumeCondition } from '../condition/resume-condition';
import { EditeurSondageStore, ElementQuestion } from '../editeur-sondage.store';
import { EnregistrementAuto } from '../enregistrement-auto';
import { EtatEnregistrementIndicateur } from '../etat-enregistrement/etat-enregistrement';
import { traduire, traduirePluriel } from '../../../../core/i18n/traduire';
import { TranslocoPipe } from '@jsverse/transloco';

/** Identifiant de la liste des questions d'une section (glisser-déposer entre sections). */
export function idListeQuestions(sectionId: number): string {
  return `questions-section-${sectionId}`;
}

/**
 * Une section : titre et description (enregistrés automatiquement), ses questions (glisser-déposer dans la section
 * ou vers une autre section, brouillon seulement) et ses actions.
 */
@Component({
  selector: 'app-carte-section',
  imports: [TranslocoPipe, CdkDrag,
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
    ResumeCondition,
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
  /** Identifiant de la liste des questions (pour relier les listes de toutes les sections). */
  protected readonly idListe = computed(() => idListeQuestions(this.section().id));
  /** Listes des autres sections, vers lesquelles une question peut être glissée (brouillon seulement). */
  protected readonly listesConnectees = computed(() =>
    (this.store.sondage()?.sections ?? []).filter((s) => s.id !== this.section().id).map((s) => idListeQuestions(s.id)),
  );
  /**
   * Les questions locales restent à la fin : on ne dépose pas une question enregistrée parmi elles. Venue d'une autre
   * section, elle peut aussi se placer juste après la dernière question enregistrée.
   */
  protected readonly positionAutorisee = (index: number, drag: CdkDrag, liste: CdkDropList) =>
    drag.dropContainer === liste ? index < this.nombreEnregistrees() : index <= this.nombreEnregistrees();
  /** Venue d'une autre section : question enregistrée sans modification en attente, et section pas pleine. */
  protected readonly entreeAutorisee = (drag: CdkDrag<number | null>, liste: CdkDropList) =>
    drag.dropContainer === liste ||
    (this.store.peutChangerDeSection(drag.data) && !this.store.sectionPleine(this.section().id));
  protected readonly parCle = (_index: number, element: ElementQuestion) => element.cle;
  protected readonly nomCible = computed(() => traduire('editeur.section.nomCible', { numero: this.position() + 1 }));
  /** Bouton « Ajouter une condition » : brouillon, sans condition, et au moins une question dans les sections précédentes. */
  protected readonly peutAjouterCondition = computed(() => {
    const sondage = this.store.sondage();
    if (!this.store.modifiable() || !sondage || this.section().condition) {
      return false;
    }
    return sourcesPossibles(sondage, { type: 'section', sectionId: this.section().id }).length > 0;
  });
  /** Refus à garder lisible sur la carte (409 CONDITION_DEPENDANTE, retrait de condition refusé). */
  protected readonly erreurAction = signal<unknown>(null);

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

  protected deposer(evenement: CdkDragDrop<number, number, number | null>): void {
    if (evenement.previousContainer === evenement.container) {
      this.deplacerQuestion(evenement.previousIndex, evenement.currentIndex);
      return;
    }
    const questionId = evenement.item.data;
    if (questionId !== null) {
      this.store
        .changerDeSection(questionId, this.section().id, evenement.currentIndex)
        .subscribe({ error: (e: unknown) => this.echecOrdre(e) });
    }
  }

  protected deplacerSection(vers: number): void {
    this.store.deplacerSection(this.position(), vers).subscribe({ error: (e: unknown) => this.echecOrdre(e) });
  }

  /** « Ajouter / Modifier la condition d'affichage » (sources : questions des sections précédentes). */
  protected editerCondition(): void {
    const sondage = this.store.sondage();
    const section = this.section();
    if (!sondage) {
      return;
    }
    this.erreurAction.set(null);
    ouvrirDialogueCondition(this.dialog, {
      sondage,
      cible: { type: 'section', sectionId: section.id },
      nomCible: this.nomCible(),
      condition: section.condition ?? null,
      enregistrer: (condition) => this.store.definirConditionSection(section.id, condition),
    }).subscribe((resultat) => {
      if (resultat) {
        this.snackBar.open(traduire('editeur.condition.enregistree'), traduire('commun.fermer'), { duration: 4000 });
      }
    });
  }

  protected retirerCondition(): void {
    this.erreurAction.set(null);
    this.store.definirConditionSection(this.section().id, null).subscribe({
      next: () => this.snackBar.open(traduire('editeur.condition.retireeSection'), traduire('commun.fermer'), { duration: 4000 }),
      error: (erreur: unknown) => this.erreurAction.set(erreur),
    });
  }

  protected supprimer(): void {
    const section = this.section();
    const nombre = this.elements().length;
    confirmer(this.dialog, {
      titre: traduire('editeur.section.supprimerTitre'),
      message:
        nombre === 0
          ? traduire('editeur.section.supprimerVide', { titre: section.titre })
          : traduirePluriel('editeur.section.supprimerAvec', nombre, { titre: section.titre }),
      action: traduire('editeur.section.supprimer'),
      destructive: true,
    })
      .pipe(filter(Boolean))
      .subscribe(() =>
        this.store.supprimerSection(section.id).subscribe({
          next: () => this.snackBar.open(traduire('editeur.section.supprimee'), traduire('commun.fermer'), { duration: 4000 }),
          error: (erreur: unknown) => this.signalerRefus(erreur),
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
    this.signalerRefus(erreur);
    this.store.recharger();
  }

  /** CONDITION_DEPENDANTE reste affiché sur la carte de la section ; le reste en message passager. */
  private signalerRefus(erreur: unknown): void {
    if (aLeCode(erreur, 'CONDITION_DEPENDANTE')) {
      this.erreurAction.set(erreur);
    } else {
      this.snackBar.open(messageErreur(erreur), traduire('commun.fermer'), { duration: 6000 });
    }
  }

  private requete(): SectionRequest {
    const { titre, description } = this.formulaire.getRawValue();
    return { titre: titre.trim(), description: description.trim() || null };
  }
}
