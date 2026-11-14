import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  untracked,
  ViewEncapsulation,
} from '@angular/core';
import { ErreurQuestion } from '../../core/models/erreur.model';
import { SectionResponse } from '../../core/models/sondage.model';
import { QuestionRepondant } from './question-repondant';
import {
  cleReponse,
  creerFormulaireReponses,
  FormulaireReponses,
  ReponseQuestionRequest,
  reponsesAEnvoyer,
  ValeurReponse,
} from './reponses';

/** Ce qu'il faut pour afficher un formulaire (aperçu F5b, formulaire public F6). */
export interface ContenuFormulaire {
  titre: string;
  description: string | null;
  sections: SectionResponse[];
}

/** Réponses en cours, par id de question (brouillon du navigateur). */
export type ReponsesParQuestion = Record<number, ValeurReponse>;

/**
 * Formulaire tel que le voit le répondant : une section par page (Précédent / Suivant, progression), questions
 * numérotées en continu. « Suivant » et « Envoyer » vérifient d'abord la section ; la première question à corriger
 * reçoit le focus. Les refus du serveur (REPONSES_INVALIDES) sont posés sur leur question. En aperçu, rien n'est
 * envoyé : « Vérifier » contrôle seulement les réponses. Éléments natifs, sans Angular Material (formulaire public
 * léger) ; mise en page selon la largeur du formulaire (container queries), pas de l'écran.
 */
@Component({
  selector: 'app-formulaire-sondage',
  imports: [QuestionRepondant],
  templateUrl: './formulaire-sondage.html',
  // Styles des champs en une seule copie (et non une par composant de champ), limités à app-formulaire-sondage.
  styleUrls: [
    './formulaire-sondage.scss',
    './champs/champs-choix.scss',
    './champs/champs-saisie.scss',
    './champs/champs-matrice.scss',
  ],
  encapsulation: ViewEncapsulation.None,
})
export class FormulaireSondage {
  private readonly hote = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly cleReponse = cleReponse;

  readonly contenu = input.required<ContenuFormulaire>();
  /** apercu : rien n'est envoyé ; reponse : `envoyer` émet les réponses (F6). */
  readonly mode = input<'apercu' | 'reponse'>('reponse');
  /** Brouillon repris à l'affichage (questions inconnues ignorées), et section où reprendre. */
  readonly reponsesInitiales = input<ReponsesParQuestion | null>(null);
  readonly sectionInitiale = input(0);
  /** Envoi en cours : bouton désactivé et « Envoi… ». */
  readonly envoiEnCours = input(false);
  /** Refus du serveur, une erreur par question (posée sur la question, première section concernée affichée). */
  readonly erreursServeur = input<readonly ErreurQuestion[] | null>(null);

  readonly envoyer = output<ReponseQuestionRequest[]>();
  /** Chaque modification des réponses (pour le brouillon du navigateur). */
  readonly reponsesModifiees = output<ReponsesParQuestion>();
  readonly sectionChangee = output<number>();

  protected readonly reponses = signal<FormulaireReponses>(creerFormulaireReponses([]));
  protected readonly indexSection = signal(0);
  protected readonly aCorriger = signal(false);
  /** Aperçu : les réponses ont été vérifiées. */
  protected readonly verifie = signal(false);
  /** Erreurs du serveur qui ne correspondent à aucune question affichée. */
  protected readonly erreursGenerales = signal<string[]>([]);

  protected readonly sections = computed(() => this.contenu().sections.filter((s) => s.questions.length > 0));
  protected readonly section = computed(() => this.sections()[this.indexSection()] ?? null);
  protected readonly derniere = computed(() => this.indexSection() >= this.sections().length - 1);
  /** Numéro de la première question de chaque section (numérotation continue). */
  protected readonly premierNumero = computed(() => {
    const numeros: number[] = [];
    let n = 1;
    for (const section of this.sections()) {
      numeros.push(n);
      n += section.questions.length;
    }
    return numeros;
  });

  private abonnement: { unsubscribe(): void } | null = null;

  constructor() {
    effect(() => {
      const sections = this.contenu().sections;
      untracked(() => this.recommencer(sections, this.reponsesInitiales(), this.sectionInitiale()));
    });
    effect(() => {
      const erreurs = this.erreursServeur();
      if (erreurs?.length) {
        untracked(() => this.poserErreursServeur(erreurs));
      }
    });
    this.destroyRef.onDestroy(() => this.abonnement?.unsubscribe());
  }

  protected controle(cle: string) {
    return this.reponses().controls[cle];
  }

  protected precedent(): void {
    this.aCorriger.set(false);
    this.allerA(this.indexSection() - 1);
  }

