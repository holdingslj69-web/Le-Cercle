import { test } from "node:test";
import assert from "node:assert/strict";
import { siretValid, vatFromSiren, nafAllowed, normalizeNaf, evinTerms, maskContacts, postageEstimate, insuranceFee, shippingEstimate, half, unitPriceFor, priceLevel, requiredPhotos, isProducer } from "../lib/rules.ts";

test("SIRET : contrôle de Luhn", () => {
  assert.equal(siretValid("732 829 320 00074"), true);
  assert.equal(siretValid("73282932000075"), false);
  assert.equal(siretValid("1234"), false);
  assert.equal(siretValid("35600000000048"), true); // La Poste
});
test("TVA déduite du SIREN", () => assert.equal(vatFromSiren("732829320"), "FR44732829320"));
test("Codes NAF : restaurant oui, maçon non", () => {
  assert.equal(normalizeNaf("5610A"), "56.10A");
  assert.equal(nafAllowed("5610A"), true);
  assert.equal(nafAllowed("43.99C"), false);
  assert.equal(nafAllowed("43.21A"), false);
});
test("Loi Évin", () => {
  assert.deepEqual(evinTerms("Robe grenat, nez de cassis"), []);
  assert.ok(evinTerms("Un vin festif pour la détente").length >= 2);
});
test("Masquage des coordonnées", () => {
  const t = maskContacts("Appelle-moi au 06 12 34 56 78 ou jean@resto.fr, 2 bouteilles de 2019");
  assert.ok(!t.includes("06 12") && !t.includes("@"));
  assert.ok(t.includes("2019"));
});
test("Frais d'envoi partagés", () => {
  assert.equal(postageEstimate("75 cl", 1), 17.39 + 3); // 1,5 kg + 0,6 kg d'emballage : tranche 5 kg
  assert.equal(postageEstimate("75 cl", 12), 2 * (25.29 + 3));
  assert.equal(insuranceFee(100), 0);
  assert.equal(insuranceFee(400), 6);
  assert.equal(insuranceFee(151), 2.27);
  assert.equal(half(shippingEstimate("75 cl", 6, 552)), half(postageEstimate("75 cl", 6) + 8.28));
});
test("Prix au carton", () => {
  assert.equal(unitPriceFor(92, 2, 85, 3), 92);
  assert.equal(unitPriceFor(92, 3, 85, 3), 85);
  assert.equal(unitPriceFor(92, 6, null, null), 92);
});
test("Indicateur de prix", () => {
  assert.equal(priceLevel(100, { median: 100, n: 4 }).level, "ok");
  assert.equal(priceLevel(120, { median: 100, n: 4 }).level, "warn");
  assert.equal(priceLevel(140, { median: 100, n: 4 }).level, "high");
  assert.equal(priceLevel(300, null, 50, "2022", "Vin").level, "high");
  assert.equal(priceLevel(300, null, 50, "1990", "Vin").level, null); // vieux millésime : pas de jugement sur le prix d'achat
});
test("Photos obligatoires", () => {
  assert.equal(requiredPhotos("Vin", 1, false).length, 5);
  assert.equal(requiredPhotos("Vin", 3, false).length, 6);
  assert.equal(requiredPhotos("Spiritueux", 1, true).length, 2);
  assert.equal(isProducer("Vigneron / domaine"), true);
  assert.equal(isProducer("Restaurant"), false);
});
