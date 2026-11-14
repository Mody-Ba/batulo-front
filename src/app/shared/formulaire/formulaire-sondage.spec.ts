import { ComponentFixture, TestBed } from '@angular/core/testing';
import { questionDeTest, sectionDeTest } from '../../testing/donnees-test';
import { ContenuFormulaire, FormulaireSondage, ReponsesParQuestion } from './formulaire-sondage';

const CONTENU: ContenuFormulaire = {
  titre: 'Satisfaction 2026',
  description: 'Trois minutes',
  sections: [
    sectionDeTest({
      id: 10,
      titre: 'Profil',
      questions: [
        questionDeTest({ id: 1, libelle: 'Votre secteur ?', obligatoire: true, aide: 'Activité principale' }),
        questionDeTest({ id: 2, libelle: 'Âge', type: 'NUMERIQUE', options: [], configuration: { min: 18, decimales: 0 } }),
      ],
    }),
    sectionDeTest({
      id: 20,
      titre: 'Avis',
      questions: [
        questionDeTest({ id: 3, libelle: 'Note', type: 'ECHELLE', options: [], configuration: { min: 1, max: 5, libelleMin: 'Mauvais' } }),
        questionDeTest({
          id: 4,
          libelle: 'Préférences',
          type: 'CLASSEMENT',
          options: [
            { id: 41, libelle: 'Prix', valeur: 'prix', ordre: 1 },
            { id: 42, libelle: 'Qualité', valeur: 'qualite', ordre: 2 },
          ],
        }),
        questionDeTest({ id: 5, libelle: 'Services', type: 'MATRICE', options: [], configuration: { lignes: ['Accueil'], colonnes: ['Bon', 'Mauvais'] } }),
        questionDeTest({ id: 6, libelle: 'Commentaire', type: 'TEXTE_LONG', options: [], configuration: { longueurMax: 2000 } }),
        questionDeTest({ id: 7, libelle: 'Date de visite', type: 'DATE', options: [], configuration: {} }),
        questionDeTest({ id: 8, libelle: 'Recommanderiez-vous ?', type: 'OUI_NON', options: [] }),
        questionDeTest({ id: 9, libelle: 'Canaux', type: 'CHOIX_MULTIPLE' }),
      ],
    }),
    // Section vide : jamais affichée.
    sectionDeTest({ id: 30, titre: 'Vide', questions: [] }),
  ],
};

