import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { TextFieldModule } from '@angular/cdk/text-field';
import {
  afterNextRender,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelect, MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { filter, Observable, tap } from 'rxjs';
import {
  ICONES_TYPE_QUESTION,
  LIBELLES_TYPE_QUESTION,
  QuestionRequest,
  QuestionResponse,
  TYPES_CRITERE,
  TYPES_QUESTION,
  TypeQuestion,
} from '../../../../core/models/sondage.model';
import { messageErreur } from '../../../../core/utils/erreur-http';
import { REGLES_SONDAGE } from '../../../../core/utils/regles-question';
import { confirmer } from '../../../../shared/components/dialogue-confirmation/dialogue-confirmation';
import { MessageErreur } from '../../../../shared/components/message-erreur/message-erreur';
import { CritereQuestion } from '../critere-question/critere-question';
import { EditeurSondageStore } from '../editeur-sondage.store';
import { EnregistrementAuto } from '../enregistrement-auto';
import { EtatEnregistrementIndicateur } from '../etat-enregistrement/etat-enregistrement';
import {
  appliquerReponse,
  changerType,
  creerFormulaireQuestion,
  FormulaireQuestion,
  optionsPerdues,
  requeteQuestion,
} from '../types/formulaires-types';
import { QuestionChoixMultiple } from '../types/question-choix-multiple/question-choix-multiple';
import { QuestionChoixUnique } from '../types/question-choix-unique/question-choix-unique';
import { QuestionClassement } from '../types/question-classement/question-classement';
import { QuestionDate } from '../types/question-date/question-date';
import { QuestionEchelle } from '../types/question-echelle/question-echelle';
import { QuestionMatrice } from '../types/question-matrice/question-matrice';
import { QuestionNumerique } from '../types/question-numerique/question-numerique';
import { QuestionOuiNon } from '../types/question-oui-non/question-oui-non';
import { QuestionTexteCourt } from '../types/question-texte-court/question-texte-court';
import { QuestionTexteLong } from '../types/question-texte-long/question-texte-long';

/**
 * Une question de l'éditeur : libellé, aide, type, obligatoire et configuration propre au type. Enregistrée seule
 * (POST la première fois, PUT ensuite), automatiquement : 800 ms après la dernière frappe ou à la sortie d'un champ,
 * et seulement si elle est valide. Une erreur du serveur s'affiche sur cette carte.
 * Le formulaire est créé une fois, à partir de `question` : les réponses du serveur ne l'écrasent pas.
 */
@Component({
  selector: 'app-carte-question',
  imports: [
    CdkDragHandle,
    TextFieldModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatSelectModule,
    MatSlideToggleModule,
    MessageErreur,
    EtatEnregistrementIndicateur,
    CritereQuestion,
    QuestionChoixUnique,
    QuestionChoixMultiple,
    QuestionClassement,
    QuestionOuiNon,
    QuestionTexteCourt,
    QuestionTexteLong,
    QuestionEchelle,
    QuestionNumerique,
    QuestionDate,
    QuestionMatrice,
  ],
  templateUrl: './carte-question.html',
  styleUrl: './carte-question.scss',
  host: { '(focusout)': 'sortieDeChamp()' },
})
export class CarteQuestion implements OnInit {
  protected readonly store = inject(EditeurSondageStore);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  protected readonly types = TYPES_QUESTION;
  protected readonly libellesType = LIBELLES_TYPE_QUESTION;
  protected readonly iconesType = ICONES_TYPE_QUESTION;
  protected readonly regles = REGLES_SONDAGE;

  /** Question enregistrée, ou null pour une nouvelle question (lue une seule fois, à l'initialisation). */
  readonly question = input<QuestionResponse | null>(null);
  readonly cle = input.required<string>();
  readonly sectionId = input.required<number>();
  /** Numéro affiché (1 = première question de la section). */
  readonly numero = input.required<number>();
  /** Position parmi les questions enregistrées de la section, et leur nombre (pour Monter/Descendre). */
  readonly position = input(0);
  readonly nombreEnregistrees = input(0);

  protected formulaire!: FormulaireQuestion;
  protected auto!: EnregistrementAuto<QuestionRequest>;
  /** Id une fois la question créée sur le serveur. */
  protected readonly idQuestion = signal<number | null>(null);

  private readonly champLibelle = viewChild<ElementRef<HTMLTextAreaElement>>('champLibelle');

  ngOnInit(): void {
    const question = this.question();
    this.idQuestion.set(question?.id ?? null);
    this.formulaire = creerFormulaireQuestion(question);
    this.auto = new EnregistrementAuto<QuestionRequest>({
      formulaire: this.formulaire,
      requete: () => requeteQuestion(this.formulaire),
      envoyer: (requete) => this.envoyer(requete),
      enregistree: question ? requeteQuestion(this.formulaire) : null,
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
    effect(() => this.store.signalerEtat(this.cle(), this.auto.etat()), { injector: this.injector });
    const cle = this.cle();
    this.destroyRef.onDestroy(() => this.store.oublierEtat(cle));

    if (!question) {
      afterNextRender(() => this.champLibelle()?.nativeElement.focus(), { injector: this.injector });
    }
  }

  /**
   * Critère d'analyse : pour une question enregistrée d'un type compatible, tant que son type n'a pas changé sans
   * être enregistré (le backend retire le critère quand le type change). Liste de 0 ou 1 élément, recréée si le
   * type enregistré change.
   */
  protected critere(): QuestionResponse[] {
    const enregistree = this.store.questionEnregistree(this.idQuestion());
    return enregistree && TYPES_CRITERE.has(enregistree.type) && enregistree.type === this.type ? [enregistree] : [];
  }

  protected get type(): TypeQuestion {
    return this.formulaire.controls.type.value;
  }

  protected sortieDeChamp(): void {
    this.auto.maintenant();
  }

  protected reessayer(): void {
    this.auto.maintenant();
  }

  /**
   * Nouveau type : la configuration repart des valeurs par défaut. Si des options (ou les lignes et colonnes d'une
   * grille) seraient perdues, on demande d'abord confirmation ; sinon le sélecteur revient à l'ancien type.
   */
  protected choisirType(nouveau: TypeQuestion, selecteur: MatSelect): void {
    const ancien = this.type;
    if (nouveau === ancien) {
      return;
    }
    const pertes: string[] = [];
    if (optionsPerdues(this.formulaire, nouveau)) {
      pertes.push(`ses ${this.formulaire.controls.options.length} options`);
    }
    if (ancien === 'MATRICE') {
      pertes.push('les lignes et les colonnes de la grille');
    }
    if (pertes.length === 0) {
      changerType(this.formulaire, nouveau);
      return;
    }
    confirmer(this.dialog, {
      titre: `Passer en « ${LIBELLES_TYPE_QUESTION[nouveau]} » ?`,
      message: `Cette question perdra ${pertes.join(' et ')}.`,
      action: 'Changer de type',
      destructive: true,
    }).subscribe((ok) => {
      if (ok) {
        changerType(this.formulaire, nouveau);
      } else {
        selecteur.value = ancien;
      }
    });
  }

  /** Autres sections du sondage (menu « Déplacer vers une autre section »). */
  protected autresSections() {
    return (this.store.sondage()?.sections ?? [])
      .map((section, index) => ({ section, numero: index + 1 }))
      .filter(({ section }) => section.id !== this.sectionId());
  }

  /** Vers la fin d'une autre section (alternative au glisser-déposer, au clavier). */
  protected changerDeSection(sectionId: number): void {
    const id = this.idQuestion();
    if (id === null) {
      return;
    }
    this.store.changerDeSection(id, sectionId).subscribe({
      next: () => this.snackBar.open('Question déplacée.', 'Fermer', { duration: 4000 }),
      error: (erreur: unknown) => {
        this.snackBar.open(messageErreur(erreur), 'Fermer', { duration: 6000 });
        this.store.recharger();
      },
    });
  }

  protected monter(): void {
    this.deplacer(this.position() - 1);
  }

  protected descendre(): void {
    this.deplacer(this.position() + 1);
  }

  protected supprimer(): void {
    const id = this.idQuestion();
    const libelle = this.formulaire.controls.libelle.value.trim();
    const retirer = () =>
      id === null
        ? this.store.retirerQuestionLocale(this.sectionId(), this.cle())
        : this.store.supprimerQuestion(id).subscribe({
            next: () => this.snackBar.open('Question supprimée.', 'Fermer', { duration: 4000 }),
            error: (erreur: unknown) => this.snackBar.open(messageErreur(erreur), 'Fermer', { duration: 6000 }),
          });
    if (id === null && !libelle) {
      retirer();
      return;
    }
    confirmer(this.dialog, {
      titre: 'Supprimer cette question ?',
      message: libelle ? `« ${libelle} » sera supprimée.` : 'Cette question sera supprimée.',
      action: 'Supprimer',
      destructive: true,
    })
      .pipe(filter(Boolean))
      .subscribe(() => retirer());
  }

  private deplacer(vers: number): void {
    this.store.deplacerQuestion(this.sectionId(), this.position(), vers).subscribe({
      error: (erreur: unknown) => {
        this.snackBar.open(messageErreur(erreur), 'Fermer', { duration: 6000 });
        this.store.recharger();
      },
    });
  }

  private envoyer(requete: QuestionRequest): Observable<QuestionResponse> {
    const id = this.idQuestion();
    const envoi =
      id === null
        ? this.store.creerQuestion(this.sectionId(), this.cle(), requete)
        : this.store.modifierQuestion(id, requete);
    return envoi.pipe(
      tap((question) => {
        this.idQuestion.set(question.id);
        appliquerReponse(this.formulaire, question);
      }),
    );
  }
}
