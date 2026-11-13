import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';
import {
  ConfigurationDate,
  ConfigurationEchelle,
  ConfigurationMatrice,
  ConfigurationNumerique,
  ConfigurationQuestion,
  ConfigurationTexte,
  OptionRequest,
  QuestionRequest,
  QuestionResponse,
  TYPES_AVEC_OPTIONS,
  TypeQuestion,
} from '../../../../core/models/sondage.model';
import {
  bornesOrdonnees,
  entier,
  listeTextes,
  optionsValides,
  REGLES_SONDAGE,
} from '../../../../core/utils/regles-question';
import { nonVide } from '../../../../core/utils/validateurs';

const R = REGLES_SONDAGE;

export type ControleOption = FormGroup<{
  /** Null pour une option pas encore enregistrée. */
  id: FormControl<number | null>;
  libelle: FormControl<string>;
  /** Vide : générée depuis le libellé (nouvelle option) ou gardée (option existante). */
  valeur: FormControl<string>;
}>;

export type ControlesTexte = { longueurMax: FormControl<number | null> };
export type ControlesEchelle = {
  max: FormControl<5 | 10>;
  libelleMin: FormControl<string>;
  libelleMax: FormControl<string>;
};
export type ControlesNumerique = {
  min: FormControl<number | null>;
  max: FormControl<number | null>;
  decimales: FormControl<number | null>;
};
export type ControlesDate = { dateMin: FormControl<string>; dateMax: FormControl<string> };
export type ControlesMatrice = {
  lignes: FormArray<FormControl<string>>;
  colonnes: FormArray<FormControl<string>>;
};

/** Configuration propre au type : remplacée (setControl) quand le type change. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FormulaireConfiguration = FormGroup<any>;

export type FormulaireQuestion = FormGroup<{
  libelle: FormControl<string>;
  aide: FormControl<string>;
  type: FormControl<TypeQuestion>;
  obligatoire: FormControl<boolean>;
  configuration: FormulaireConfiguration;
  options: FormArray<ControleOption>;
}>;

/** Type d'une nouvelle question, comme dans Google Forms. */
export const TYPE_PAR_DEFAUT: TypeQuestion = 'CHOIX_UNIQUE';

function texteObligatoire(max: number) {
  return new FormControl('', { nonNullable: true, validators: [Validators.required, nonVide, Validators.maxLength(max)] });
}

export function creerControleOption(option?: { id?: number | null; libelle: string; valeur?: string }): ControleOption {
  const controle = new FormGroup({
    id: new FormControl<number | null>(option?.id ?? null),
    libelle: texteObligatoire(R.libelleOptionMax),
    valeur: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(R.valeurOptionMax)] }),
  });
  controle.patchValue({ libelle: option?.libelle ?? '', valeur: option?.valeur ?? '' });
  return controle;
}

/** Texte d'une liste (ligne ou colonne de matrice). */
export function creerControleTexte(texte = ''): FormControl<string> {
  const controle = texteObligatoire(R.libelleConfigMax);
  controle.setValue(texte);
  return controle;
}

