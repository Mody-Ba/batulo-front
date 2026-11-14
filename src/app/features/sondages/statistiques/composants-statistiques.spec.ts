import { HttpErrorResponse } from '@angular/common/http';
import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import { CroisementResponse, FiltresStatistiques, QuestionStat } from '../../../core/models/statistiques.model';
import { ExportService } from '../../../core/services/export.service';
import { StatistiquesService } from '../../../core/services/statistiques.service';
import { CarteQuestionStat } from './carte-question-stat';
import { BarresHorizontales } from './graphiques/barres-horizontales';
import { Colonnes } from './graphiques/colonnes';
import { TableauCroise } from './tableau-croise';

const FILTRES: FiltresStatistiques = { lignee: false, du: null, au: null, granularite: null, criteres: [] };

function stat(modifs: Partial<QuestionStat>): QuestionStat {
  return {
    questionId: 1,
    cle: 'cle-1',
    section: 'Profil',
    libelle: 'Votre région ?',
    type: 'CHOIX_UNIQUE',
    nombreRepondants: 120,
    sansReponse: 8,
    petitEffectif: false,
    ...modifs,
  };
}

/** Texte de chaque cellule (th, td, dt, dd) d'un élément, séparé par une espace. */
const cellules = (el: Element) =>
  Array.from(el.querySelectorAll('th, td, dt, dd'))
    .map((c) => c.textContent?.replace(/\s+/g, ' ').trim())
    .join(' ');

