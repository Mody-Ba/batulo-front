import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { FiltresStatistiques } from '../models/statistiques.model';
import { messageErreur } from '../utils/erreur-http';
import { ExportService, nomDepuisEntete } from './export.service';
import { StatistiquesService } from './statistiques.service';

const FILTRES: FiltresStatistiques = {
  lignee: true,
  du: '2026-11-01',
  au: '2026-11-30',
  granularite: 'MOIS',
  criteres: ['region:kayes', 'region:dakar', 'sexe:f'],
};

describe('StatistiquesService et ExportService', () => {
  let serveur: HttpTestingController;
  const url = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    serveur = TestBed.inject(HttpTestingController);
  });

  afterEach(() => serveur.verify());

  it('statistiques : lignée, période, granularité et critere répété (OU dans une clé, ET entre clés)', () => {
    TestBed.inject(StatistiquesService).statistiques(3, FILTRES).subscribe();
    const r = serveur.expectOne((req) => req.url === `${url}/api/sondages/3/statistiques`);
    expect(r.request.params.get('lignee')).toBe('true');
    expect(r.request.params.get('du')).toBe('2026-11-01');
    expect(r.request.params.get('au')).toBe('2026-11-30');
    expect(r.request.params.get('granulariteDate')).toBe('MOIS');
    expect(r.request.params.getAll('critere')).toEqual(['region:kayes', 'region:dakar', 'sexe:f']);
  });

  it('sans filtre : seulement lignee=false', () => {
    TestBed.inject(StatistiquesService).statistiques(3, { lignee: false, du: null, au: null, granularite: null, criteres: [] }).subscribe();
    const r = serveur.expectOne((req) => req.url === `${url}/api/sondages/3/statistiques`);
    expect(r.request.params.keys()).toEqual(['lignee']);
  });

  it('textes, critères, croisement, réponses, envoi : routes et paramètres', () => {
    const service = TestBed.inject(StatistiquesService);
    service.textes(3, 12, FILTRES, 2, 10).subscribe();
    service.criteres(3, true).subscribe();
    service.croisement(3, 'cle-q', 'cle-c', FILTRES).subscribe();
    service.reponses(3, 1, 20).subscribe();
    service.envoyer(3, { commentaire: 'Voici', lignee: false, du: null, au: null, critere: [], granulariteDate: null }).subscribe();

    const textes = serveur.expectOne((r) => r.url === `${url}/api/sondages/3/statistiques/questions/12/textes`);
    expect(textes.request.params.get('page')).toBe('2');
    expect(textes.request.params.has('granulariteDate')).toBe(false);
    expect(serveur.expectOne((r) => r.url === `${url}/api/sondages/3/statistiques/criteres`).request.params.get('lignee')).toBe('true');
    const croisement = serveur.expectOne((r) => r.url === `${url}/api/sondages/3/statistiques/croisement`);
    expect([croisement.request.params.get('question'), croisement.request.params.get('par')]).toEqual(['cle-q', 'cle-c']);
    expect(serveur.expectOne((r) => r.url === `${url}/api/sondages/3/reponses`).request.params.get('page')).toBe('1');
    expect(serveur.expectOne(`${url}/api/sondages/3/envois-statistiques`).request.body.commentaire).toBe('Voici');
  });

  it('nom du fichier lu dans Content-Disposition (forme UTF-8 prioritaire) ; absent : nom neutre', () => {
    expect(nomDepuisEntete(`attachment; filename="sante_v2.pdf"; filename*=UTF-8''sant%C3%A9_v2.pdf`)).toBe('santé_v2.pdf');
    expect(nomDepuisEntete('attachment; filename="sante_v2.pdf"')).toBe('sante_v2.pdf');
    expect(nomDepuisEntete(null)).toBeNull();

    const fichiers: string[] = [];
    const exports = TestBed.inject(ExportService);
    exports.statistiques(3, 'PDF', FILTRES).subscribe((f) => fichiers.push(f.nom));
    exports.reponses(3, 'CSV', FILTRES, 'CODES', 'POINT').subscribe((f) => fichiers.push(f.nom));
    const pdf = serveur.expectOne((r) => r.url === `${url}/api/sondages/3/export/statistiques`);
    expect(pdf.request.params.get('format')).toBe('PDF');
    expect(pdf.request.responseType).toBe('blob');
    pdf.flush(new Blob(['%PDF']), { headers: { 'Content-Disposition': 'attachment; filename="satisfaction_v1_statistiques_2026-11-14.pdf"' } });
    const csv = serveur.expectOne((r) => r.url === `${url}/api/sondages/3/export/reponses`);
    expect([csv.request.params.get('valeurs'), csv.request.params.get('separateurDecimal')]).toEqual(['CODES', 'POINT']);
    expect(csv.request.params.getAll('critere')).toEqual(FILTRES.criteres);
    csv.flush(new Blob(['a;b']));
    expect(fichiers).toEqual(['satisfaction_v1_statistiques_2026-11-14.pdf', 'reponses-sondage-3.csv']);
  });

  it('erreur d’un export (corps en Blob) : relue en JSON, son message s’affiche', async () => {
    let erreur: unknown;
    TestBed.inject(ExportService).statistiques(3, 'XLSX', FILTRES).subscribe({ error: (e) => (erreur = e) });
    serveur
      .expectOne((r) => r.url === `${url}/api/sondages/3/export/statistiques`)
      .flush(new Blob([JSON.stringify({ code: 'ACCES_REFUSE', message: 'Accès refusé à ce sondage.' })]), {
        status: 403,
        statusText: 'Forbidden',
      });
    await new Promise((r) => setTimeout(r));
    expect(erreur).toBeInstanceOf(HttpErrorResponse);
    expect(messageErreur(erreur)).toBe('Accès refusé à ce sondage.');
  });
});
