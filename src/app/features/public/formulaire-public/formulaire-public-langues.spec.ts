import { DOCUMENT } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TRADUCTIONS, traducteurStatique } from '../../../../test-providers';
import { LangueService } from '../../../core/i18n/langue.service';
import { CLE_STOCKAGE_LANGUE } from '../../../core/i18n/langues';
import { brancherTraductions } from '../../../core/i18n/traduire';
import { FormulairePublicResponse } from '../../../core/models/formulaire-public.model';
import { FormulairePublicService } from '../../../core/services/formulaire-public.service';
import { questionDeTest, sectionDeTest } from '../../../testing/donnees-test';
import { FormulairePublic } from './formulaire-public';

/** Même formulaire (mêmes ids, valeurs, lignes et colonnes) servi en français ou en arabe. */
function formulaire(langue: 'fr' | 'ar', modifs: Partial<FormulairePublicResponse> = {}): FormulairePublicResponse {
  const ar = langue === 'ar';
  return {
    titre: ar ? 'سوء التغذية' : 'Malnutrition',
    description: null,
    reponseUnique: false,
    dateFermeture: null,
    langue,
    languePrincipale: 'fr',
    languesDisponibles: ['fr', 'ar'],
    sections: [
      sectionDeTest({
        id: 1,
        titre: ar ? 'الطفل' : 'L’enfant',
        questions: [
          questionDeTest({ id: 1, libelle: ar ? 'هل تم تطعيمه؟' : 'Vacciné ?', type: 'OUI_NON', options: [], obligatoire: true }),
          questionDeTest({
            id: 2,
            libelle: ar ? 'الخدمات' : 'Services',
            type: 'MATRICE',
            options: [],
            configuration: { lignes: ['Accueil'], colonnes: ['Bon', 'Mauvais'] },
            ...(ar ? { libellesMatrice: { lignes: ['الاستقبال'], colonnes: ['جيد', 'سيئ'] } } : {}),
          }),
        ],
      }),
    ],
    ...modifs,
  };
}

describe('FormulairePublic : langue du contenu', () => {
  let fixture: ComponentFixture<FormulairePublic>;
  let service: { lire: ReturnType<typeof vi.fn>; repondre: ReturnType<typeof vi.fn> };
  const html = () => TestBed.inject(DOCUMENT).documentElement;

  async function creer(): Promise<HTMLElement> {
    fixture = TestBed.createComponent(FormulairePublic);
    fixture.componentRef.setInput('jeton', 'Ab3x');
    await stable();
    return fixture.nativeElement;
  }

  /** Relecture, chargement des textes et des données de langue (import dynamique), puis rendu. */
  async function stable(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      await fixture.whenStable();
      await new Promise((r) => setTimeout(r, 0));
    }
    fixture.detectChanges();
  }

  async function choisirLangue(element: HTMLElement, langue: string): Promise<void> {
    const select = element.querySelector<HTMLSelectElement>('.barre-langue select')!;
    select.value = langue;
    select.dispatchEvent(new Event('change'));
    await stable();
  }

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(CLE_STOCKAGE_LANGUE, '"fr"');
    service = {
      lire: vi.fn((_jeton: string, _repondant: string | null, langue?: string) => of(formulaire(langue === 'ar' ? 'ar' : 'fr'))),
      repondre: vi.fn(() => of({ message: 'Merci', dateSoumission: '2026-11-14T10:00:00Z' })),
    };
    TestBed.configureTestingModule({
      imports: [FormulairePublic],
      providers: [{ provide: FormulairePublicService, useValue: service }],
    });
  });

  afterEach(() => {
    localStorage.clear();
    html().lang = 'fr';
    html().dir = 'ltr';
    brancherTraductions(traducteurStatique(TRADUCTIONS['fr']), 'fr');
  });

  it('un seul sélecteur : seulement les langues du sondage ; le contenu suit sans perdre les réponses, en RTL pour l’arabe', async () => {
    const element = await creer();
    const options = Array.from(element.querySelectorAll('.barre-langue option')).map((o) => o.getAttribute('value'));
    expect(options).toEqual(['fr', 'ar']);

    element.querySelector<HTMLInputElement>('app-champ-oui-non input[type="radio"]')!.click();
    element.querySelector<HTMLInputElement>('app-champ-matrice input[type="radio"]')!.click();
    fixture.detectChanges();

    await choisirLangue(element, 'ar');

    expect(service.lire).toHaveBeenLastCalledWith('Ab3x', null, 'ar');
    expect(element.textContent).toContain('هل تم تطعيمه؟');
    // Matrice : libellés traduits (libellesMatrice).
    expect(element.querySelector('app-champ-matrice .matrice-libelle')!.textContent).toContain('الاستقبال');
    expect(element.querySelector('app-champ-matrice')!.textContent).toContain('جيد');
    // Réponses gardées.
    expect(element.querySelector<HTMLInputElement>('app-champ-oui-non input[type="radio"]')!.checked).toBe(true);
    expect(element.querySelector<HTMLInputElement>('app-champ-matrice input[type="radio"]')!.checked).toBe(true);
    // Contenu et interface en arabe, de droite à gauche.
    const article = element.querySelector('article.formulaire-sondage')!;
    expect(article.getAttribute('lang')).toBe('ar');
    expect(article.getAttribute('dir')).toBe('rtl');
    expect(html().dir).toBe('rtl');
    expect(TestBed.inject(LangueService).langue()).toBe('ar');
    // Le choix fait sur le formulaire n'est pas mémorisé pour le reste de l'application.
    expect(localStorage.getItem(CLE_STOCKAGE_LANGUE)).toBe('"fr"');
  });

  it('la langue servie est envoyée avec la réponse ; la matrice garde ses valeurs (langue principale)', async () => {
    const element = await creer();
    await choisirLangue(element, 'ar');
    element.querySelector<HTMLInputElement>('app-champ-oui-non input[type="radio"]')!.click();
    element.querySelector<HTMLInputElement>('app-champ-matrice input[type="radio"]')!.click();
    fixture.detectChanges();

    element.querySelector<HTMLButtonElement>('button.bouton.principal')!.click();
    fixture.detectChanges();

    const [, soumission] = service.repondre.mock.calls[0];
    expect(soumission.langue).toBe('ar');
    expect(soumission.reponses).toContainEqual({ questionId: 2, valeur: { Accueil: 'Bon' } });
  });

  it('langue de l’interface non proposée : contenu dans la langue principale, interface alignée (sans la mémoriser)', async () => {
    localStorage.setItem(CLE_STOCKAGE_LANGUE, '"en"');
    service.lire.mockImplementation(() => of(formulaire('fr')));
    await creer();

    expect(service.lire).toHaveBeenCalledWith('Ab3x', null, 'en');
    expect(TestBed.inject(LangueService).langue()).toBe('fr');
    expect(localStorage.getItem(CLE_STOCKAGE_LANGUE)).toBe('"en"');
  });

  it('sondage en une seule langue : sélecteur habituel de l’interface (trois langues), contenu inchangé', async () => {
    service.lire.mockImplementation(() => of(formulaire('fr', { languesDisponibles: ['fr'] })));
    const element = await creer();
    expect(element.querySelectorAll('.barre-langue option').length).toBe(3);

    await choisirLangue(element, 'en');
    expect(service.lire).toHaveBeenCalledTimes(1);
    expect(element.querySelector('article.formulaire-sondage')!.getAttribute('dir')).toBe('ltr');
  });
});
