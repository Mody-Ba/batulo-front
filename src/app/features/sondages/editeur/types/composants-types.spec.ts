import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormArray } from '@angular/forms';
import { TypeQuestion } from '../../../../core/models/sondage.model';
import { EditeurListeTextes } from './editeur-liste-textes/editeur-liste-textes';
import { EditeurOptions } from './editeur-options/editeur-options';
import { changerType, creerFormulaireQuestion, FormulaireQuestion } from './formulaires-types';
import { QuestionChoixMultiple } from './question-choix-multiple/question-choix-multiple';
import { QuestionChoixUnique } from './question-choix-unique/question-choix-unique';
import { QuestionClassement } from './question-classement/question-classement';
import { QuestionDate } from './question-date/question-date';
import { QuestionEchelle } from './question-echelle/question-echelle';
import { QuestionMatrice } from './question-matrice/question-matrice';
import { QuestionNumerique } from './question-numerique/question-numerique';
import { QuestionOuiNon } from './question-oui-non/question-oui-non';
import { QuestionTexteCourt } from './question-texte-court/question-texte-court';
import { QuestionTexteLong } from './question-texte-long/question-texte-long';

/** Formulaire d'une question du type donné. */
function formulaire(type: TypeQuestion): FormulaireQuestion {
  const f = creerFormulaireQuestion(null);
  f.controls.libelle.setValue('Question');
  changerType(f, type);
  return f;
}