  protected suivant(): void {
    if (this.verifierSection()) {
      this.allerA(this.indexSection() + 1);
    }
  }

  protected terminer(): void {
    if (!this.verifierSection()) {
      return;
    }
    const reponses = reponsesAEnvoyer(this.contenu().sections, this.reponses());
    if (this.mode() === 'apercu') {
      this.verifie.set(true);
    } else {
      this.envoyer.emit(reponses);
    }
  }

  /** Formulaire vide (ou repris d'un brouillon), à la première section (ou à celle du brouillon). */
  recommencer(
    sections = this.contenu().sections,
    initiales: ReponsesParQuestion | null = null,
    indexInitial = 0,
  ): void {
    const formulaire = creerFormulaireReponses(sections);
    const visibles = sections.filter((s) => s.questions.length > 0);
    if (initiales) {
      for (const question of visibles.flatMap((s) => s.questions)) {
        const valeur = initiales[question.id];
        if (valeur !== undefined) {
          formulaire.controls[cleReponse(question)].setValue(valeur, { emitEvent: false });
        }
      }
    }
    this.abonnement?.unsubscribe();
    this.abonnement = formulaire.valueChanges.subscribe(() => this.reponsesModifiees.emit(this.valeursParQuestion()));
    this.reponses.set(formulaire);
    this.indexSection.set(Math.min(Math.max(indexInitial, 0), Math.max(visibles.length - 1, 0)));
    this.aCorriger.set(false);
    this.verifie.set(false);
    this.erreursGenerales.set([]);
  }

  private valeursParQuestion(): ReponsesParQuestion {
    const valeurs: ReponsesParQuestion = {};
    for (const question of this.contenu().sections.flatMap((s) => s.questions)) {
      const valeur = this.controle(cleReponse(question))?.value ?? null;
      if (valeur !== null) {
        valeurs[question.id] = valeur;
      }
    }
    return valeurs;
  }

  /** Chaque erreur sur sa question ; la première section concernée s'affiche et sa question reçoit le focus. */
  private poserErreursServeur(erreurs: readonly ErreurQuestion[]): void {
    const generales: string[] = [];
    let premiereSection: number | null = null;
    let premiereQuestion: number | null = null;
    for (const erreur of erreurs) {
      const index = this.sections().findIndex((s) => s.questions.some((q) => q.id === erreur.questionId));
      const controle = erreur.questionId !== null ? this.controle(`q${erreur.questionId}`) : undefined;
      if (index < 0 || !controle) {
        generales.push(erreur.message);
        continue;
      }
      controle.setErrors({ ...(controle.errors ?? {}), serveur: erreur.message });
      controle.markAsTouched();
      if (premiereSection === null || index < premiereSection) {
        premiereSection = index;
        premiereQuestion = erreur.questionId;
      }
    }
    this.erreursGenerales.set(generales);
    this.aCorriger.set(true);
    if (premiereSection !== null) {
      this.indexSection.set(premiereSection);
      this.sectionChangee.emit(premiereSection);
      this.focaliserQuestion(premiereQuestion!);
    } else {
      this.focaliser('.erreurs-generales');
    }
  }

  private allerA(index: number): void {
    this.indexSection.set(Math.min(Math.max(index, 0), this.sections().length - 1));
    this.sectionChangee.emit(this.indexSection());
    this.focaliser('.titre-section', 'start');
  }

  /** Marque la section comme touchée ; si une réponse est à corriger, la met en évidence et y place le focus. */
  private verifierSection(): boolean {
    const section = this.section();
    if (!section) {
      return false;
    }
    section.questions.forEach((q) => this.controle(cleReponse(q)).markAsTouched());
    const premiere = section.questions.find((q) => this.controle(cleReponse(q)).invalid);
    this.aCorriger.set(!!premiere);
    if (premiere) {
      this.focaliserQuestion(premiere.id);
    }
    return !premiere;
  }

  private focaliserQuestion(questionId: number): void {
    afterNextRender(
      () => {
        const bloc = this.hote.nativeElement.querySelector<HTMLElement>(`[data-question="${questionId}"]`);
        bloc?.scrollIntoView?.({ block: 'center' });
        bloc?.querySelector<HTMLElement>('input, textarea, button')?.focus();
      },
      { injector: this.injector },
    );
  }

  private focaliser(selecteur: string, bloc: ScrollLogicalPosition = 'center'): void {
    afterNextRender(
      () => {
        const element = this.hote.nativeElement.querySelector<HTMLElement>(selecteur);
        element?.scrollIntoView?.({ block: bloc });
        element?.focus();
      },
      { injector: this.injector },
    );
  }
}
