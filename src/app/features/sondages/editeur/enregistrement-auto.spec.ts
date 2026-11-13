import { DestroyRef } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { DELAI_ENREGISTREMENT_MS, EnregistrementAuto } from './enregistrement-auto';

describe('EnregistrementAuto', () => {
  let formulaire: FormGroup<{ titre: FormControl<string> }>;
  let envois: { requete: { titre: string }; reponse: Subject<unknown> }[];
  let auto: EnregistrementAuto<{ titre: string }>;
  const destroyRef = { onDestroy: () => () => undefined } as unknown as DestroyRef;

  function creer(enregistree: { titre: string } | null = { titre: 'Avant' }) {
    formulaire = new FormGroup({
      titre: new FormControl(enregistree?.titre ?? '', { nonNullable: true, validators: Validators.required }),
    });
    envois = [];
    auto = new EnregistrementAuto({
      formulaire,
      requete: () => ({ titre: formulaire.controls.titre.value }),
      envoyer: (requete) => {
        const reponse = new Subject<unknown>();
        envois.push({ requete, reponse });
        return reponse;
      },
      enregistree,
      destroyRef,
    });
  }

  function repondre(index = envois.length - 1): void {
    envois[index].reponse.next({});
    envois[index].reponse.complete();
  }

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('envoie 800 ms après la dernière frappe, puis « Enregistré »', () => {
    creer();
    formulaire.controls.titre.setValue('A');
    vi.advanceTimersByTime(DELAI_ENREGISTREMENT_MS - 1);
    formulaire.controls.titre.setValue('Après');
    vi.advanceTimersByTime(DELAI_ENREGISTREMENT_MS - 1);
    expect(envois.length).toBe(0);
    expect(auto.etat()).toBe('modifie');
    vi.advanceTimersByTime(1);
    expect(envois.map((e) => e.requete)).toEqual([{ titre: 'Après' }]);
    expect(auto.etat()).toBe('enregistrement');
    repondre();
    expect(auto.etat()).toBe('enregistre');
  });

  it('invalide : rien n’est envoyé, l’erreur s’affiche, et l’envoi reprend une fois corrigé', () => {
    creer();
    formulaire.controls.titre.setValue('');
    vi.advanceTimersByTime(DELAI_ENREGISTREMENT_MS);
    expect(envois.length).toBe(0);
    expect(auto.etat()).toBe('invalide');
    expect(formulaire.controls.titre.touched).toBe(true);
    formulaire.controls.titre.setValue('Corrigé');
    vi.advanceTimersByTime(DELAI_ENREGISTREMENT_MS);
    expect(envois.length).toBe(1);
  });

  it('sortie du champ : envoi immédiat ; rien si la requête est celle déjà enregistrée', () => {
    creer();
    formulaire.controls.titre.setValue('Avant');
    auto.maintenant();
    expect(envois.length).toBe(0);
    expect(auto.etat()).toBe('enregistre');
    formulaire.controls.titre.setValue('Nouveau');
    auto.maintenant();
    expect(envois.length).toBe(1);
    repondre();
    vi.advanceTimersByTime(DELAI_ENREGISTREMENT_MS);
    expect(envois.length).toBe(1);
  });

  it('modification pendant un envoi : renvoyée juste après', () => {
    creer();
    formulaire.controls.titre.setValue('Un');
    auto.maintenant();
    formulaire.controls.titre.setValue('Deux');
    auto.maintenant();
    expect(envois.length).toBe(1);
    repondre(0);
    expect(envois.map((e) => e.requete.titre)).toEqual(['Un', 'Deux']);
  });

  it('refus du serveur : état « erreur » avec l’erreur, puis « Réessayer »', () => {
    creer();
    formulaire.controls.titre.setValue('X');
    auto.maintenant();
    envois[0].reponse.error({ status: 400 });
    expect(auto.etat()).toBe('erreur');
    expect(auto.erreur()).toEqual({ status: 400 });
    auto.maintenant();
    expect(envois.length).toBe(2);
    expect(auto.erreur()).toBeNull();
  });

  it('rien d’enregistré (nouvelle question) : « non enregistré » dès le départ', () => {
    creer(null);
    expect(auto.etat()).toBe('modifie');
  });
});
