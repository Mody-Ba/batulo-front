import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { SuperAdminService } from '../../../../core/services/super-admin.service';
import { abonnementDeTest, adminDeTest, adminDetailDeTest, creditsDeTest, personnalisationDeTest } from '../../../../testing/donnees-test';
import { PaiementResponse } from '../../../../core/models/abonnement.model';
import { ActionsAdmin } from '../actions-admin';
import { DetailAdmin } from './detail-admin';

describe('DetailAdmin', () => {
  let fixture: ComponentFixture<DetailAdmin>;
  let detailAdmin: ReturnType<typeof vi.fn>;
  let achatsSondages: ReturnType<typeof vi.fn>;
  const pageAchats = (contenu: PaiementResponse[], totalElements = contenu.length, page = 0) => ({
    contenu,
    page,
    taille: 5,
    totalElements,
    totalPages: Math.ceil(totalElements / 5),
  });
  let actions: Record<string, ReturnType<typeof vi.fn>>;

  async function creer(): Promise<HTMLElement> {
    fixture = TestBed.createComponent(DetailAdmin);
    fixture.componentRef.setInput('id', '3');
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  function bouton(element: HTMLElement, libelle: string): HTMLButtonElement {
    return Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes(libelle))!;
  }

  beforeEach(() => {
    detailAdmin = vi.fn(() => of(adminDetailDeTest()));
    achatsSondages = vi.fn(() => of(pageAchats([])));
    actions = {
      basculerActif: vi.fn(() => of(adminDetailDeTest({ admin: adminDeTest({ actif: false }) }))),
      supprimer: vi.fn(() => of(true)),
    };
    TestBed.configureTestingModule({
      imports: [DetailAdmin],
      providers: [
        provideRouter([]),
        { provide: SuperAdminService, useValue: { detailAdmin, achatsSondages } },
        { provide: ActionsAdmin, useValue: actions },
      ],
    });
  });

  it('affiche l’entreprise, l’admin, l’abonnement, les jours restants et les gestionnaires', async () => {
    const element = await creer();
    expect(detailAdmin).toHaveBeenCalledWith(3);
    expect(element.textContent).toContain('Entreprise Test');
    expect(element.textContent).toContain('Fatou Sow');
    expect(element.textContent).toContain('fatou@test.local');
    expect(element.textContent).toContain('4 gestionnaires');
    expect(element.textContent).toContain('Formule mensuelle');
    expect(element.textContent).toContain('23 jours restants');
  });

  it('abonnement jamais payé : pas de date ni de jours restants', async () => {
    detailAdmin.mockReturnValue(
      of(
        adminDetailDeTest({
          abonnement: abonnementDeTest({
            statut: 'EN_ATTENTE_PAIEMENT',
            formule: null,
            dateDebut: null,
            dateExpiration: null,
            joursRestants: null,
            montant: null,
            devise: null,
          }),
        }),
      ),
    );
    const element = await creer();
    expect(element.textContent).toContain('En attente de paiement');
    expect(element.textContent).toContain('Aucune (jamais payé)');
    expect(element.textContent).not.toContain('jours restants');
  });

  it('désactiver passe le nombre de gestionnaires et affiche le nouvel état', async () => {
    const element = await creer();
    bouton(element, 'Désactiver l’entreprise').click();
    fixture.detectChanges();
    expect(actions['basculerActif']).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }), 4);
    expect(element.textContent).toContain('Désactivée');
    expect(bouton(element, 'Activer l’entreprise')).toBeTruthy();
  });

  it('après suppression, retour à la liste', async () => {
    const element = await creer();
    const naviguer = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    bouton(element, 'Supprimer').click();
    expect(actions['supprimer']).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }), 4);
    expect(naviguer).toHaveBeenCalledWith('/super-admin/admins');
  });

  it('apparence de l’entreprise en lecture seule : logo, nom affiché et couleur', async () => {
    detailAdmin.mockReturnValue(
      of(
        adminDetailDeTest({
          personnalisation: personnalisationDeTest({
            nomAffiche: 'Coopérative de Kaolack',
            nomEffectif: 'Coopérative de Kaolack',
            couleurPrincipale: '#1E6B52',
            couleurEffective: '#1E6B52',
            logo: { url: 'https://api.batulo.test/api/public/logos/2f1c', typeMime: 'image/png', taille: 1000, largeur: 40, hauteur: 40, dateModification: '2026-11-16T10:00:00Z' },
          }),
        }),
      ),
    );
    const element = await creer();
    const logo = element.querySelector<HTMLImageElement>('.logo-entreprise')!;
    expect(logo.getAttribute('alt')).toBe('Logo de Coopérative de Kaolack');
    expect(element.textContent).toContain('#1E6B52');
    expect(element.querySelector<HTMLElement>('.pastille-couleur')!.style.background).toContain('rgb(30, 107, 82)');
    expect(bouton(element, 'Supprimer le logo')).toBeUndefined();
  });

  it('sans logo : « Aucun » et la couleur Batulo signalée', async () => {
    detailAdmin.mockReturnValue(of(adminDetailDeTest({ personnalisation: personnalisationDeTest() })));
    const element = await creer();
    expect(element.textContent).toContain('#005CBB (couleur Batulo)');
    expect(element.querySelector('.logo-entreprise')).toBeNull();
  });

  describe('sondages achetés', () => {
    const carte = (el: HTMLElement) => el.querySelector<HTMLElement>('.carte-achats')!;
    const texte = (el: Element | null) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const ACHAT: PaiementResponse = {
      id: 9,
      datePaiement: '2026-11-20T15:00:00Z',
      formule: null,
      montant: 4000,
      devise: 'MRU',
      fournisseur: 'MOOSYL',
      type: 'ACHAT_SONDAGES',
      quantite: 20,
    };

    it('solde, total acheté et total utilisé ; historique des achats (date, quantité, moyen, montant)', async () => {
      detailAdmin.mockReturnValue(of(adminDetailDeTest({ credits: creditsDeTest({ solde: 12, totalAchete: 20, totalUtilise: 8 }) })));
      achatsSondages.mockReturnValue(of(pageAchats([ACHAT])));
      const el = await creer();
      expect(achatsSondages).toHaveBeenCalledWith(3, 0, 5);
      const valeurs = Array.from(carte(el).querySelectorAll('dd')).map((dd) => texte(dd));
      expect(valeurs).toEqual(['12', '20', '8']);
      const ligne = Array.from(carte(el).querySelectorAll('tbody td')).map((td) => texte(td));
      expect(ligne).toEqual(['20 nov. 2026', '20', 'Mobile', '4 000 MRU']);
      expect(carte(el).querySelector('mat-paginator')).toBeNull();
    });

    it('jamais acheté : message, et historique vide', async () => {
      const el = await creer();
      expect(texte(carte(el))).toContain('Cette entreprise n’a jamais acheté de sondages.');
      expect(texte(carte(el))).toContain('Aucun achat de sondages.');
    });

    it('plus de 5 achats : paginateur, page suivante relue', async () => {
      achatsSondages.mockReturnValue(of(pageAchats([ACHAT], 7)));
      const el = await creer();
      expect(carte(el).querySelector('mat-paginator')).not.toBeNull();
      carte(el).querySelector<HTMLButtonElement>('.mat-mdc-paginator-navigation-next')!.click();
      expect(achatsSondages).toHaveBeenLastCalledWith(3, 1, 5);
    });
  });
});
