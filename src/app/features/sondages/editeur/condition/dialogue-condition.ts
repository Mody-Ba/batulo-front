import { afterNextRender, Component, DestroyRef, ElementRef, inject, Injector, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { HttpErrorResponse } from '@angular/common/http';
import { filter, map, merge, Observable, timeout } from 'rxjs';
import {
  CombinaisonCondition,
  ConditionAffichage,
  libelleOperateur,
  OperateurCondition,
  operateurSansValeur,
  operateursPermis,
  QuestionResponse,
  REGLES_CONDITION_MAX,
  RegleCondition,
  SondageResponse,
  ValeurCondition,
} from '../../../../core/models/sondage.model';
import { confirmer } from '../../../../shared/components/dialogue-confirmation/dialogue-confirmation';
import { codeErreur, messageErreur } from '../../../../core/utils/erreur-http';
import { CibleCondition, SourceCondition, sourcesPossibles } from './condition-editeur';

export interface DonneesCondition {
  sondage: SondageResponse;
  cible: CibleCondition;
  /** « la question 3 », « la section 2 » (titre de la boîte). */
  nomCible: string;
  condition: ConditionAffichage | null;
  /** PUT .../condition par la file du store ; le sondage à jour, ou une erreur affichée dans la boîte. */
  enregistrer: (condition: ConditionAffichage) => Observable<SondageResponse>;
}

/** Saisie attendue pour la valeur d'une règle, selon le type de la source et l'opérateur. */
export type GenreValeur = 'aucune' | 'option' | 'options' | 'booleen' | 'nombre' | 'date' | 'intervalle-nombre' | 'intervalle-date';

export function genreValeur(source: QuestionResponse | undefined, operateur: OperateurCondition | null): GenreValeur {
  if (!source || !operateur || operateurSansValeur(operateur)) {
    return 'aucune';
  }
  switch (source.type) {
    case 'CHOIX_UNIQUE':
    case 'CHOIX_MULTIPLE':
      return operateur === 'PARMI' ? 'options' : 'option';
    case 'OUI_NON':
      return 'booleen';
    case 'DATE':
      return operateur === 'ENTRE' ? 'intervalle-date' : 'date';
    default:
      return operateur === 'ENTRE' ? 'intervalle-nombre' : 'nombre';
  }
}

type Saisie = string | number | boolean | null;

/** Au-delà, l'enregistrement est déclaré sans réponse (au lieu d'un bouton qui tourne sans fin). */
export const DELAI_ENREGISTREMENT_CONDITION_MS = 20_000;
export const MESSAGE_SANS_REPONSE = 'Le serveur n’a pas répondu : la condition n’a pas été enregistrée. Réessayez.';
export const MESSAGE_NON_ENREGISTREE =
  'Le serveur a répondu sans la condition : elle n’a pas été enregistrée. Réessayez ; si cela se reproduit, signalez le détail ci-dessous.';
export const MESSAGE_REGLES_INCOMPLETES = 'Une règle est incomplète : complétez les champs signalés en rouge, puis enregistrez.';

/** Condition de la cible (question ou section) dans le sondage renvoyé par le serveur. */
export function conditionDeLaCible(sondage: SondageResponse, cible: CibleCondition): ConditionAffichage | null {
  if (cible.type === 'section') {
    return sondage.sections.find((s) => s.id === cible.sectionId)?.condition ?? null;
  }
  return sondage.sections.flatMap((s) => s.questions).find((q) => q.id === cible.questionId)?.condition ?? null;
}

/** Erreur à montrer près du bouton : message et détail technique (statut HTTP, code), pour la signaler. */
export interface ErreurEnregistrement {
  message: string;
  detail: string | null;
}

export function erreurEnregistrement(erreur: unknown): ErreurEnregistrement {
  if (erreur instanceof HttpErrorResponse) {
    const code = codeErreur(erreur);
    return {
      message: messageErreur(erreur, 'La condition n’a pas pu être enregistrée.'),
      detail: `HTTP ${erreur.status}${code ? ` · ${code}` : ''} · ${erreur.url ?? ''}`.trim(),
    };
  }
  if (erreur instanceof Error && erreur.name === 'TimeoutError') {
    return { message: MESSAGE_SANS_REPONSE, detail: null };
  }
  return { message: erreur instanceof Error ? erreur.message : 'La condition n’a pas pu être enregistrée.', detail: null };
}

interface ControlesRegle {
  questionId: FormControl<number | null>;
  operateur: FormControl<OperateurCondition | null>;
  valeur: FormControl<Saisie>;
  valeurs: FormControl<string[]>;
  min: FormControl<string | number | null>;
  max: FormControl<string | number | null>;
}
type GroupeRegle = FormGroup<ControlesRegle>;

const vide = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

/**
 * Condition d'affichage d'une question ou d'une section : « Afficher si » [question placée avant] [opérateur]
 * [valeur], 1 à 10 règles reliées par ET (toutes) ou OU (au moins une). Opérateurs selon le type de la source ;
 * pour un choix, la valeur se choisit dans les options (sa `valeur`, jamais le libellé). Le serveur revérifie tout
 * (400 CONDITION_INVALIDE, 409) : son message s'affiche en haut de la boîte.
 */
@Component({
  selector: 'app-dialogue-condition',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatRadioModule,
    MatSelectModule,
  ],
  templateUrl: './dialogue-condition.html',
  styleUrl: './dialogue-condition.scss',
})
export class DialogueCondition {
  protected readonly donnees = inject<DonneesCondition>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<DialogueCondition, SondageResponse>>(MatDialogRef);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly hote = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly maxRegles = REGLES_CONDITION_MAX;
  protected readonly libelleOperateur = libelleOperateur;

