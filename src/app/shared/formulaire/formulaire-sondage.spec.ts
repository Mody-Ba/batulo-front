import { ComponentFixture, TestBed } from '@angular/core/testing';
import { questionDeTest, sectionDeTest } from '../../testing/donnees-test';
import { ContenuFormulaire, FormulaireSondage } from './formulaire-sondage';

const CONTENU: ContenuFormulaire = {
  titre: 'Satisfaction 2026',
  description: 'Trois minutes',
  sections: [
    sectionDeTest({
      id: 10,
      titre: 'Profil',
      questions: [
        questionDeTest({ id: 1, libelle: 'Votre secteur ?', obligatoire: true }),
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
        questionDeTest({
          id: 5,
          libelle: 'Services',
          type: 'MATRICE',
          options: [],
          configuration: { lignes: ['Accueil'], colonnes: ['Bon', 'Mauvais'] },
        }),
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

describe('FormulaireSondage (côté répondant)', () => {
  let fixture: ComponentFixture<FormulaireSondage>;

  async function creer(mode: 'apercu' | 'reponse' = 'apercu'): Promise<HTMLElement> {
    fixture = TestBed.createComponent(FormulaireSondage);
    fixture.componentRef.setInput('contenu', CONTENU);
    fixture.componentRef.setInput('mode', mode);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  function bouton(element: HTMLElement, texte: string): HTMLButtonElement {
    return Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes(texte))!;
  }

  function cliquer(element: HTMLElement, texte: string): void {
    bouton(element, texte).click();
    fixture.detectChanges();
  }

  it('une section par page, questions numérotées en continu ; les sections vides ne sont pas montrées', async () => {
    const element = await creer();
    expect(element.textContent).toContain('Satisfaction 2026');
    expect(element.textContent).toContain('Section 1 sur 2');
    expect(element.textContent).toContain('1. Votre secteur ?');
    expect(element.textContent).not.toContain('Note');
  });

  it('« Suivant » refuse une section incomplète, puis avance une fois corrigée', async () => {
    const element = await creer();
    cliquer(element, 'Suivant');
    expect(element.textContent).toContain('Cette question est obligatoire.');
    expect(element.textContent).toContain('Certaines réponses sont à corriger avant de continuer.');
    expect(element.textContent).toContain('Section 1 sur 2');

    element.querySelector<HTMLInputElement>('mat-radio-button input')!.click();
    cliquer(element, 'Suivant');
    expect(element.textContent).toContain('Section 2 sur 2');
    expect(element.textContent).toContain('3. Note');
    expect(element.textContent).toContain('Mauvais');

    cliquer(element, 'Précédent');
    expect(element.textContent).toContain('Section 1 sur 2');
  });

  it('chaque type a son champ côté répondant', async () => {
    const element = await creer();
    element.querySelector<HTMLInputElement>('mat-radio-button input')!.click();
    cliquer(element, 'Suivant');
    expect(element.querySelector('app-champ-echelle mat-button-toggle')).not.toBeNull();
    expect(element.querySelectorAll('app-champ-classement .rang-option').length).toBe(2);
    expect(element.querySelector('app-champ-matrice mat-radio-group')).not.toBeNull();
    expect(element.querySelector('app-champ-texte-long textarea')).not.toBeNull();
    expect(element.querySelector<HTMLInputElement>('app-champ-date input')!.type).toBe('date');
    expect(element.querySelectorAll('app-champ-oui-non mat-radio-button').length).toBe(2);
    expect(element.querySelectorAll('app-champ-choix-multiple mat-checkbox').length).toBe(2);
  });

  it('classement : descendre une option donne l’ordre complet en réponse', async () => {
    const element = await creer();
    element.querySelector<HTMLInputElement>('mat-radio-button input')!.click();
    cliquer(element, 'Suivant');
    element.querySelector<HTMLButtonElement>('button[aria-label="Descendre « Prix »"]')!.click();
    fixture.detectChanges();
    const libelles = Array.from(element.querySelectorAll('app-champ-classement .libelle-option')).map((e) =>
      e.textContent?.trim(),
    );
    expect(libelles).toEqual(['Qualité', 'Prix']);
    expect(element.textContent).toContain('Classement enregistré dans vos réponses.');
  });

  it('aperçu : rien n’est envoyé, « Vérifier » confirme seulement que les réponses sont valides', async () => {
    const element = await creer('apercu');
    const envoi = vi.fn();
    fixture.componentInstance.envoyer.subscribe(envoi);
    element.querySelector<HTMLInputElement>('mat-radio-button input')!.click();
    cliquer(element, 'Suivant');
    cliquer(element, 'Vérifier');
    expect(envoi).not.toHaveBeenCalled();
    expect(element.textContent).toContain('Vos réponses sont valides. Rien n’a été envoyé');
    cliquer(element, 'Recommencer');
    expect(element.textContent).toContain('Section 1 sur 2');
  });

  it('réponse (F6) : « Envoyer » émet les réponses données', async () => {
    const element = await creer('reponse');
    const envoi = vi.fn();
    fixture.componentInstance.envoyer.subscribe(envoi);
    element.querySelector<HTMLInputElement>('mat-radio-button input')!.click();
    cliquer(element, 'Suivant');
    cliquer(element, 'Envoyer');
    expect(envoi).toHaveBeenCalledWith([{ questionId: 1, valeur: 'agriculture' }]);
  });
});