describe('FormulaireSondage (côté répondant, éléments natifs)', () => {
  let fixture: ComponentFixture<FormulaireSondage>;

  async function creer(entrees: Record<string, unknown> = {}): Promise<HTMLElement> {
    fixture = TestBed.createComponent(FormulaireSondage);
    fixture.componentRef.setInput('contenu', CONTENU);
    fixture.componentRef.setInput('mode', 'apercu');
    for (const [nom, valeur] of Object.entries(entrees)) {
      fixture.componentRef.setInput(nom, valeur);
    }
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  function cliquer(element: HTMLElement, texte: string): void {
    Array.from(element.querySelectorAll('button'))
      .find((b) => b.textContent?.includes(texte))!
      .click();
    fixture.detectChanges();
  }

  function choisirAgriculture(element: HTMLElement): void {
    element.querySelector<HTMLInputElement>('app-champ-choix-unique input[type="radio"]')!.click();
    fixture.detectChanges();
  }

  it('aucun composant Angular Material : éléments natifs seulement', async () => {
    const element = await creer();
    expect(element.querySelector('[class*="mat-"], [class*="mdc-"]')).toBeNull();
    expect(element.querySelectorAll('input[type="radio"]').length).toBe(2);
  });

  it('une section par page, numérotation continue, progression ; les sections vides ne sont pas montrées', async () => {
    const element = await creer();
    expect(element.textContent).toContain('Section 1 sur 2');
    expect(element.querySelector<HTMLProgressElement>('progress')!.value).toBe(1);
    expect(element.querySelector<HTMLProgressElement>('progress')!.max).toBe(2);
    expect(element.textContent).toContain('1. Votre secteur ?');
    expect(element.textContent).not.toContain('Note');
  });

  it('accessibilité : choix dans un fieldset/legend, saisie reliée à son label, aide et erreur reliées au champ', async () => {
    const element = await creer();
    const groupe = element.querySelector('[data-question="1"] fieldset')!;
    expect(groupe.querySelector('legend')!.textContent).toContain('Votre secteur ?');
    expect(groupe.textContent).toContain('(obligatoire)');
    const label = element.querySelector<HTMLLabelElement>('[data-question="2"] label.libelle')!;
    expect(element.querySelector(`#${label.htmlFor}`)!.tagName).toBe('INPUT');

    cliquer(element, 'Suivant');
    const radiogroup = element.querySelector('[data-question="1"] [role="radiogroup"]')!;
    expect(radiogroup.getAttribute('aria-describedby')).toBe('question-1-aide question-1-erreur');
    expect(radiogroup.getAttribute('aria-invalid')).toBe('true');
    expect(element.querySelector('#question-1-erreur')!.getAttribute('role')).toBe('alert');
  });

  it('« Suivant » refuse une section incomplète (focus sur la question), puis avance une fois corrigée', async () => {
    const element = await creer();
    cliquer(element, 'Suivant');
    expect(element.textContent).toContain('Cette question est obligatoire.');
    expect(element.textContent).toContain('Section 1 sur 2');
    await fixture.whenStable();
    expect(document.activeElement).toBe(element.querySelector('[data-question="1"] input'));

    choisirAgriculture(element);
    cliquer(element, 'Suivant');
    expect(element.textContent).toContain('Section 2 sur 2');
    expect(element.textContent).toContain('3. Note');
    cliquer(element, 'Précédent');
    expect(element.textContent).toContain('Section 1 sur 2');
  });

  it('chaque type a son champ natif côté répondant', async () => {
    const element = await creer();
    choisirAgriculture(element);
    cliquer(element, 'Suivant');
    expect(element.querySelectorAll('app-champ-echelle input[type="radio"]').length).toBe(5);
    expect(element.querySelector('app-champ-echelle input')!.getAttribute('aria-label')).toBe('1, Mauvais');
    expect(element.querySelectorAll('app-champ-classement .rang-option').length).toBe(2);
    expect(element.querySelectorAll('app-champ-matrice [role="radiogroup"] input[type="radio"]').length).toBe(2);
    expect(element.querySelector('app-champ-texte-long textarea')).not.toBeNull();
    expect(element.querySelector<HTMLInputElement>('app-champ-date input')!.type).toBe('date');
    expect(element.querySelectorAll('app-champ-oui-non input[type="radio"]').length).toBe(2);
    expect(element.querySelectorAll('app-champ-choix-multiple input[type="checkbox"]').length).toBe(2);
  });

  it('classement : Monter / Descendre au clavier, ordre complet en réponse, déplacement annoncé', async () => {
    const element = await creer();
    choisirAgriculture(element);
    cliquer(element, 'Suivant');
    element.querySelector<HTMLButtonElement>('button[aria-label^="Descendre « Prix »"]')!.click();
    fixture.detectChanges();
    const libelles = Array.from(element.querySelectorAll('app-champ-classement .libelle-option')).map((e) => e.textContent?.trim());
    expect(libelles).toEqual(['Qualité', 'Prix']);
    expect(element.querySelector('app-champ-classement [role="status"]')!.textContent).toContain('« Prix » est maintenant en position 2 sur 2.');
  });

  it('matrice et choix multiple : réponses complètes', async () => {
    const element = await creer({ mode: 'reponse' });
    const envoi = vi.fn();
    fixture.componentInstance.envoyer.subscribe(envoi);
    choisirAgriculture(element);
    cliquer(element, 'Suivant');
    element.querySelector<HTMLInputElement>('app-champ-matrice input[type="radio"]')!.click();
    element.querySelectorAll<HTMLInputElement>('app-champ-choix-multiple input')[1].click();
    fixture.detectChanges();
    cliquer(element, 'Envoyer mes réponses');
    expect(envoi).toHaveBeenCalledWith([
      { questionId: 1, valeur: 'agriculture' },
      { questionId: 5, valeur: { Accueil: 'Bon' } },
      { questionId: 9, valeur: ['commerce'] },
    ]);
  });

  it('aperçu : rien n’est envoyé, « Vérifier » confirme seulement que les réponses sont valides', async () => {
    const element = await creer();
    const envoi = vi.fn();
    fixture.componentInstance.envoyer.subscribe(envoi);
    choisirAgriculture(element);
    cliquer(element, 'Suivant');
    cliquer(element, 'Vérifier');
    expect(envoi).not.toHaveBeenCalled();
    expect(element.textContent).toContain('Vos réponses sont valides. Rien n’a été envoyé');
    cliquer(element, 'Recommencer');
    expect(element.textContent).toContain('Section 1 sur 2');
  });

  it('brouillon repris : réponses connues remises, section de reprise ; chaque saisie est émise', async () => {
    const initiales: ReponsesParQuestion = { 1: 'commerce', 3: 4, 999: 'question disparue' };
    const element = await creer({ mode: 'reponse', reponsesInitiales: initiales, sectionInitiale: 1 });
    expect(element.textContent).toContain('Section 2 sur 2');
    expect(element.querySelectorAll<HTMLInputElement>('app-champ-echelle input')[3].checked).toBe(true);
    cliquer(element, 'Précédent');
    expect(element.querySelectorAll<HTMLInputElement>('app-champ-choix-unique input')[1].checked).toBe(true);

    const saisies = vi.fn();
    fixture.componentInstance.reponsesModifiees.subscribe(saisies);
    element.querySelector<HTMLInputElement>('app-champ-choix-unique input')!.click();
    expect(saisies).toHaveBeenLastCalledWith({ 1: 'agriculture', 3: 4 });
  });

  it('refus du serveur : message sur la bonne question, sa section affichée ; corrigée, l’erreur disparaît', async () => {
    const element = await creer({ mode: 'reponse' });
    fixture.componentRef.setInput('erreursServeur', [
      { questionId: 6, message: 'Le texte ne doit pas dépasser 2000 caractères.' },
      { questionId: 12345, message: 'Question inconnue.' },
    ]);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element.textContent).toContain('Section 2 sur 2');
    expect(element.querySelector('[data-question="6"]')!.textContent).toContain('Le texte ne doit pas dépasser 2000 caractères.');
    expect(element.querySelector('.erreurs-generales')!.textContent).toContain('Question inconnue.');

    const zone = element.querySelector<HTMLTextAreaElement>('[data-question="6"] textarea')!;
    zone.value = 'Plus court';
    zone.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(element.querySelector('[data-question="6"]')!.textContent).not.toContain('2000 caractères.');
  });

  it('envoi en cours : bouton désactivé et « Envoi en cours… »', async () => {
    const element = await creer({ mode: 'reponse', sectionInitiale: 1, envoiEnCours: true });
    const bouton = Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes('Envoi en cours'))!;
    expect(bouton.disabled).toBe(true);
    expect(bouton.getAttribute('aria-busy')).toBe('true');
  });
});
