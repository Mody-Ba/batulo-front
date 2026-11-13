import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import {
  afterNextRender,
  Component,
  ElementRef,
  Injector,
  inject,
  input,
  signal,
  viewChildren,
} from '@angular/core';
import { FormArray, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { messageErreurListe, REGLES_SONDAGE } from '../../../../../core/utils/regles-question';
import { ControleOption, creerControleOption } from '../formulaires-types';

/** Marqueur affiché devant chaque option (aperçu de ce que verra le répondant). */
export type MarqueurOption = 'rond' | 'case' | 'rang';

const ICONES: Record<Exclude<MarqueurOption, 'rang'>, string> = {
  rond: 'radio_button_unchecked',
  case: 'check_box_outline_blank',
};

/**
 * Options d'une question CHOIX_UNIQUE, CHOIX_MULTIPLE ou CLASSEMENT : libellé et valeur facultative (code stable des
 * statistiques, générée depuis le libellé si elle est vide, jamais régénérée ensuite), ajout (bouton ou Entrée),
 * suppression et réordonnancement (glisser-déposer). Au moins 2 options, valeurs uniques.
 */
@Component({
  selector: 'app-editeur-options',
  imports: [
    CdkDrag,
    CdkDragHandle,
    CdkDropList,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSlideToggleModule,
  ],
  templateUrl: './editeur-options.html',
  styleUrl: './editeur-options.scss',
})
export class EditeurOptions {
  private readonly injector = inject(Injector);
  protected readonly regles = REGLES_SONDAGE;
  protected readonly icones = ICONES;

  readonly options = input.required<FormArray<ControleOption>>();
  readonly marqueur = input<MarqueurOption>('rond');

  /** Les valeurs sont repliées par défaut : la plupart des gens n'y touchent pas. */
  protected readonly afficherValeurs = signal(false);

  private readonly champsLibelle = viewChildren<ElementRef<HTMLInputElement>>('champLibelle');

  protected erreurListe(): string | null {
    return messageErreurListe(this.options(), 'options');
  }

  protected ajouter(apres?: number): void {
    const options = this.options();
    const position = apres === undefined ? options.length : apres + 1;
    options.insert(position, creerControleOption({ libelle: `Option ${options.length + 1}` }));
    afterNextRender(
      () => {
        const champ = this.champsLibelle()[position]?.nativeElement;
        champ?.focus();
        champ?.select();
      },
      { injector: this.injector },
    );
  }

  protected supprimer(index: number): void {
    this.options().removeAt(index);
    afterNextRender(() => this.champsLibelle()[Math.max(0, index - 1)]?.nativeElement.focus(), {
      injector: this.injector,
    });
  }

  /** Entrée dans un libellé : nouvelle option juste après (comme dans Google Forms). */
  protected entree(evenement: Event, index: number): void {
    evenement.preventDefault();
    if (this.options().length < 100) {
      this.ajouter(index);
    }
  }

  protected deposer(evenement: CdkDragDrop<unknown>): void {
    this.deplacer(evenement.previousIndex, evenement.currentIndex);
  }

  protected deplacer(de: number, vers: number): void {
    const options = this.options();
    if (de === vers || vers < 0 || vers >= options.length) {
      return;
    }
    const controle = options.at(de);
    options.removeAt(de, { emitEvent: false });
    options.insert(vers, controle);
  }
}
