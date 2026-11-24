import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { TexteTraduction, TraductionsLangueResponse } from '../../../core/models/traduction.model';
import { AuthService } from '../../../core/services/auth.service';
import { sondageDeTest } from '../../../testing/donnees-test';
import { EcranTraductions } from './ecran-traductions';
import { grouperTraductions } from './groupes-traductions';

function texte(modifs: Partial<TexteTraduction> & Pick<TexteTraduction, 'cle' | 'source'>): TexteTraduction {
  return {
    element: 'SONDAGE',
    champ: 'titre',
    sectionId: null,
    questionId: null,
    optionId: null,
    traduction: null,
    longueurMax: 200,
    ...modifs,
  };
}

const TEXTES: TexteTraduction[] = [
  texte({ cle: 'sondage.titre', source: 'Malnutrition', traduction: 'Malnutrition (en)' }),
  texte({ cle: 'section.3.titre', element: 'SECTION', champ: 'titre', sectionId: 3, source: 'L’enfant' }),
  texte({ cle: 'question.12.libelle', element: 'QUESTION', champ: 'libelle', sectionId: 3, questionId: 12, source: 'Âge ?', traduction: 'Age?' }),
  texte({ cle: 'option.40.libelle', element: 'OPTION', champ: 'libelle', sectionId: 3, questionId: 12, optionId: 40, source: 'Moins d’un an' }),
];

function reponse(textes: TexteTraduction[] = TEXTES, langue: 'en' | 'ar' = 'en'): TraductionsLangueResponse {
  const traduits = textes.filter((t) => t.traduction).length;
  return { sondageId: 1, langue, languePrincipale: 'fr', traduits, total: textes.length, complet: traduits === textes.length, textes };
}