/** Formulaire de configuration du type, à partir de la configuration enregistrée (ou des valeurs par défaut). */
export function creerConfiguration(type: TypeQuestion, configuration?: ConfigurationQuestion): FormulaireConfiguration {
  switch (type) {
    case 'TEXTE_COURT':
    case 'TEXTE_LONG': {
      const max = type === 'TEXTE_COURT' ? R.texteCourtMax : R.texteLongMax;
      const defaut = type === 'TEXTE_COURT' ? R.texteCourtMax : R.texteLongDefaut;
      const c = configuration as Partial<ConfigurationTexte> | undefined;
      return new FormGroup<ControlesTexte>({
        longueurMax: new FormControl<number | null>(c?.longueurMax ?? defaut, [
          Validators.required,
          entier,
          Validators.min(1),
          Validators.max(max),
        ]),
      });
    }
    case 'ECHELLE': {
      const c = configuration as Partial<ConfigurationEchelle> | undefined;
      return new FormGroup<ControlesEchelle>({
        max: new FormControl<5 | 10>(c?.max === 10 ? 10 : 5, { nonNullable: true }),
        libelleMin: new FormControl(c?.libelleMin ?? '', {
          nonNullable: true,
          validators: [Validators.maxLength(R.libelleConfigMax)],
        }),
        libelleMax: new FormControl(c?.libelleMax ?? '', {
          nonNullable: true,
          validators: [Validators.maxLength(R.libelleConfigMax)],
        }),
      });
    }
    case 'NUMERIQUE': {
      const c = configuration as Partial<ConfigurationNumerique> | undefined;
      return new FormGroup<ControlesNumerique>(
        {
          min: new FormControl<number | null>(c?.min ?? null),
          max: new FormControl<number | null>(c?.max ?? null),
          decimales: new FormControl<number | null>(c?.decimales ?? 0, [
            Validators.required,
            entier,
            Validators.min(0),
            Validators.max(R.decimalesMax),
          ]),
        },
        { validators: bornesOrdonnees('min', 'max') },
      );
    }
    case 'DATE': {
      const c = configuration as Partial<ConfigurationDate> | undefined;
      return new FormGroup<ControlesDate>(
        {
          dateMin: new FormControl(c?.dateMin ?? '', { nonNullable: true }),
          dateMax: new FormControl(c?.dateMax ?? '', { nonNullable: true }),
        },
        { validators: bornesOrdonnees('dateMin', 'dateMax') },
      );
    }
    case 'MATRICE': {
      const c = configuration as Partial<ConfigurationMatrice> | undefined;
      const lignes = c?.lignes?.length ? c.lignes : ['Ligne 1'];
      const colonnes = c?.colonnes?.length ? c.colonnes : ['Colonne 1', 'Colonne 2'];
      return new FormGroup<ControlesMatrice>({
        lignes: new FormArray(
          lignes.map((t) => creerControleTexte(t)),
          listeTextes(1, R.matriceLignesMax),
        ),
        colonnes: new FormArray(
          colonnes.map((t) => creerControleTexte(t)),
          listeTextes(R.matriceColonnesMin, R.matriceColonnesMax),
        ),
      });
    }
    default:
      return new FormGroup({});
  }
}

/** Options par défaut d'une nouvelle question à options. */
function optionsParDefaut(): ControleOption[] {
  return [creerControleOption({ libelle: 'Option 1' }), creerControleOption({ libelle: 'Option 2' })];
}

/** Formulaire d'une question enregistrée, ou d'une nouvelle question (choix unique, deux options). */
export function creerFormulaireQuestion(question: QuestionResponse | null): FormulaireQuestion {
  const type = new FormControl<TypeQuestion>(question?.type ?? TYPE_PAR_DEFAUT, { nonNullable: true });
  const options = new FormArray<ControleOption>(
    question
      ? question.options.map((o) => creerControleOption({ id: o.id, libelle: o.libelle, valeur: o.valeur }))
      : optionsParDefaut(),
    optionsValides(() => (TYPES_AVEC_OPTIONS.has(type.value) ? R.optionsMin : 0)),
  );
  const formulaire: FormulaireQuestion = new FormGroup({
    libelle: texteObligatoire(R.libelleQuestionMax),
    aide: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(R.aideMax)] }),
    type,
    obligatoire: new FormControl(question?.obligatoire ?? false, { nonNullable: true }),
    configuration: creerConfiguration(type.value, question?.configuration),
    options,
  });
  formulaire.patchValue({ libelle: question?.libelle ?? '', aide: question?.aide ?? '' });
  return formulaire;
}

/** Changer de type ferait-il perdre des options ? (passage d'un type à options vers un type sans options) */
export function optionsPerdues(formulaire: FormulaireQuestion, nouveauType: TypeQuestion): boolean {
  return !TYPES_AVEC_OPTIONS.has(nouveauType) && formulaire.controls.options.length > 0;
}

/**
 * Change le type : la configuration repart des valeurs par défaut du nouveau type ; les options sont gardées entre
 * types à options, ajoutées (deux par défaut) vers un type à options, retirées sinon.
 */