  protected readonly sources: SourceCondition[] = sourcesPossibles(this.donnees.sondage, this.donnees.cible);
  /** Sources groupées par section (optgroup). */
  protected readonly groupes = this.sources.reduce<{ titre: string; sources: SourceCondition[] }[]>((groupes, source) => {
    const titre = `Section ${source.numeroSection} : ${source.section.titre}`;
    const dernier = groupes.at(-1);
    if (dernier?.titre === titre) {
      dernier.sources.push(source);
    } else {
      groupes.push({ titre, sources: [source] });
    }
    return groupes;
  }, []);

  protected readonly combinaison = new FormControl<CombinaisonCondition>(this.donnees.condition?.combinaison ?? 'ET', {
    nonNullable: true,
  });
  protected readonly regles = new FormArray<GroupeRegle>([]);
  protected readonly enCours = signal(false);
  /** Échec de l'enregistrement, affiché juste au-dessus du bouton (toujours visible). */
  protected readonly erreur = signal<ErreurEnregistrement | null>(null);
  protected readonly tentee = signal(false);
  /** Règles changées depuis l'ouverture et pas encore enregistrées (rien n'est enregistré sans le bouton). */
  protected readonly modifiee = signal(false);
  private readonly instantaneInitial: string;

  constructor() {
    const existantes = this.donnees.condition?.regles ?? [];
    (existantes.length ? existantes : [null]).forEach((regle) => this.regles.push(this.creerRegle(regle)));
    this.instantaneInitial = this.instantane();
    merge(this.regles.valueChanges, this.combinaison.valueChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.modifiee.set(this.instantane() !== this.instantaneInitial));

    // Échap, clic à côté et « Annuler » passent par fermer() : confirmation si des règles seraient perdues.
    this.ref.disableClose = true;
    this.ref
      .backdropClick()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.fermer());
    this.ref
      .keydownEvents()
      .pipe(
        filter((evenement) => evenement.key === 'Escape'),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((evenement) => {
        evenement.preventDefault();
        this.fermer();
      });
  }

  /** Fermer sans enregistrer : directement si rien n'a changé, sinon après confirmation. */
  fermer(): void {
    if (this.enCours()) {
      return;
    }
    if (!this.modifiee() || this.sources.length === 0) {
      this.ref.close();
      return;
    }
    confirmer(this.dialog, {
      titre: 'Fermer sans enregistrer ?',
      message: 'Les règles de cette condition d’affichage ne sont pas enregistrées : elles seront perdues.',
      action: 'Fermer sans enregistrer',
      destructive: true,
    }).subscribe((ok) => {
      if (ok) {
        this.ref.close();
      }
    });
  }

  /** État comparable de la saisie (combinaison et règles). */
  private instantane(): string {
    return JSON.stringify({ combinaison: this.combinaison.value, regles: this.regles.getRawValue() });
  }

  protected source(groupe: GroupeRegle): QuestionResponse | undefined {
    const id = groupe.controls.questionId.value;
    return this.sources.find((s) => s.question.id === id)?.question;
  }

  protected operateurs(groupe: GroupeRegle): OperateurCondition[] {
    const source = this.source(groupe);
    return source ? operateursPermis(source.type) : [];
  }

  protected genre(groupe: GroupeRegle): GenreValeur {
    return genreValeur(this.source(groupe), groupe.controls.operateur.value);
  }

  protected ajouterRegle(): void {
    if (this.regles.length >= this.maxRegles) {
      return;
    }
    this.regles.push(this.creerRegle(null));
    const index = this.regles.length - 1;
    afterNextRender(() => this.hote.nativeElement.querySelector<HTMLElement>(`#source-regle-${index}`)?.focus(), {
      injector: this.injector,
    });
  }

  protected retirerRegle(index: number): void {
    this.regles.removeAt(index);
  }

