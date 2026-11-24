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
import { QuestionAffichee, SectionAffichee } from '../../core/models/sondage.model';
import { evaluerVisibilite, Visibilite } from './conditions';
import { QuestionRepondant } from './question-repondant';
import {
  cleReponse,
  creerFormulaireReponses,
  FormulaireReponses,
  ReponseQuestionRequest,
  reponsesAEnvoyer,
  ValeurReponse,
} from './reponses';
import { TranslocoPipe } from '@jsverse/transloco';
import { definitionLangue, Langue } from '../../core/i18n/langues';
import { traduire, traduirePluriel } from '../../core/i18n/traduire';

/** Ce qu'il faut pour afficher un formulaire (aperçu F5b, formulaire public F6). */
export interface ContenuFormulaire {
  titre: string;
  description: string | null;
  sections: SectionAffichee[];
  /** Langue du contenu servie (aperçu, formulaire public) : lang et dir du formulaire (arabe : de droite à gauche). */
  langue?: Langue;
}

/**
 * Structure du formulaire (sections, questions, types, options et lignes de matrice) : la même dans toutes les langues
 * d'un sondage. Un contenu relu dans une autre langue garde donc les réponses en cours.
 */
export function structureFormulaire(sections: readonly SectionAffichee[]): string {
  return JSON.stringify(
    sections.map((s) => [
      s.id,
      s.condition ?? null,
      s.questions.map((q) => [q.id, q.type, q.obligatoire, q.configuration, q.options.map((o) => o.valeur), q.condition ?? null]),
    ]),
  );
}

/** Réponses en cours, par id de question (brouillon du navigateur). */
export type ReponsesParQuestion = Record<number, ValeurReponse>;

/**
 * Formulaire tel que le voit le répondant : une section par page (Précédent / Suivant, progression), questions
 * numérotées en continu. Conditions d'affichage (`conditions.ts`) évaluées en direct à chaque saisie : une question
 * masquée est désactivée (ni obligatoire ni validée), sa réponse effacée et jamais envoyée ; une section sans question
 * visible est sautée ; progression et numéros ne comptent que le visible ; apparitions annoncées (aria-live). « Suivant » et « Envoyer » vérifient d'abord la section ; la première question à corriger
 * reçoit le focus. Les refus du serveur (REPONSES_INVALIDES) sont posés sur leur question. En aperçu, rien n'est
 * envoyé : « Vérifier » contrôle seulement les réponses. Éléments natifs, sans Angular Material (formulaire public
 * léger) ; mise en page selon la largeur du formulaire (container queries), pas de l'écran.
 */
