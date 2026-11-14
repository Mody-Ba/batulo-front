import { Component, computed, effect, ElementRef, inject, input, output, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { SectionResponse } from '../../core/models/sondage.model';
import { Encadre } from '../components/encadre/encadre';
import { QuestionRepondant } from './question-repondant';
import {
  cleReponse,
  creerFormulaireReponses,
  FormulaireReponses,
  ReponseQuestionRequest,
  reponsesAEnvoyer,
} from './reponses';

/** Ce qu'il faut pour afficher un formulaire (aperçu F5b, formulaire public F6). */
export interface ContenuFormulaire {
  titre: string;
  description: string | null;
  sections: SectionResponse[];
}

/**
 * Formulaire tel que le voit le répondant : une section par page (Précédent / Suivant, progression), questions
 * numérotées en continu. « Suivant » et « Envoyer » vérifient d'abord la section ; la première question à corriger
 * reçoit le focus. En aperçu, rien n'est envoyé : « Envoyer » vérifie seulement les réponses.
 * Mise en page selon la largeur du formulaire (container queries), pas de l'écran.
 */
@Component({
  selector: 'app-formulaire-sondage',
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule, Encadre, QuestionRepondant],
  templateUrl: './formulaire-sondage.html',
  styleUrl: './formulaire-sondage.scss',
})
export class FormulaireSondage {
  private readonly hote = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly cleReponse = cleReponse;

  readonly contenu = input.required<ContenuFormulaire>();
  /** apercu : rien n'est envoyé ; reponse : `envoyer` émet les réponses (F6). */
  readonly mode = input<'apercu' | 'reponse'>('reponse');
  readonly envoyer = output<ReponseQuestionRequest[]>();

  protected readonly reponses = signal<FormulaireReponses>(creerFormulaireReponses([]));
  protected readonly indexSection = signal(0);
  protected readonly aCorriger = signal(false);
  /** Aperçu : les réponses ont été vérifiées. */
  protected readonly verifie = signal(false);

  protected readonly sections = computed(() => this.contenu().sections.filter((s) => s.questions.length > 0));
  protected readonly section = computed(() => this.sections()[this.indexSection()] ?? null);
  protected readonly derniere = computed(() => this.indexSection() >= this.sections().length - 1);
  protected readonly progression = computed(() =>
    this.sections().length ? ((this.indexSection() + 1) / this.sections().length) * 100 : 0,
  );
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

  constructor() {
    effect(() => {
      const sections = this.contenu().sections;
      untracked(() => this.recommencer(sections));
    });
  }

  protected controle(cle: string) {
    return this.reponses().controls[cle];
  }

  protected precedent(): void {
    this.aCorriger.set(false);
    this.indexSection.update((i) => Math.max(0, i - 1));
    this.allerEnHaut();
  }

  protected suivant(): void {
    if (this.verifierSection()) {
      this.indexSection.update((i) => i + 1);
      this.allerEnHaut();
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

  protected recommencer(sections = this.contenu().sections): void {
    this.reponses.set(creerFormulaireReponses(sections));
    this.indexSection.set(0);
    this.aCorriger.set(false);
    this.verifie.set(false);
  }

  /** Marque la section comme touchée ; si une réponse est à corriger, la met en évidence et y place le focus. */
  private verifierSection(): boolean {
    const section = this.section();
    if (!section) {
      return false;
    }
    const controles = section.questions.map((q) => this.controle(cleReponse(q)));
    controles.forEach((c) => c.markAsTouched());
    const premiere = section.questions.find((q) => this.controle(cleReponse(q)).invalid);
    this.aCorriger.set(!!premiere);
    if (premiere) {
      queueMicrotask(() => {
        const bloc = this.hote.nativeElement.querySelector<HTMLElement>(`[data-question="${premiere.id}"]`);
        bloc?.scrollIntoView?.({ block: 'center' });
        bloc?.querySelector<HTMLElement>('input, textarea, button, [tabindex="0"]')?.focus();
      });
    }
    return !premiere;
  }

  private allerEnHaut(): void {
    queueMicrotask(() => {
      const titre = this.hote.nativeElement.querySelector<HTMLElement>('.titre-section');
      titre?.focus();
      titre?.scrollIntoView?.({ block: 'start' });
    });
  }
}