const texte = (f: ComponentFixture<unknown>) => (f.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ') ?? '';

describe('Composants des statistiques', () => {
  let service: Record<string, ReturnType<typeof vi.fn>>;
  let exports: Record<string, ReturnType<typeof vi.fn>>;

  async function afficher<T>(composant: Type<T>, entrees: Record<string, unknown>): Promise<ComponentFixture<T>> {
    const fixture = TestBed.createComponent(composant);
    for (const [nom, valeur] of Object.entries(entrees)) {
      fixture.componentRef.setInput(nom, valeur);
    }
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    service = { textes: vi.fn(), croisement: vi.fn() };
    exports = { croisement: vi.fn(() => of({ nom: 'x.pdf', contenu: new Blob() })), enregistrer: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: StatistiquesService, useValue: service },
        { provide: ExportService, useValue: exports },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    });
  });

  describe('graphiques', () => {
    it('barres : longueur relative au maximum, valeur en clair au bout, vue tableau équivalente', async () => {
      const f = await afficher(BarresHorizontales, {
        titre: 'Réponses à « Région »',
        barres: [
          { libelle: 'Kayes', valeur: 62, texte: '62 · 51,7 %' },
          { libelle: 'Dakar', valeur: 31, texte: '31 · 25,8 %' },
          { libelle: 'Autre', valeur: 0, texte: '0 · 0 %' },
        ],
      });
      const el = f.nativeElement as HTMLElement;
      const largeurs = Array.from(el.querySelectorAll<HTMLElement>('.remplissage')).map((b) => b.style.width);
      expect(largeurs).toEqual(['100%', '50%', '0%']);
      expect(el.querySelector('.barre')!.getAttribute('aria-label')).toBe('Kayes : 62 · 51,7 %');
      el.querySelector<HTMLButtonElement>('.bascule')!.click();
      f.detectChanges();
      expect(Array.from(el.querySelectorAll('tbody tr')).map(cellules)).toEqual([
        'Kayes 62 · 51,7 %',
        'Dakar 31 · 25,8 %',
        'Autre 0 · 0 %',
      ]);
      expect(el.querySelector('caption')!.textContent).toContain('Réponses à « Région »');
    });

    it('colonnes : hauteur relative, résumé lu par les lecteurs d’écran, étiquettes éclaircies si nombreuses', async () => {
      const colonnes = Array.from({ length: 20 }, (_, i) => ({ etiquette: String(i), libelle: String(i), nombre: i === 7 ? 40 : 10 }));
      const f = await afficher(Colonnes, { titre: 'Distribution de l’âge', colonnes });
      const el = f.nativeElement as HTMLElement;
      expect(el.querySelectorAll<HTMLElement>('.barre-colonne')[7].style.height).toBe('100%');
      expect(el.querySelectorAll<HTMLElement>('.barre-colonne')[0].style.height).toBe('25%');
      expect(el.querySelector('[role="img"]')!.getAttribute('aria-label')).toContain('la plus fréquente : 7 (40)');
      expect(el.querySelectorAll('.etiquette.masquee').length).toBeGreaterThan(0);
    });
  });

  describe('carte d’une question', () => {
    it('choix : barres avec effectif et part ; répondants et « sans réponse »', async () => {
      const f = await afficher(CarteQuestionStat, {
        question: stat({ options: [{ valeur: 'kayes', libelle: 'Kayes', nombre: 62, pourcentage: 51.7 }] }),
        numero: 1,
        sondageId: 3,
        filtres: FILTRES,
      });
      expect(texte(f)).toContain('120 répondants · 8 sans réponse');
      expect(texte(f)).toContain('62 · 51,7 %');
      expect(texte(f)).not.toContain('Moins de 5 répondants');
    });

    it('petit effectif signalé ; aucune réponse : message à la place du graphique', async () => {
      let f = await afficher(CarteQuestionStat, { question: stat({ nombreRepondants: 3, petitEffectif: true, options: [] }), numero: 1, sondageId: 3, filtres: FILTRES });
      expect(texte(f)).toContain('Moins de 5 répondants : résultats à interpréter avec prudence.');
      f = await afficher(CarteQuestionStat, { question: stat({ nombreRepondants: 0, sansReponse: 4, options: [] }), numero: 1, sondageId: 3, filtres: FILTRES });
      expect(texte(f)).toContain('Aucune réponse à cette question avec ces filtres.');
    });

    it('numérique : indicateurs et distribution (tranches absentes du JSON gérées)', async () => {
      const f = await afficher(CarteQuestionStat, {
        question: stat({
          type: 'NUMERIQUE',
          numerique: { moyenne: 22.4, mediane: 20, min: 2, max: 58, distribution: [{ de: 0, a: 12, nombre: 10, pourcentage: 8.3 }, { de: 12, a: 24, nombre: 60, pourcentage: 50 }] },
        }),
        numero: 2,
        sondageId: 3,
        filtres: FILTRES,
      });
      expect(cellules(f.nativeElement)).toContain('Moyenne 22,4 Médiane 20 Minimum 2 Maximum 58');
      const etiquettes = Array.from((f.nativeElement as HTMLElement).querySelectorAll('.etiquette')).map((e) => e.textContent?.trim());
      expect(etiquettes).toEqual(['0–12', '12–24']);
      expect(texte(f)).not.toContain('undefined');
    });

    it('classement : du mieux classé au moins bien classé, rang moyen', async () => {
      const f = await afficher(CarteQuestionStat, {
        question: stat({
          type: 'CLASSEMENT',
          classement: [
            { valeur: 'b', libelle: 'Qualité', rangMoyen: 2.4, nombrePremier: 10 },
            { valeur: 'a', libelle: 'Prix', rangMoyen: 1.3, nombrePremier: 70 },
          ],
        }),
        numero: 3,
        sondageId: 3,
        filtres: FILTRES,
      });
      const libelles = Array.from((f.nativeElement as HTMLElement).querySelectorAll('.libelle')).map((e) => e.textContent?.trim());
      expect(libelles).toEqual(['Prix', 'Qualité']);
      expect(texte(f)).toContain('rang moyen 1,3 · 1er : 70');
    });

    it('matrice : tableau, part et effectif par cellule', async () => {
      const f = await afficher(CarteQuestionStat, {
        question: stat({
          type: 'MATRICE',
          matrice: { colonnes: ['Bon', 'Mauvais'], lignes: [{ ligne: 'Accueil', nombre: 10, cellules: [{ colonne: 'Bon', nombre: 7, pourcentage: 70 }, { colonne: 'Mauvais', nombre: 3, pourcentage: 30 }] }] },
        }),
        numero: 4,
        sondageId: 3,
        filtres: FILTRES,
      });
      expect(cellules((f.nativeElement as HTMLElement).querySelector('tbody tr')!)).toBe('Accueil 70,0 % (7) 30,0 % (3) 10');
    });

    it('dates : répartition par période ; textes : page suivante avec les mêmes filtres', async () => {
      const dates = await afficher(CarteQuestionStat, {
        question: stat({ type: 'DATE', dates: { min: '2026-01-01', max: '2026-03-31', granularite: 'MOIS', repartition: [{ periode: '2026-01', nombre: 5 }, { periode: '2026-02', nombre: 9 }] } }),
        numero: 5,
        sondageId: 3,
        filtres: FILTRES,
      });
      expect((dates.nativeElement as HTMLElement).querySelectorAll('.barre-colonne').length).toBe(2);
      expect(texte(dates)).toContain('par mois');

      service['textes'].mockReturnValue(of({ contenu: [{ texte: 'Deuxième page', dateSoumission: '2026-11-02T10:00:00Z' }], page: 1, taille: 1, totalElements: 2, totalPages: 2 }));
      const f = await afficher(CarteQuestionStat, {
        question: stat({ type: 'TEXTE_LONG', textes: { contenu: [{ texte: 'Très bien', dateSoumission: '2026-11-03T10:00:00Z' }], page: 0, taille: 1, totalElements: 2, totalPages: 2 } }),
        numero: 6,
        sondageId: 3,
        filtres: FILTRES,
      });
      expect(texte(f)).toContain('Très bien');
      expect(texte(f)).toContain('Page 1 sur 2');
      Array.from((f.nativeElement as HTMLElement).querySelectorAll('button')).find((b) => b.textContent?.includes('Suivants'))!.click();
      f.detectChanges();
      expect(service['textes']).toHaveBeenCalledWith(3, 1, FILTRES, 1, 1);
      expect(texte(f)).toContain('Deuxième page');
    });
  });

  describe('tableau croisé', () => {
    const CROISEMENT: CroisementResponse = {
      question: { cle: 'q', libelle: 'Vacciné ?', type: 'OUI_NON' },
      par: { cle: 'r', libelle: 'Région', type: 'CHOIX_UNIQUE' },
      criteres: [],
      colonnes: [
        { valeur: 'kayes', libelle: 'Kayes', nombreRepondants: 50, petitEffectif: false },
        { valeur: null, libelle: 'Non renseigné', nombreRepondants: 3, petitEffectif: true },
      ],
      lignes: [
        {
          valeur: 'true',
          libelle: 'Oui',
          total: 42,
          cellules: [
            { colonne: 'kayes', nombre: 40, pourcentageLigne: 95.2, pourcentageColonne: 80, petitEffectif: false },
            { colonne: null, nombre: 2, pourcentageLigne: 4.8, pourcentageColonne: 66.7, petitEffectif: true },
          ],
        },
      ],
    };
    const QUESTIONS = [stat({ cle: 'q', type: 'OUI_NON', libelle: 'Vacciné ?' }), stat({ cle: 'txt', type: 'TEXTE_COURT', libelle: 'Nom' })];
    const CRITERES = [{ cle: 'r', questionId: 9, libelle: 'Région', type: 'CHOIX_UNIQUE' as const, valeurs: [] }];

    it('question croisable et critère choisis par défaut ; nombres, % ligne, % colonne ; petits effectifs signalés', async () => {
      service['croisement'].mockReturnValue(of(CROISEMENT));
      const f = await afficher(TableauCroise, { sondageId: 3, questions: QUESTIONS, criteres: CRITERES, filtres: FILTRES });
      expect(service['croisement']).toHaveBeenCalledWith(3, 'q', 'r', FILTRES);
      const el = f.nativeElement as HTMLElement;
      const ligne = () => cellules(el.querySelector('tbody tr')!);
      expect(ligne()).toBe('Oui 40 2 (petit effectif) 42');
      expect(el.querySelector('thead')!.textContent).toContain('Non renseigné');
      expect(el.querySelector('td.petit')).not.toBeNull();

      Array.from(el.querySelectorAll<HTMLButtonElement>('mat-button-toggle button')).find((b) => b.textContent?.includes('% ligne'))!.click();
      f.detectChanges();
      expect(ligne()).toContain('95,2 %');
      Array.from(el.querySelectorAll<HTMLButtonElement>('mat-button-toggle button')).find((b) => b.textContent?.includes('% colonne'))!.click();
      f.detectChanges();
      expect(ligne()).toContain('80,0 %');
    });

    it('numérique : statistiques par colonne ; export PDF avec les mêmes paramètres', async () => {
      service['croisement'].mockReturnValue(
        of({ ...CROISEMENT, lignes: undefined, numerique: [{ colonne: 'kayes', nombre: 50, moyenne: 21.5, mediane: 20, min: 2, max: 58, petitEffectif: false }] }),
      );
      const f = await afficher(TableauCroise, { sondageId: 3, questions: QUESTIONS, criteres: CRITERES, filtres: FILTRES });
      expect(cellules((f.nativeElement as HTMLElement).querySelector('tbody tr')!)).toBe('Kayes 50 21,5 20 2 58');
      (f.componentInstance as unknown as { exporter(format: string): void }).exporter('PDF');
      expect(exports['croisement']).toHaveBeenCalledWith(3, 'PDF', 'q', 'r', FILTRES);
      expect(exports['enregistrer']).toHaveBeenCalled();
    });

    it('sans critère ou sans question croisable : explication ; erreur du serveur affichée', async () => {
      let f = await afficher(TableauCroise, { sondageId: 3, questions: QUESTIONS, criteres: [], filtres: FILTRES });
      expect(texte(f)).toContain('au moins un critère d’analyse');
      service['croisement'].mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { code: 'X', message: 'Critère inconnu.' } })));
      f = await afficher(TableauCroise, { sondageId: 3, questions: QUESTIONS, criteres: CRITERES, filtres: FILTRES });
      expect(texte(f)).toContain('Critère inconnu.');
    });
  });
});