  protected valider(): void {
    this.tentee.set(true);
    this.regles.markAllAsTouched();
    if (this.enCours()) {
      return;
    }
    if (this.regles.invalid) {
      this.montrerErreur({ message: MESSAGE_REGLES_INCOMPLETES, detail: null });
      return;
    }
    const demande = this.requete();
    this.enCours.set(true);
    this.erreur.set(null);
    this.donnees
      .enregistrer(demande)
      .pipe(
        timeout({ first: DELAI_ENREGISTREMENT_CONDITION_MS }),
        // La boîte ne se ferme que si la réponse contient bien la condition de la cible.
        map((sondage) => {
          const enregistree = conditionDeLaCible(sondage, this.donnees.cible);
          if (!enregistree || enregistree.regles.length !== demande.regles.length) {
            throw new Error(MESSAGE_NON_ENREGISTREE);
          }
          return sondage;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (sondage) => this.ref.close(sondage),
        error: (erreur: unknown) => {
          this.enCours.set(false);
          this.montrerErreur(erreurEnregistrement(erreur));
        },
      });
  }

  private montrerErreur(erreur: ErreurEnregistrement): void {
    this.erreur.set(erreur);
    afterNextRender(() => this.hote.nativeElement.querySelector<HTMLElement>('.erreur-enregistrement')?.focus(), {
      injector: this.injector,
    });
  }

  /** Corps de PUT .../condition : valeur absente pour REPONDUE et NON_REPONDUE. */
  requete(): ConditionAffichage {
    return {
      combinaison: this.regles.length > 1 ? this.combinaison.value : 'ET',
      regles: this.regles.controls.map((groupe) => {
        const v = groupe.getRawValue();
        const regle: RegleCondition = { questionId: v.questionId!, operateur: v.operateur! };
        const valeur = this.valeurDe(groupe);
        if (valeur !== null) {
          regle.valeur = valeur;
        }
        return regle;
      }),
    };
  }

  /** Message de la première erreur d'une règle, ou null. */
  protected messageRegle(groupe: GroupeRegle): string | null {
    const e = groupe.errors;
    if (!e || !(groupe.touched || this.tentee())) {
      return null;
    }
    if (e['source']) {
      return 'Choisissez la question dont dépend l’affichage.';
    }
    if (e['operateur']) {
      return 'Choisissez une condition.';
    }
    if (e['valeur']) {
      return this.genre(groupe) === 'options' ? 'Choisissez au moins une option.' : 'Indiquez la valeur attendue.';
    }
    if (e['intervalle']) {
      return 'La première borne doit être inférieure ou égale à la seconde.';
    }
    return null;
  }

  private valeurDe(groupe: GroupeRegle): ValeurCondition | null {
    const v = groupe.getRawValue();
    switch (this.genre(groupe)) {
      case 'aucune':
        return null;
      case 'options':
        return v.valeurs;
      case 'intervalle-nombre':
        return [Number(v.min), Number(v.max)];
      case 'intervalle-date':
        return [String(v.min), String(v.max)];
      case 'nombre':
        return Number(v.valeur);
      default:
        return v.valeur as string | boolean;
    }
  }

  private creerRegle(regle: RegleCondition | null): GroupeRegle {
    const valeur = regle?.valeur;
    const groupe: GroupeRegle = new FormGroup<ControlesRegle>(
      {
        questionId: new FormControl<number | null>(regle?.questionId ?? null),
        operateur: new FormControl<OperateurCondition | null>(regle?.operateur ?? null),
        valeur: new FormControl<Saisie>(Array.isArray(valeur) ? null : (valeur ?? null)),
        valeurs: new FormControl<string[]>(
          regle?.operateur === 'PARMI' && Array.isArray(valeur) ? valeur.map(String) : [],
          { nonNullable: true },
        ),
        min: new FormControl<string | number | null>(regle?.operateur === 'ENTRE' && Array.isArray(valeur) ? valeur[0] : null),
        max: new FormControl<string | number | null>(regle?.operateur === 'ENTRE' && Array.isArray(valeur) ? valeur[1] : null),
      },
      { validators: (c) => this.verifierRegle(c as GroupeRegle) },
    );
    // Nouvelle source : premier opérateur permis, valeurs effacées ; nouvel opérateur : valeurs effacées.
    groupe.controls.questionId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      groupe.controls.operateur.setValue(this.operateurs(groupe)[0] ?? null);
    });
    groupe.controls.operateur.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      groupe.patchValue({ valeur: null, valeurs: [], min: null, max: null }, { emitEvent: false });
      groupe.updateValueAndValidity();
    });
    return groupe;
  }

  private verifierRegle(groupe: GroupeRegle): ValidationErrors | null {
    const v = groupe.getRawValue();
    if (!this.source(groupe)) {
      return { source: true };
    }
    if (!v.operateur || !this.operateurs(groupe).includes(v.operateur)) {
      return { operateur: true };
    }
    switch (this.genre(groupe)) {
      case 'aucune':
        return null;
      case 'options':
        return v.valeurs.length ? null : { valeur: true };
      case 'intervalle-nombre':
      case 'intervalle-date': {
        if (vide(v.min) || vide(v.max)) {
          return { valeur: true };
        }
        const nombres = this.genre(groupe) === 'intervalle-nombre';
        const [a, b] = nombres ? [Number(v.min), Number(v.max)] : [String(v.min), String(v.max)];
        return a > b ? { intervalle: true } : null;
      }
      default:
        return vide(v.valeur) ? { valeur: true } : null;
    }
  }
}