describe('Écran « Traductions »', () => {
  const url = `${environment.apiUrl}/api/sondages/1`;
  let serveur: HttpTestingController;
  let fixture: ComponentFixture<EcranTraductions>;

  async function ouvrir(
    langue = 'en',
    { manquants, publie = false, donnees = reponse() }: { manquants?: string; publie?: boolean; donnees?: TraductionsLangueResponse } = {},
  ): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [EcranTraductions],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { role: signal('ADMIN'), utilisateur: signal({ id: 1 }), lectureSeule: signal(false) },
        },
      ],
    });
    serveur = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(EcranTraductions);
    fixture.componentRef.setInput('id', '1');
    fixture.componentRef.setInput('langue', langue);
    if (manquants) {
      fixture.componentRef.setInput('manquants', manquants);
    }
    fixture.detectChanges();
    serveur
      .expectOne(`${url}`)
      .flush(sondageDeTest({ id: 1, publie, statut: publie ? 'EN_COURS' : 'NON_COMMENCE', languePrincipale: 'fr', languesSupplementaires: ['en', 'ar'] }));
    serveur.expectOne(`${url}/traductions/${langue}`).flush(donnees);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  const champs = (el: HTMLElement) => Array.from(el.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('.champ-traduction input, .champ-traduction textarea'));
  const completude = (el: HTMLElement) => el.querySelector('.texte-completude')!.textContent!.trim();

  function saisir(el: HTMLElement, index: number, valeur: string): void {
    const champ = champs(el)[index];
    champ.value = valeur;
    champ.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  afterEach(() => serveur?.verify());

  it('regroupe par sondage, section et question (options avec leur question)', () => {
    const groupes = grouperTraductions(TEXTES);
    expect(groupes.map((g) => [g.cle, g.numero, g.nom, g.textes.length])).toEqual([
      ['sondage', 0, null, 1],
      ['section.3', 1, 'L’enfant', 1],
      ['question.12', 1, 'Âge ?', 2],
    ]);
  });

  it('côte à côte : texte principal en lecture seule, traduction à droite ; complétude en direct', async () => {
    const el = await ouvrir();
    expect(el.querySelector('h1')!.textContent).toContain('Traductions : Anglais');
    expect(el.querySelectorAll('.texte-source').length).toBe(4);
    expect(el.querySelector('.texte-source')!.getAttribute('lang')).toBe('fr');
    expect(champs(el).map((c) => c.value)).toEqual(['Malnutrition (en)', '', 'Age?', '']);
    expect(completude(el)).toBe('2 / 4 traduits');

    saisir(el, 1, 'The child');
    expect(completude(el)).toBe('3 / 4 traduits');
    expect(el.textContent).toContain('1 traduction pas encore enregistrée');
  });

  it('arabe : champ de traduction en dir="rtl" et lang="ar"', async () => {
    const el = await ouvrir('ar', { donnees: reponse(TEXTES, 'ar') });
    expect(champs(el).every((c) => c.getAttribute('dir') === 'rtl' && c.getAttribute('lang') === 'ar')).toBe(true);
    expect(el.querySelector('.texte-source')!.getAttribute('dir')).toBe('ltr');
  });

  it('filtre « seulement les textes manquants » : les textes à traduire restent visibles pendant la saisie', async () => {
    const el = await ouvrir('en', { manquants: 'true' });
    expect(el.querySelectorAll('.texte-source').length).toBe(2);
    expect(el.querySelector<HTMLInputElement>('.mat-mdc-checkbox input')!.checked).toBe(true);

    saisir(el, 0, 'The child');
    expect(el.querySelectorAll('.texte-source').length).toBe(2);

    el.querySelector<HTMLInputElement>('.mat-mdc-checkbox input')!.click();
    fixture.detectChanges();
    expect(el.querySelectorAll('.texte-source').length).toBe(4);
  });

  it('enregistrement en une fois : seulement les textes modifiés (vide = effacé), puis message de succès', async () => {
    const el = await ouvrir();
    saisir(el, 1, '  The child ');
    saisir(el, 2, '');
    el.querySelector<HTMLButtonElement>('button.enregistrer')!.click();
    fixture.detectChanges();

    const requete = serveur.expectOne(`${url}/traductions/en`);
    expect(requete.request.method).toBe('PUT');
    expect(requete.request.body).toEqual({
      textes: [
        { cle: 'section.3.titre', traduction: 'The child' },
        { cle: 'question.12.libelle', traduction: null },
      ],
    });
    requete.flush(
      reponse([TEXTES[0], { ...TEXTES[1], traduction: 'The child' }, { ...TEXTES[2], traduction: null }, TEXTES[3]]),
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('app-encadre[role="status"]')!.textContent).toContain('Traductions enregistrées : 2 / 4 traduits.');
    expect(el.textContent).not.toContain('pas encore enregistrée');
  });

  it('erreur du serveur affichée clairement, saisies gardées', async () => {
    const el = await ouvrir();
    saisir(el, 1, 'The child');
    el.querySelector<HTMLButtonElement>('button.enregistrer')!.click();
    serveur
      .expectOne(`${url}/traductions/en`)
      .flush({ code: 'TRADUCTION_INVALIDE', message: 'Traduction trop longue : section.3.titre.' }, { status: 400, statusText: 'Bad Request' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('[role="alert"]')!.textContent).toContain('Traduction trop longue : section.3.titre.');
    expect(champs(el)[1].value).toBe('The child');
  });

  it('sondage publié : lecture seule, sans bouton d’enregistrement', async () => {
    const el = await ouvrir('en', { publie: true });
    expect(el.querySelector('button.enregistrer')).toBeNull();
    expect(champs(el).every((c) => c.readOnly)).toBe(true);
    expect(el.textContent).toContain('Lecture seule');
  });

  it('quitter avec des saisies non enregistrées demande confirmation', async () => {
    const el = await ouvrir();
    let reponseQuitter: boolean | undefined;
    fixture.componentInstance.peutQuitter().subscribe((r) => (reponseQuitter = r));
    expect(reponseQuitter).toBe(true);
    saisir(el, 1, 'The child');
    fixture.componentInstance.peutQuitter().subscribe((r) => (reponseQuitter = r));
    await fixture.whenStable();
    expect(document.querySelector('mat-dialog-container')?.textContent).toContain('Quitter sans enregistrer ?');
  });
});
