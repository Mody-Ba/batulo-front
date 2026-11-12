import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { TableauDeBordService } from './tableau-de-bord.service';

describe('TableauDeBordService', () => {
  it('lit le tableau de bord de l’entreprise du jeton, sans paramètre', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const serveur = TestBed.inject(HttpTestingController);
    TestBed.inject(TableauDeBordService).lire().subscribe();
    const requete = serveur.expectOne(`${environment.apiUrl}/api/admin/tableau-de-bord`);
    expect(requete.request.method).toBe('GET');
    expect(requete.request.params.keys()).toEqual([]);
    serveur.verify();
  });
});
