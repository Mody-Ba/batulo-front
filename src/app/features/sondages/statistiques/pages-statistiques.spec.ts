import { HttpErrorResponse } from '@angular/common/http';
import { signal, Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { StatistiquesResponse } from '../../../core/models/statistiques.model';
import { AuthService } from '../../../core/services/auth.service';
import { ExportService } from '../../../core/services/export.service';
import { SondageService } from '../../../core/services/sondage.service';
import { StatistiquesService } from '../../../core/services/statistiques.service';
import { questionDeTest, sectionDeTest, sondageDeTest } from '../../../testing/donnees-test';
import { DialogueReponse } from '../reponses/dialogue-reponse';
import { ListeReponses } from '../reponses/liste-reponses';
import { DialogueEnvoiStatistiques } from './dialogue-envoi-statistiques';
import { DialogueExport } from './dialogue-export';
import { FiltresStatistiquesComposant } from './filtres-statistiques';
import { PageStatistiques } from './page-statistiques';

const FILTRES = { lignee: false, du: null, au: null, granularite: null, criteres: [] as string[] };
const STATS: StatistiquesResponse = {
  sondageId: 3,
  titre: 'Satisfaction 2026',
  lignee: false,
  versions: [1],
  du: null,
  au: null,
  criteres: [],
  resume: { nombreReponses: 128, petitEffectif: false, premiereReponse: '2026-11-03T10:00:00Z', derniereReponse: '2026-11-28T10:00:00Z' },
  questions: [
    { questionId: 1, cle: 'q1', section: 'Profil', libelle: 'Région', type: 'CHOIX_UNIQUE', nombreRepondants: 120, sansReponse: 8, petitEffectif: false, options: [] },
    { questionId: 2, cle: 'q2', section: 'Avis', libelle: 'Note', type: 'ECHELLE', nombreRepondants: 100, sansReponse: 28, petitEffectif: false, numerique: { distribution: [] } },
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

describe('Pages des statistiques et des réponses', () => {
  let stats: Record<string, ReturnType<typeof vi.fn>>;
  let dialog: { open: ReturnType<typeof vi.fn> };
  const role = signal<'ADMIN' | 'GESTIONNAIRE'>('ADMIN');

  beforeEach(() => {
    role.set('ADMIN');
    stats = {
      statistiques: vi.fn(() => of(STATS)),
      criteres: vi.fn(() => of([])),
      croisement: vi.fn(() => of(null)),
      reponses: vi.fn(() =>
        of({
          contenu: [{ id: 41, sondageId: 3, version: 1, dateSoumission: '2026-11-04T10:00:00Z', valeurs: [{ questionId: 101, libelle: 'Secteur', type: 'CHOIX_UNIQUE', valeur: 'commerce' }] }],
          page: 0,
          taille: 20,
          totalElements: 1,
          totalPages: 1,
        }),
      ),
      envoyer: vi.fn(),
    };
    dialog = { open: vi.fn(() => ({ afterClosed: () => of(undefined) })) };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: StatistiquesService, useValue: stats },
        {
          provide: SondageService,
          useValue: {
            detail: vi.fn(() => of(sondageDeTest({ publie: true, statut: 'TERMINE', sections: [sectionDeTest({ questions: [questionDeTest(), questionDeTest({ id: 102, libelle: 'Âge', type: 'NUMERIQUE', options: [] })] })] }))),
            versions: vi.fn(() => of([])),
          },
        },
        { provide: AuthService, useValue: { role, lectureSeule: signal(false), utilisateur: signal({ id: 1 }) } },
        { provide: MatDialog, useValue: dialog },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        { provide: ExportService, useValue: { reponses: vi.fn(() => of({ nom: 'r.csv', contenu: new Blob() })), statistiques: vi.fn(() => of({ nom: 's.pdf', contenu: new Blob() })), enregistrer: vi.fn() } },
      ],
    });
  });

  it('statistiques : filtres de l’URL transmis, résumé, cartes regroupées par section', async () => {
    const f = await afficher(PageStatistiques, { id: '3', lignee: 'true', critere: ['region:kayes'] });
    expect(stats['statistiques']).toHaveBeenCalledWith(3, { lignee: true, du: null, au: null, granularite: null, criteres: ['region:kayes'] });
    expect(stats['criteres']).toHaveBeenCalledWith(3, true);
    expect(texte(f)).toContain('128 réponses');
    expect(Array.from((f.nativeElement as HTMLElement).querySelectorAll('.titre-section')).map((h) => h.textContent?.trim())).toEqual(['Profil', 'Avis']);
    expect(f.nativeElement.querySelectorAll('app-carte-question-stat').length).toBe(2);
  });

  it('changer un filtre le met dans l’URL', async () => {
    const f = await afficher(PageStatistiques, { id: '3' });
    const naviguer = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    (f.componentInstance as unknown as { changerFiltres(x: unknown): void }).changerFiltres({ ...FILTRES, du: '2026-11-01', criteres: ['a:1'] });
    expect(naviguer).toHaveBeenCalledWith([], {
      queryParams: { lignee: null, du: '2026-11-01', au: null, granularite: null, critere: ['a:1'] },
      queryParamsHandling: 'merge',
    });
  });

  it('« Envoyer à l’admin » : gestionnaire et sondage terminé seulement ; « Exporter » pour tous', async () => {
    let f = await afficher(PageStatistiques, { id: '3' });
    expect(texte(f)).toContain('Exporter');
    expect(texte(f)).not.toContain('Envoyer les statistiques à l’admin');
    role.set('GESTIONNAIRE');
    f = await afficher(PageStatistiques, { id: '3' });
    expect(texte(f)).toContain('Envoyer les statistiques à l’admin');
  });

  it('réponses : liste paginée (date, version) ; le détail s’ouvre avec le contenu du sondage', async () => {
    const f = await afficher(ListeReponses, { id: '3' });
    expect(stats['reponses']).toHaveBeenCalledWith(3, 0, 20, false);
    expect(texte(f)).toContain('N° 41');
    expect(texte(f)).toContain('Version 1');
    expect(texte(f)).toContain('1 question répondue sur 2');
    (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.reponse')!.click();
    expect(dialog.open.mock.calls[0][0]).toBe(DialogueReponse);
    expect(dialog.open.mock.calls[0][1].data.reponse.id).toBe(41);
  });

  it('réponses de toutes les versions : ?lignee=true transmis, version de chaque réponse, détail lu avec SA version', async () => {
    const sondages = TestBed.inject(SondageService) as unknown as Record<string, ReturnType<typeof vi.fn>>;
    sondages['versions'].mockReturnValue(of([{ id: 2, version: 1 }, { id: 3, version: 2 }]));
    const v1 = sondageDeTest({ id: 2, version: 1, sections: [sectionDeTest({ questions: [questionDeTest({ id: 55, libelle: 'Secteur (v1)' })] })] });
    stats['reponses'].mockReturnValue(
      of({ contenu: [{ id: 40, sondageId: 2, version: 1, dateSoumission: '2026-10-01T10:00:00Z', valeurs: [{ questionId: 55, libelle: 'Secteur (v1)', type: 'CHOIX_UNIQUE', valeur: 'agriculture' }] }], page: 0, taille: 20, totalElements: 1, totalPages: 1 }),
    );
    const f = await afficher(ListeReponses, { id: '3', lignee: 'true' });
    expect(stats['reponses']).toHaveBeenCalledWith(3, 0, 20, true);
    expect(texte(f)).toContain('Toutes les versions');
    expect(texte(f)).toContain('Version 1');
    expect(texte(f)).toContain('1 réponse pour toutes les versions');

    sondages['detail'].mockReturnValueOnce(of(v1));
    (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.reponse')!.click();
    expect(sondages['detail']).toHaveBeenLastCalledWith(2);
    expect(dialog.open.mock.calls[0][1].data.sondage.id).toBe(2);

    const naviguer = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    Array.from((f.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('mat-button-toggle button')).find((b) => b.textContent?.includes('Version'))!.click();
    expect(naviguer).toHaveBeenCalledWith([], { queryParams: { lignee: null, page: null }, queryParamsHandling: 'merge' });
  });

  it('détail d’une réponse : ordre du sondage, libellés des options, « Sans réponse »', async () => {
    TestBed.overrideProvider(MAT_DIALOG_DATA, {
      useValue: {
        reponse: { id: 41, sondageId: 3, version: 1, dateSoumission: '2026-11-04T10:00:00Z', valeurs: [{ questionId: 101, libelle: 'Secteur', type: 'CHOIX_UNIQUE', valeur: 'commerce' }] },
        sondage: sondageDeTest({ sections: [sectionDeTest({ titre: 'Profil', questions: [questionDeTest(), questionDeTest({ id: 102, libelle: 'Âge', type: 'NUMERIQUE', options: [] })] })] }),
      },
    });
    const f = await afficher(DialogueReponse);
    const lignes = Array.from((f.nativeElement as HTMLElement).querySelectorAll('.question')).map(
      (q) => `${q.querySelector('dt')!.textContent!.trim()} ${q.querySelector('dd')!.textContent!.replace(/\s+/g, ' ').trim()}`,
    );
    expect(lignes).toEqual(['1. Votre secteur ? Commerce', '2. Âge Sans réponse']);
  });

  it('export : CSV en codes et point décimal, filtres en cours ; erreur affichée dans la boîte', async () => {
    const reference = { close: vi.fn() };
    TestBed.overrideProvider(MAT_DIALOG_DATA, { useValue: { sondageId: 3, filtres: FILTRES, resume: ['Version 1'] } });
    TestBed.overrideProvider(MatDialogRef, { useValue: reference });
    const f = await afficher(DialogueExport);
    const composant = f.componentInstance as unknown as { choix: string; valeurs: string; separateur: string; exporter(): void };
    composant.choix = 'reponses-csv';
    composant.valeurs = 'CODES';
    composant.separateur = 'POINT';
    composant.exporter();
    const exports = TestBed.inject(ExportService) as unknown as Record<string, ReturnType<typeof vi.fn>>;
    expect(exports['reponses']).toHaveBeenCalledWith(3, 'CSV', FILTRES, 'CODES', 'POINT');
    expect(exports['enregistrer']).toHaveBeenCalled();
    expect(reference.close).toHaveBeenCalledWith(true);

    exports['statistiques'].mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500, error: { code: 'X', message: 'Le rapport a échoué.' } })));
    composant.choix = 'statistiques-pdf';
    composant.exporter();
    f.detectChanges();
    expect(texte(f)).toContain('Le rapport a échoué.');
  });

  it('envoi à l’admin : commentaire et filtres envoyés ; 409 SONDAGE_NON_TERMINE affiché', async () => {
    const reference = { close: vi.fn(), disableClose: false };
    TestBed.overrideProvider(MAT_DIALOG_DATA, { useValue: { sondageId: 3, filtres: { ...FILTRES, lignee: true, criteres: ['a:1'] }, resume: ['Toutes les versions'] } });
    TestBed.overrideProvider(MatDialogRef, { useValue: reference });
    stats['envoyer'].mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 409, error: { code: 'SONDAGE_NON_TERMINE', message: 'La version 2 n’est pas terminée.' } })),
    );
    const f = await afficher(DialogueEnvoiStatistiques);
    const zone = (f.nativeElement as HTMLElement).querySelector('textarea')!;
    zone.value = '  Résultats de Kayes  ';
    zone.dispatchEvent(new Event('input'));
    Array.from((f.nativeElement as HTMLElement).querySelectorAll('button')).find((b) => b.textContent?.includes('Envoyer'))!.click();
    f.detectChanges();
    expect(stats['envoyer']).toHaveBeenCalledWith(3, {
      commentaire: 'Résultats de Kayes',
      lignee: true,
      du: null,
      au: null,
      critere: ['a:1'],
      granulariteDate: null,
    });
    expect(texte(f)).toContain('La version 2 n’est pas terminée.');
    expect(reference.close).not.toHaveBeenCalled();
  });

  it('filtres : une liste par critère, pastilles retirables, « Tout effacer »', async () => {
    const f = await afficher(FiltresStatistiquesComposant, {
      filtres: { ...FILTRES, criteres: ['region:kayes'] },
      criteres: [{ cle: 'region', questionId: 1, libelle: 'Région', type: 'CHOIX_UNIQUE', valeurs: [{ valeur: 'kayes', libelle: 'Kayes' }] }],
      version: 2,
    });
    const emis = vi.fn();
    f.componentInstance.changer.subscribe(emis);
    expect(texte(f)).toContain('Version 2');
    expect(texte(f)).toContain('Région = Kayes');
    (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[aria-label="Retirer le filtre Région = Kayes"]')!.click();
    expect(emis).toHaveBeenLastCalledWith({ ...FILTRES, criteres: [] });
    Array.from((f.nativeElement as HTMLElement).querySelectorAll('button')).find((b) => b.textContent?.includes('Tout effacer'))!.click();
    expect(emis).toHaveBeenLastCalledWith(FILTRES);
  });
});
