const CFG = window.STEP3D_CONFIG;

export async function api(chemin, options = {}) {
  const reponse = await fetch(CFG.supabaseUrl + "/rest/v1/" + chemin, {
    ...options,
    headers: {
      apikey: CFG.supabaseKey,
      Authorization: "Bearer " + CFG.supabaseKey,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!reponse.ok) {
    throw new Error("Base de données : " + reponse.status + " " + (await reponse.text()));
  }
  const texte = await reponse.text();
  return texte ? JSON.parse(texte) : null;
}

export function chargerSujets() {
  return api("sujets?select=code,visites(id,numero,essais(id,numero,fichier,frequence_hz,nb_images))&order=code");
}

export function chargerEvenements(essaiId) {
  return api("evenements?select=id,pied,type,image&essai_id=eq." + essaiId + "&order=image");
}

export function creerEvenement(essaiId, pied, type, image) {
  return api("evenements?select=id,pied,type,image", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ essai_id: essaiId, pied, type, image }),
  }).then((lignes) => lignes[0]);
}

export function changerImageEvenement(id, image) {
  return api("evenements?id=eq." + id, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ image }),
  });
}

export async function chargerDonneesEssai(fichier) {
  const reponse = await fetch("essais/" + fichier);
  if (!reponse.ok) throw new Error("Fichier d'essai introuvable : " + fichier);
  return reponse.json();
}
