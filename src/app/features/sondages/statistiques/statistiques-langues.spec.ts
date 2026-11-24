import { signal, Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { FiltresStatistiques, StatistiquesResponse } from '../../../core/models/statistiques.model';
import { AuthService } from '../../../core/services/auth.service';
import { ExportService } from '../../../core/services/export.service';
import { SondageService } from '../../../core/services/sondage.service';
import { parametresFiltres, StatistiquesService } from '../../../core/services/statistiques.service';
import { sondageDeTest } from '../../../testing/donnees-test';
import { DialogueEnvoiStatistiques } from './dialogue-envoi-statistiques';
import { FiltresStatistiquesComposant } from './filtres-statistiques';
import { filtresDepuisUrl, parametresUrl } from './filtres-url';
import { PageStatistiques } from './page-statistiques';
import { resumeFiltres } from './resume-filtres';

const FILTRES: FiltresStatistiques = { lignee: false, du: null, au: null, granularite: null, criteres: [] };
const STATS: StatistiquesResponse = {
  sondageId: 3,
  titre: 'Satisfaction 2026',
  lignee: false,
  versions: [1],
  du: null,
  au: null,
  criteres: [],
  langue: 'ar',
  languesReponse: ['ar'],
  repartitionLangues: [{ langue: 'ar', nombre: 12 }],
  resume: { nombreReponses: 12, petitEffectif: false, premiereReponse: null, derniereReponse: null },
  questions: [
    {
      questionId: 5,
      cle: 'q5',
      section: 'Avis',
      libelle: 'الخدمات',
      type: 'MATRICE',
      nombreRepondants: 12,
      sansReponse: 0,
      petitEffectif: false,
      matrice: {
        colonnes: ['Bon', 'Mauvais'],
        libellesColonnes: ['جيد', 'سيئ'],
        lignes: [{ ligne: 'Accueil', libelle: 'الاستقبال', nombre: 12, cellules: [{ colonne: 'Bon', nombre: 12, pourcentage: 100 }, { colonne: 'Mauvais', nombre: 0, pourcentage: 0 }] }],
      },
    },
  ],
};

async function afficher<T>(composant: Type<T>, entrees: Record<string, unknown> = {}): Promise<ComponentFixture<T>> {
  const f = TestBed.createComponent(composant);
  for (const [nom, valeur] of Object.entries(entrees)) {
    f.componentRef.setInput(nom, valeur);
  }
  await f.whenStable();
  f.detectChanges();
  return f;
}

const texte = (f: ComponentFixture<unknown>) => (f.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ') ?? '';

describe('Statistiques : langue des libellés et filtre par langue de réponse', () => {
  let stats: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    stats = {
      statistiques: vi.fn(() => of(STATS)),
      criteres: vi.fn(() => of([])),
      envoyer: vi.fn(() => of({ id: 1 })),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: StatistiquesService, useValue: stats },
        {
          provide: SondageService,
          useValue: {
            detail: vi.fn(() => of(sondageDeTest({ publie: true, statut: 'EN_COURS', languePrincipale: 'fr', languesSupplementaires: ['ar'] }))),
            versions: vi.fn(() => of([])),
          },
        },
        { provide: AuthService, useValue: { role: signal('ADMIN'), lectureSeule: signal(false), utilisateur: signal({ id: 1 }) } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        { provide: ExportService, useValue: {} },
      ],
    });
  });

  it('URL : ?langue= et ?langueReponse= répété (codes inconnus ignorés), aller-retour sans perte', () => {
    const filtres = filtresDepuisUrl({ langue: 'ar', langueReponse: ['ar', 'xx', 'en', 'ar'] });
    expect(filtres).toEqual({ ...FILTRES, langue: 'ar', languesReponse: ['ar', 'en'] });
    expect(parametresUrl(filtres)).toMatchObject({ langue: 'ar', langueReponse: ['ar', 'en'] });
    expect(filtresDepuisUrl({ langue: 'de' })).toEqual(FILTRES);
  });

  it('paramètres envoyés partout (statistiques, textes, croisement, exports) : langue et langueReponse répété', () => {
    const params = parametresFiltres({ ...FILTRES, langue: 'en', languesReponse: ['fr', 'ar'] });
    expect(params.get('langue')).toBe('en');
    expect(params.getAll('langueReponse')).toEqual(['fr', 'ar']);
    expect(parametresFiltres(FILTRES).has('langue')).toBe(false);
  });

  it('page : filtres de l’URL transmis, critères dans la langue des libellés, réponses par langue, matrice traduite', async () => {
    const f = await afficher(PageStatistiques, { id: '3', langue: 'ar', langueReponse: 'ar' });
    expect(stats['statistiques']).toHaveBeenCalledWith(3, { ...FILTRES, langue: 'ar', languesReponse: ['ar'] });
    expect(stats['criteres']).toHaveBeenCalledWith(3, false, 'ar');
    expect(texte(f)).toContain('Réponses par langue');
    expect(texte(f)).toContain('Arabe : 12');
    expect(texte(f)).toContain('Réponses en Arabe');
    const matrice = (f.nativeElement as HTMLElement).querySelector('table.matrice')!;
    expect(matrice.textContent).toContain('جيد');
    expect(matrice.textContent).toContain('الاستقبال');
  });

  it('filtres : choix proposés seulement pour un sondage en plusieurs langues ; la principale sort de l’URL', async () => {
    let f = await afficher(FiltresStatistiquesComposant, { filtres: FILTRES, criteres: [], version: 1, langues: ['fr'] });
    expect(texte(f)).not.toContain('Langue de réponse');

    f = await afficher(FiltresStatistiquesComposant, { filtres: { ...FILTRES, languesReponse: ['ar'] }, criteres: [], version: 1, langues: ['fr', 'ar'] });
    const emis = vi.fn();
    f.componentInstance.changer.subscribe(emis);
    expect(texte(f)).toContain('Langue des libellés');
    expect(texte(f)).toContain('Langue de réponse');
    const composant = f.componentInstance as unknown as {
      changerLangue(l: string): void;
      changerLanguesReponse(l: string[]): void;
    };
    composant.changerLangue('ar');
    expect(emis).toHaveBeenLastCalledWith({ ...FILTRES, languesReponse: ['ar'], langue: 'ar' });
    composant.changerLangue('fr');
    expect(emis).toHaveBeenLastCalledWith({ ...FILTRES, languesReponse: ['ar'], langue: null });
    composant.changerLanguesReponse(['ar', 'fr']);
    expect(emis).toHaveBeenLastCalledWith({ ...FILTRES, languesReponse: ['fr', 'ar'] });

    (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[aria-label="Retirer le filtre Arabe"]')!.click();
    expect(emis).toHaveBeenLastCalledWith({ ...FILTRES, languesReponse: [] });
  });

  it('résumé des filtres (exports, envoi) : langues rappelées pour un sondage en plusieurs langues', () => {
    const filtres = { ...FILTRES, langue: 'en' as const, languesReponse: ['ar' as const] };
    expect(resumeFiltres(filtres, [], 1, true)).toEqual(['Version 1', 'Réponses en Arabe', 'Libellés en Anglais']);
    expect(resumeFiltres(filtres, [], 1)).toEqual(['Version 1']);
  });

  it('envoi à l’admin : langueReponse dans la demande', async () => {
    TestBed.overrideProvider(MAT_DIALOG_DATA, { useValue: { sondageId: 3, filtres: { ...FILTRES, languesReponse: ['ar'] }, resume: [] } });
    TestBed.overrideProvider(MatDialogRef, { useValue: { close: vi.fn(), disableClose: false } });
    const f = await afficher(DialogueEnvoiStatistiques);
    Array.from((f.nativeElement as HTMLElement).querySelectorAll('button')).find((b) => b.textContent?.includes('Envoyer'))!.click();
    expect(stats['envoyer']).toHaveBeenCalledWith(3, expect.objectContaining({ langueReponse: ['ar'] }));
  });
});
