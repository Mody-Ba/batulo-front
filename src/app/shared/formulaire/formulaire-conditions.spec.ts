import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConditionAffichage } from '../../core/models/sondage.model';
import { questionDeTest, sectionDeTest } from '../../testing/donnees-test';
import { ContenuFormulaire, FormulaireSondage, ReponsesParQuestion, texteAnnonce } from './formulaire-sondage';

const siEnfants: ConditionAffichage = { combinaison: 'ET', regles: [{ questionId: 1, operateur: 'EGAL', valeur: true }] };

// Q1 « Avez-vous des enfants ? » -> Q2 (obligatoire) si oui ; section 20 entière si oui ; section 30 toujours.
const CONTENU: ContenuFormulaire = {
  titre: 'Famille',
  description: null,
  sections: [
    sectionDeTest({
      id: 10,
      titre: 'Foyer',
      questions: [
        questionDeTest({ id: 1, libelle: 'Avez-vous des enfants ?', type: 'OUI_NON', options: [] }),
        questionDeTest({ id: 2, libelle: 'Combien ?', type: 'TEXTE_COURT', options: [], obligatoire: true, condition: siEnfants }),
      ],
    }),
    sectionDeTest({
      id: 20,
      titre: 'Scolarité',
      condition: siEnfants,
      questions: [questionDeTest({ id: 3, libelle: 'École ?', type: 'TEXTE_COURT', options: [], obligatoire: true })],
    }),
    sectionDeTest({
      id: 30,
      titre: 'Avis',
      questions: [questionDeTest({ id: 4, libelle: 'Commentaire', type: 'TEXTE_COURT', options: [] })],
    }),
  ],
};

describe('FormulaireSondage : conditions d’affichage en direct', () => {
  let fixture: ComponentFixture<FormulaireSondage>;
  let element: HTMLElement;

  async function creer(entrees: Record<string, unknown> = {}): Promise<void> {
    fixture = TestBed.createComponent(FormulaireSondage);
    element = fixture.nativeElement;
    fixture.componentRef.setInput('contenu', CONTENU);
    fixture.componentRef.setInput('mode', 'reponse');
    for (const [nom, valeur] of Object.entries(entrees)) {
      fixture.componentRef.setInput(nom, valeur);
    }
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const texte = () => (element.textContent ?? '').replace(/\s+/g, ' ');
  const question = (id: number) => element.querySelector(`[data-question="${id}"]`);
  const annonce = () => element.querySelector('[aria-live="polite"]')!.textContent!.trim();
  function cliquer(libelle: string): void {
    Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes(libelle))!.click();
    fixture.detectChanges();
  }
  function ouiNon(oui: boolean): void {
    element.querySelectorAll<HTMLInputElement>('app-champ-oui-non input')[oui ? 0 : 1].click();
    fixture.detectChanges();
  }
  function saisir(id: number, valeur: string): void {
    const champ = question(id)!.querySelector<HTMLInputElement>('input')!;
    champ.value = valeur;
    champ.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('au départ : question et section conditionnelles masquées, progression sur le visible', async () => {
    await creer();
    expect(question(1)).not.toBeNull();
    expect(question(2)).toBeNull();
    expect(texte()).toContain('Section 1 sur 2');
  });

  it('« Oui » : la question apparaît (transition, annonce), la section aussi ; « Non » : masquée et réponse effacée', async () => {
    await creer();
    const saisies = vi.fn();
    fixture.componentInstance.reponsesModifiees.subscribe(saisies);

    ouiNon(true);
    expect(question(2)).not.toBeNull();
    expect(question(2)!.closest('app-question-repondant')!.classList).toContain('apparition');
    expect(question(1)!.closest('app-question-repondant')!.classList).not.toContain('apparition');
    expect(annonce()).toBe('Nouvelle question affichée : « Combien ? ».');
    expect(texte()).toContain('Section 1 sur 3');
    expect(texte()).toContain('2. Combien ?');

    saisir(2, 'Trois');
    expect(saisies).toHaveBeenLastCalledWith({ 1: true, 2: 'Trois' });

    ouiNon(false);
    expect(question(2)).toBeNull();
    expect(annonce()).toBe('Une question n’est plus affichée.');
    expect(saisies).toHaveBeenLastCalledWith({ 1: false });
    expect(texte()).toContain('Section 1 sur 2');

    // Réaffichée : vide (la réponse a été effacée).
    ouiNon(true);
    expect(question(2)!.querySelector<HTMLInputElement>('input')!.value).toBe('');
  });

  it('question masquée obligatoire : n’empêche pas d’avancer ; section masquée sautée ; rien de masqué n’est envoyé', async () => {
    await creer();
    const envoi = vi.fn();
    fixture.componentInstance.envoyer.subscribe(envoi);
    ouiNon(false);
    cliquer('Suivant');
    expect(texte()).toContain('Section 2 sur 2');
    expect(texte()).toContain('Avis');
    expect(texte()).not.toContain('Scolarité');
    expect(texte()).toContain('2. Commentaire');
    cliquer('Précédent');
    expect(texte()).toContain('Foyer');
    cliquer('Suivant');
    cliquer('Envoyer mes réponses');
    expect(envoi).toHaveBeenCalledWith([{ questionId: 1, valeur: false }]);
  });

  it('question visible obligatoire : exigée ; la section qui apparaît se remplit avant d’envoyer', async () => {
    await creer();
    const envoi = vi.fn();
    fixture.componentInstance.envoyer.subscribe(envoi);
    ouiNon(true);
    cliquer('Suivant');
    expect(texte()).toContain('Cette question est obligatoire.');
    saisir(2, '2');
    cliquer('Suivant');
    expect(texte()).toContain('Scolarité');
    saisir(3, 'Lycée');
    cliquer('Suivant');
    cliquer('Envoyer mes réponses');
    expect(envoi).toHaveBeenCalledWith([
      { questionId: 1, valeur: true },
      { questionId: 2, valeur: '2' },
      { questionId: 3, valeur: 'Lycée' },
    ]);
  });

  it('brouillon repris : les réponses de questions masquées par ses propres réponses sont effacées', async () => {
    const initiales: ReponsesParQuestion = { 1: false, 2: 'Trois', 3: 'Lycée', 4: 'Bien' };
    await creer({ reponsesInitiales: initiales, sectionInitiale: 1 });
    expect(texte()).toContain('Section 2 sur 2');
    expect(texte()).toContain('Avis');
    const envoi = vi.fn();
    fixture.componentInstance.envoyer.subscribe(envoi);
    cliquer('Envoyer mes réponses');
    expect(envoi).toHaveBeenCalledWith([
      { questionId: 1, valeur: false },
      { questionId: 4, valeur: 'Bien' },
    ]);
  });

  it('texte des annonces', () => {
    const q = questionDeTest({ libelle: 'Âge ?' });
    expect(texteAnnonce([q], 0)).toBe('Nouvelle question affichée : « Âge ? ».');
    expect(texteAnnonce([q, q], 2)).toBe('2 nouvelles questions affichées. 2 questions ne sont plus affichées.');
    expect(texteAnnonce([], 0)).toBe('');
  });
});