export function changerType(formulaire: FormulaireQuestion, nouveauType: TypeQuestion): void {
  const options = formulaire.controls.options;
  formulaire.setControl('configuration', creerConfiguration(nouveauType), { emitEvent: false });
  if (TYPES_AVEC_OPTIONS.has(nouveauType)) {
    if (options.length === 0) {
      optionsParDefaut().forEach((o) => options.push(o, { emitEvent: false }));
    }
  } else {
    options.clear({ emitEvent: false });
  }
  formulaire.controls.type.setValue(nouveauType, { emitEvent: false });
  if (formulaire.disabled) {
    formulaire.disable({ emitEvent: false });
  }
  // Le minimum d'options dépend du type : la liste se revalide, puis un seul changement est émis.
  options.updateValueAndValidity({ emitEvent: false });
  formulaire.updateValueAndValidity();
}

function texteOuAbsent(valeur: string): string | undefined {
  const texte = valeur.trim();
  return texte ? texte : undefined;
}

function sansAbsents<T extends object>(objet: T): T {
  return Object.fromEntries(Object.entries(objet).filter(([, v]) => v !== undefined && v !== null)) as T;
}

/** Configuration à envoyer, selon le type (clés acceptées par le backend seulement). */
export function requeteConfiguration(type: TypeQuestion, configuration: FormulaireConfiguration): ConfigurationQuestion {
  const v = configuration.getRawValue();
  switch (type) {
    case 'TEXTE_COURT':
    case 'TEXTE_LONG':
      return { longueurMax: v.longueurMax };
    case 'ECHELLE':
      return sansAbsents<ConfigurationEchelle>({
        min: 1,
        max: v.max,
        libelleMin: texteOuAbsent(v.libelleMin),
        libelleMax: texteOuAbsent(v.libelleMax),
      });
    case 'NUMERIQUE':
      return sansAbsents<ConfigurationNumerique>({ min: v.min ?? undefined, max: v.max ?? undefined, decimales: v.decimales });
    case 'DATE':
      return sansAbsents<ConfigurationDate>({ dateMin: texteOuAbsent(v.dateMin), dateMax: texteOuAbsent(v.dateMax) });
    case 'MATRICE':
      return {
        lignes: (v.lignes as string[]).map((t) => t.trim()),
        colonnes: (v.colonnes as string[]).map((t) => t.trim()),
      };
    default:
      return {};
  }
}

/** Requête POST ou PUT d'une question, à partir de son formulaire (valide). */
export function requeteQuestion(formulaire: FormulaireQuestion): QuestionRequest {
  const v = formulaire.getRawValue();
  const options: OptionRequest[] = TYPES_AVEC_OPTIONS.has(v.type)
    ? v.options.map((o) =>
        sansAbsents<OptionRequest>({ id: o.id ?? undefined, libelle: o.libelle.trim(), valeur: texteOuAbsent(o.valeur) }),
      )
    : [];
  return {
    libelle: v.libelle.trim(),
    aide: texteOuAbsent(v.aide) ?? null,
    type: v.type,
    obligatoire: v.obligatoire,
    configuration: requeteConfiguration(v.type, formulaire.controls.configuration),
    options,
  };
}

/**
 * Après un enregistrement : reporte les ids des options créées et leurs valeurs générées (par position), pour que
 * les envois suivants modifient ces options au lieu d'en recréer. Le reste de la saisie n'est pas touché (la
 * personne a pu continuer à taper pendant l'envoi). Sans effet si la liste a changé de longueur entre-temps.
 */
export function appliquerReponse(formulaire: FormulaireQuestion, question: QuestionResponse): void {
  const options = formulaire.controls.options;
  if (options.length !== question.options.length) {
    return;
  }
  question.options.forEach((option, index) => {
    const controle = options.at(index);
    if (controle.controls.id.value === null) {
      controle.controls.id.setValue(option.id, { emitEvent: false });
    }
    if (!controle.controls.valeur.value.trim()) {
      controle.controls.valeur.setValue(option.valeur, { emitEvent: false });
    }
  });
}