@Component({
  selector: 'app-formulaire-sondage',
  imports: [TranslocoPipe, QuestionRepondant],
  templateUrl: './formulaire-sondage.html',
  // Styles des champs en une seule copie (et non une par composant de champ), limités à app-formulaire-sondage.
  styleUrls: [
    './formulaire-sondage.scss',
    './champs/champs-choix.scss',
    './champs/champs-saisie.scss',
    './champs/champs-matrice.scss',
    './conditions.scss',
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
  /** Aperçu : « Recommencer » (la page revient à l'accueil s'il y en a un). */
  readonly recommence = output<void>();

  protected readonly reponses = signal<FormulaireReponses>(creerFormulaireReponses([]));
  protected readonly indexSection = signal(0);
  protected readonly aCorriger = signal(false);
  /** Aperçu : les réponses ont été vérifiées. */
  protected readonly verifie = signal(false);
  /** Erreurs du serveur qui ne correspondent à aucune question affichée. */
  protected readonly erreursGenerales = signal<string[]>([]);
  /** Réponses en cours, relues à chaque saisie : la visibilité en dépend. */
  private readonly valeurs = signal<ReponsesParQuestion>({});
  /** Questions qui viennent d'apparaître (transition discrète). */
  protected readonly apparues = signal<ReadonlySet<number>>(new Set());
  /** Annonce des questions apparues ou masquées dans la section affichée (lecteurs d'écran). */
  protected readonly annonce = signal('');

  protected readonly visibilite = computed<Visibilite>(() =>
    evaluerVisibilite(this.contenu().sections, (id) => this.valeurs()[id]),
  );
  /** Sections affichées, réduites à leurs questions visibles ; une section sans question visible est sautée. */
  protected readonly sections = computed(() => {
    const { sections, questions } = this.visibilite();
    return this.contenu()
      .sections.filter((s) => sections.has(s.id))
      .map((s) => ({ ...s, questions: s.questions.filter((q) => questions.has(q.id)) }))
      .filter((s) => s.questions.length > 0);
  });
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
  /** Structure du dernier formulaire construit (structureFormulaire). */
  private structure: string | null = null;
  /** lang et dir du formulaire selon la langue du contenu (absente : ceux de la page). */
  protected readonly dir = computed(() => {
    const langue = this.contenu().langue;
    return langue ? definitionLangue(langue).dir : null;
  });

  constructor() {
    effect(() => {
      const sections = this.contenu().sections;
      const structure = structureFormulaire(sections);
      if (structure === this.structure) {
        // Même formulaire dans une autre langue : seuls les textes changent, réponses et section sont gardées.
        return;
      }
      this.structure = structure;
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
    // Questions visibles seulement : une question masquée n'est jamais envoyée.
    const reponses = reponsesAEnvoyer(this.sections(), this.reponses());
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
    if (initiales) {
      for (const question of sections.flatMap((s) => s.questions)) {
        const valeur = initiales[question.id];
        if (valeur !== undefined) {
          formulaire.controls[cleReponse(question)].setValue(valeur, { emitEvent: false });
        }
      }
    }
    this.abonnement?.unsubscribe();
    this.reponses.set(formulaire);
    // Brouillon repris : les réponses des questions masquées par ses propres réponses sont effacées.
    this.appliquerConditions(false);
    this.abonnement = formulaire.valueChanges.subscribe(() => {
      this.appliquerConditions(true);
      this.reponsesModifiees.emit(this.valeursParQuestion());
    });
    this.indexSection.set(Math.min(Math.max(indexInitial, 0), Math.max(this.sections().length - 1, 0)));
    this.apparues.set(new Set());
    this.annonce.set('');
    this.aCorriger.set(false);
    this.verifie.set(false);
    this.erreursGenerales.set([]);
  }

  /**
   * Relit les réponses et la visibilité ; une question masquée est désactivée et sa réponse effacée (ce qui peut en
   * masquer d'autres : on recommence jusqu'à stabilité). `annoncer` : signale les changements de la section affichée.
   */
  private appliquerConditions(annoncer: boolean): void {
    const avant = this.visibilite().questions;
    const sectionAvant = this.section();
    let visibilite: Visibilite;
    for (let tour = 0; ; tour++) {
      this.valeurs.set(this.valeursParQuestion());
      visibilite = this.visibilite();
      const aEffacer = this.toutesLesQuestions().filter(
        (q) => !visibilite.questions.has(q.id) && this.controle(cleReponse(q))?.value !== null,
      );
      if (aEffacer.length === 0 || tour > 50) {
        break;
      }
      aEffacer.forEach((q) => this.controle(cleReponse(q)).setValue(null, { emitEvent: false }));
    }
    for (const question of this.toutesLesQuestions()) {
      const controle = this.controle(cleReponse(question));
      if (visibilite.questions.has(question.id)) {
        controle?.enable({ emitEvent: false });
      } else {
        controle?.disable({ emitEvent: false });
      }
    }
    if (!annoncer) {
      return;
    }
    const nouvelles = this.toutesLesQuestions().filter((q) => visibilite.questions.has(q.id) && !avant.has(q.id));
    this.apparues.set(new Set(nouvelles.map((q) => q.id)));
    // Section affichée : on reste dessus (ses propres réponses ne peuvent pas la masquer : sources placées avant).
    if (sectionAvant) {
      const index = this.sections().findIndex((s) => s.id === sectionAvant.id);
      if (index >= 0) {
        this.indexSection.set(index);
      }
      const ici = new Set(this.contenu().sections.find((x) => x.id === sectionAvant.id)?.questions.map((q) => q.id) ?? []);
      const apparuesIci = nouvelles.filter((q) => ici.has(q.id));
      const masqueesIci = [...avant].filter((id) => ici.has(id) && !visibilite.questions.has(id));
      this.annonce.set(texteAnnonce(apparuesIci, masqueesIci.length));
    }
  }

  private toutesLesQuestions(): QuestionAffichee[] {
    return this.contenu().sections.flatMap((s) => s.questions);
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
    this.apparues.set(new Set());
    this.annonce.set('');
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

/** « Nouvelle question affichée : « … ». », « 2 nouvelles questions affichées. », « Une question n'est plus affichée. » */
export function texteAnnonce(apparues: readonly QuestionAffichee[], masquees: number): string {
  const morceaux: string[] = [];
  if (apparues.length === 1) {
    morceaux.push(traduire('public.annonce.uneApparue', { libelle: apparues[0].libelle }));
  } else if (apparues.length > 1) {
    morceaux.push(traduirePluriel('public.annonce.apparues', apparues.length));
  }
  if (masquees === 1) {
    morceaux.push(traduire('public.annonce.uneMasquee'));
  } else if (masquees > 1) {
    morceaux.push(traduirePluriel('public.annonce.masquees', masquees));
  }
  return morceaux.join(' ');
}