async function afficher<T>(composant: Type<T>, entrees: Record<string, unknown> = {}): Promise<ComponentFixture<T>> {
  const fixture = TestBed.createComponent(composant);
  for (const [nom, valeur] of Object.entries(entrees)) {
    fixture.componentRef.setInput(nom, valeur);
  }
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

function texte(fixture: ComponentFixture<unknown>): string {
  return (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ') ?? '';
}

function saisir(champ: HTMLInputElement, valeur: string | number): void {
  champ.value = String(valeur);
  champ.dispatchEvent(new Event('input'));
}

function champ(fixture: ComponentFixture<unknown>, nom: string): HTMLInputElement {
  return (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(`input[formcontrolname="${nom}"]`)!;
}

/** Marque tout comme touché pour afficher les erreurs, puis relance l'affichage. */
function toucher(fixture: ComponentFixture<unknown>, f: FormulaireQuestion): void {
  f.markAllAsTouched();
  fixture.detectChanges();
}

describe('Composants de type de question', () => {
  describe('choix unique, choix multiple, classement (options)', () => {
    it('chaque type affiche ses options avec son marqueur', async () => {
      const cas: [Type<unknown>, TypeQuestion, string][] = [
        [QuestionChoixUnique, 'CHOIX_UNIQUE', 'radio_button_unchecked'],
        [QuestionChoixMultiple, 'CHOIX_MULTIPLE', 'check_box_outline_blank'],
      ];
      for (const [composant, type, icone] of cas) {
        const fixture = await afficher(composant, { options: formulaire(type).controls.options });
        const element = fixture.nativeElement as HTMLElement;
        expect(element.querySelectorAll('input[formcontrolname="libelle"]').length, type).toBe(2);
        expect(element.querySelector(`mat-icon[fonticon="${icone}"]`), type).not.toBeNull();
      }
      const classement = await afficher(QuestionClassement, { options: formulaire('CLASSEMENT').controls.options });
      expect(
        Array.from((classement.nativeElement as HTMLElement).querySelectorAll('.rang')).map((r) => r.textContent?.trim()),
      ).toEqual(['1', '2']);
    });

    it('ajouter (bouton ou Entrée), supprimer, et message sous 2 options', async () => {
      const f = formulaire('CHOIX_UNIQUE');
      const fixture = await afficher(EditeurOptions, { options: f.controls.options });
      const element = fixture.nativeElement as HTMLElement;

      Array.from(element.querySelectorAll('button'))
        .find((b) => b.textContent?.includes('Ajouter une option'))!
        .click();
      expect(f.controls.options.length).toBe(3);

      element
        .querySelector<HTMLInputElement>('input[formcontrolname="libelle"]')!
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(f.controls.options.length).toBe(4);
      expect(f.controls.options.at(1).controls.libelle.value).toBe('Option 4');

      for (let i = 0; i < 3; i++) {
        element.querySelector<HTMLButtonElement>('button[aria-label^="Supprimer l’option"]')!.click();
      }
      fixture.detectChanges();
      expect(f.controls.options.length).toBe(1);
      expect(texte(fixture)).toContain('Ajoutez au moins 2 options.');
    });

    it('valeurs repliées par défaut ; affichées, une valeur en double est signalée', async () => {
      const f = formulaire('CHOIX_MULTIPLE');
      const fixture = await afficher(EditeurOptions, { options: f.controls.options });
      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelector('input[formcontrolname="valeur"]')).toBeNull();

      element.querySelector<HTMLButtonElement>('mat-slide-toggle button')!.click();
      fixture.detectChanges();
      const valeurs = element.querySelectorAll<HTMLInputElement>('input[formcontrolname="valeur"]');
      expect(valeurs.length).toBe(2);
      expect(texte(fixture)).toContain('Générée depuis le libellé');
      saisir(valeurs[0], 'x');
      saisir(valeurs[1], 'x');
      fixture.detectChanges();
      expect(texte(fixture)).toContain('La valeur « x » est utilisée par deux options.');
    });

    it('Alt + flèche réordonne les options au clavier', async () => {
      const f = formulaire('CLASSEMENT');
      f.controls.options.at(0).controls.libelle.setValue('Premier');
      const fixture = await afficher(EditeurOptions, { options: f.controls.options, marqueur: 'rang' });
      (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLButtonElement>('.poignee')!
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true }));
      expect(f.controls.options.controls.map((o) => o.controls.libelle.value)).toEqual(['Option 2', 'Premier']);
    });
  });

  it('oui / non : rien à configurer, aperçu des deux réponses', async () => {
    const fixture = await afficher(QuestionOuiNon);
    expect(texte(fixture)).toContain('Oui');
    expect(texte(fixture)).toContain('Non');
    expect((fixture.nativeElement as HTMLElement).querySelector('input')).toBeNull();
  });

  it('texte court et texte long : longueur maximale bornée (255, 5000)', async () => {
    const court = formulaire('TEXTE_COURT');
    const fixtureCourt = await afficher(QuestionTexteCourt, { configuration: court.controls.configuration });
    expect(champ(fixtureCourt, 'longueurMax').value).toBe('255');
    saisir(champ(fixtureCourt, 'longueurMax'), 300);
    toucher(fixtureCourt, court);
    expect(texte(fixtureCourt)).toContain('Entre 1 et 255 caractères.');

    const long = formulaire('TEXTE_LONG');
    const fixtureLong = await afficher(QuestionTexteLong, { configuration: long.controls.configuration });
    expect(champ(fixtureLong, 'longueurMax').value).toBe('2000');
    saisir(champ(fixtureLong, 'longueurMax'), '');
    toucher(fixtureLong, long);
    expect(texte(fixtureLong)).toContain('La longueur maximale est obligatoire.');
  });

  it('échelle : 1 à 5 par défaut, 1 à 10 au choix, aperçu des crans et libellé du dernier', async () => {
    const f = formulaire('ECHELLE');
    const fixture = await afficher(QuestionEchelle, { configuration: f.controls.configuration });
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('.cran').length).toBe(5);
    Array.from(element.querySelectorAll<HTMLButtonElement>('mat-button-toggle button'))
      .find((b) => b.textContent?.includes('1 à 10'))!
      .click();
    fixture.detectChanges();
    expect(f.controls.configuration.value.max).toBe(10);
    expect(element.querySelectorAll('.cran').length).toBe(10);
    expect(texte(fixture)).toContain('Libellé du 10 (facultatif)');
  });

  it('numérique : minimum ≤ maximum, décimales de 0 à 4', async () => {
    const f = formulaire('NUMERIQUE');
    const fixture = await afficher(QuestionNumerique, { configuration: f.controls.configuration });
    saisir(champ(fixture, 'min'), 10);
    saisir(champ(fixture, 'max'), 5);
    saisir(champ(fixture, 'decimales'), 6);
    toucher(fixture, f);
    expect(texte(fixture)).toContain('Le minimum doit être inférieur ou égal au maximum.');
    expect(texte(fixture)).toContain('Un nombre entier de 0 à 4.');
  });

  it('date : la date au plus tôt précède la date au plus tard', async () => {
    const f = formulaire('DATE');
    const fixture = await afficher(QuestionDate, { configuration: f.controls.configuration });
    saisir(champ(fixture, 'dateMin'), '2026-12-31');
    saisir(champ(fixture, 'dateMax'), '2026-01-01');
    fixture.detectChanges();
    expect(texte(fixture)).toContain('La date au plus tôt doit précéder ou égaler la date au plus tard.');
    expect(champ(fixture, 'dateMax').min).toBe('2026-12-31');
  });

  describe('matrice', () => {
    it('lignes et colonnes par défaut, ajout jusqu’au maximum, doublon signalé', async () => {
      const f = formulaire('MATRICE');
      const fixture = await afficher(QuestionMatrice, { configuration: f.controls.configuration });
      const element = fixture.nativeElement as HTMLElement;
      const listes = element.querySelectorAll('app-editeur-liste-textes');
      expect(listes[0].querySelectorAll('input').length).toBe(1);
      expect(listes[1].querySelectorAll('input').length).toBe(2);

      const colonnes = f.controls.configuration.controls['colonnes'] as FormArray;
      saisir(listes[1].querySelectorAll('input')[1] as HTMLInputElement, 'colonne 1');
      fixture.detectChanges();
      expect(texte(fixture)).toContain('« colonne 1 » apparaît deux fois.');

      const ajouter = Array.from(listes[1].querySelectorAll<HTMLButtonElement>('button')).find((b) =>
        b.textContent?.includes('Ajouter une colonne'),
      )!;
      for (let i = 0; i < 10; i++) {
        ajouter.click();
        fixture.detectChanges();
      }
      expect(colonnes.length).toBe(10);
      expect(ajouter.disabled).toBe(true);
    });

    it('éditeur de liste : supprimer sous le minimum affiche la règle', async () => {
      const f = formulaire('MATRICE');
      const colonnes = f.controls.configuration.controls['colonnes'] as FormArray;
      const fixture = await afficher(EditeurListeTextes, {
        liste: colonnes,
        titre: 'Colonnes',
        libelleElement: 'Colonne',
        element: 'une colonne',
        elements: 'colonnes',
        max: 10,
      });
      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[aria-label^="Supprimer"]')!.click();
      fixture.detectChanges();
      expect(texte(fixture)).toContain('De 2 à 10 colonnes.');
    });
  });

  it('formulaire désactivé (lecture seule) : champs et boutons désactivés', async () => {
    const f = formulaire('CHOIX_UNIQUE');
    f.disable();
    const fixture = await afficher(EditeurOptions, { options: f.controls.options });
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector<HTMLInputElement>('input')!.disabled).toBe(true);
    expect(
      Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
        b.textContent?.includes('Ajouter une option'),
      )!.disabled,
    ).toBe(true);
  });
});
