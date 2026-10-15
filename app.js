import { chargerSujets, chargerEvenements, creerEvenement, changerImageEvenement, chargerDonneesEssai, api } from "./data.js";
import { creerScene } from "./scene.js";

const $ = (id) => document.getElementById(id);

const etat = {
  essai: null,
  donnees: null,
  evenements: [],
  image: 0,
  lecture: false,
  vitesse: 1,
  reste: 0,
  dernier: 0,
  chargement: 0,
};

let scene = null;

function el(tag, classe, texte) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  return e;
}

function montrer(texte) {
  $("message").textContent = texte;
}

function formaterTemps(image) {
  const secondes = image / etat.essai.frequence_hz;
  const minutes = Math.floor(secondes / 60);
  const reste = (secondes - minutes * 60).toFixed(2).padStart(5, "0");
  return String(minutes).padStart(2, "0") + ":" + reste;
}

function nomPied(pied) {
  return pied === "gauche" ? "G" : "D";
}

async function demarrer() {
  scene = creerScene($("scene"));
  brancher();
  requestAnimationFrame(tic);
  try {
    const [sujets, lignes] = await Promise.all([chargerSujets(), api("evenements?select=essai_id")]);
    const comptes = {};
    for (const l of lignes) comptes[l.essai_id] = (comptes[l.essai_id] || 0) + 1;
    afficherSidebar(sujets, comptes);
  } catch (err) {
    montrer(err.message);
  }
}

function afficherSidebar(sujets, comptes) {
  const liste = $("liste-sujets");
  liste.textContent = "";
  for (const s of sujets) {
    const bloc = el("div", "sujet");
    bloc.appendChild(el("div", "sujet-nom", s.code));
    for (const v of [...s.visites].sort((a, b) => a.numero - b.numero)) {
      bloc.appendChild(el("div", "visite-nom", "Visite " + v.numero));
      for (const e of [...v.essais].sort((a, b) => a.numero - b.numero)) {
        const bouton = el("button", "essai-btn");
        bouton.dataset.id = e.id;
        bouton.appendChild(el("span", "", "Essai " + e.numero));
        const n = comptes[e.id] || 0;
        bouton.appendChild(el("span", "badge" + (n ? " annote" : ""), n ? "annoté" : "à faire"));
        bouton.addEventListener("click", () => ouvrirEssai(s.code, v.numero, e, bouton));
        bloc.appendChild(bouton);
      }
    }
    liste.appendChild(bloc);
  }
}

function majBadge(essaiId) {
  const bouton = document.querySelector(".essai-btn[data-id='" + essaiId + "']");
  if (!bouton) return;
  const badge = bouton.querySelector(".badge");
  badge.textContent = "annoté";
  badge.classList.add("annote");
}

async function ouvrirEssai(sujet, visite, essai, bouton) {
  const jeton = ++etat.chargement;
  document.querySelectorAll(".essai-btn.actif").forEach((b) => b.classList.remove("actif"));
  bouton.classList.add("actif");
  etat.lecture = false;
  $("btn-lecture").textContent = "▶";
  montrer("");

  let donnees, evenements;
  try {
    [donnees, evenements] = await Promise.all([
      chargerDonneesEssai(essai.fichier),
      chargerEvenements(essai.id),
    ]);
  } catch (err) {
    if (jeton === etat.chargement) montrer(err.message);
    return;
  }
  if (jeton !== etat.chargement) return;

  etat.essai = { ...essai, sujet, visite };
  etat.donnees = donnees;
  etat.evenements = evenements;

  $("titre-essai").textContent = sujet + " · Visite " + visite + " · Essai " + essai.numero;
  $("infos-essai").textContent =
    donnees.nb_images + " images · " + essai.frequence_hz + " Hz · " +
    (donnees.nb_images / essai.frequence_hz).toFixed(1).replace(".", ",") + " s";
  $("curseur").max = donnees.nb_images - 1;

  scene.definirEssai(donnees);
  rendreFrise();
  rendreListe();
  allerA(0);
}

function allerA(image) {
  if (!etat.donnees) return;
  const dernier = etat.donnees.nb_images - 1;
  etat.image = Math.max(0, Math.min(dernier, Math.round(image)));
  scene.allerA(etat.image);
  $("curseur").value = etat.image;
  $("temps").textContent = formaterTemps(etat.image);
  majCartouche();
  majTete();
  majListeActive();
}

function majCartouche() {
  const i = etat.image;
  const sol = (pied) => (etat.donnees.contact_sol[pied][i] ? "au sol" : "levé");
  const classe = (pied) => (etat.donnees.contact_sol[pied][i] ? "vert" : "rouge");
  const c = $("cartouche");
  c.textContent = "";
  c.appendChild(el("div", "", "Image " + i + " / " + (etat.donnees.nb_images - 1) + " · " + formaterTemps(i)));
  for (const [pied, libelle] of [["gauche", "gauche"], ["droit", "droit"]]) {
    const ligne = el("div", "");
    ligne.appendChild(document.createTextNode("Pied " + libelle + " : "));
    ligne.appendChild(el("span", classe(pied), sol(pied)));
    c.appendChild(ligne);
  }
}

function rendreFrise() {
  for (const pied of ["gauche", "droit"]) {
    const zone = $("frise-" + pied);
    zone.textContent = "";
    for (const evt of etat.evenements.filter((x) => x.pied === pied)) {
      const marque = el("div", "marque " + pied + " " + evt.type);
      marque.style.left = (evt.image / (etat.donnees.nb_images - 1)) * 100 + "%";
      marque.title = (evt.type === "pose" ? "Pose " : "Lever ") + nomPied(pied) + " · img " + evt.image;
      marque.addEventListener("click", (e) => {
        e.stopPropagation();
        allerA(evt.image);
      });
      zone.appendChild(marque);
    }
    const tete = el("div", "tete");
    tete.dataset.tete = pied;
    zone.appendChild(tete);
  }
  majTete();
}

function majTete() {
  if (!etat.donnees) return;
  const fraction = etat.image / (etat.donnees.nb_images - 1);
  for (const pied of ["gauche", "droit"]) {
    const tete = document.querySelector("[data-tete='" + pied + "']");
    if (tete) tete.style.left = fraction * 100 + "%";
  }
}

function rendreListe() {
  const liste = $("liste-evenements");
  liste.textContent = "";
  const triés = [...etat.evenements].sort((a, b) => a.image - b.image);
  $("nb-evenements").textContent = triés.length;
  for (const evt of triés) {
    const ligne = el("li", evt.pied);
    ligne.dataset.id = evt.id;
    const libelle = el("span", evt.pied, (evt.type === "pose" ? "▼ Pose " : "▲ Lever ") + nomPied(evt.pied));
    const champ = el("input");
    champ.type = "number";
    champ.min = 0;
    champ.max = etat.donnees.nb_images - 1;
    champ.value = evt.image;
    champ.addEventListener("click", (e) => e.stopPropagation());
    champ.addEventListener("change", () => corrigerEvenement(evt, Number(champ.value)));
    const temps = el("span", "img", (evt.image / etat.essai.frequence_hz).toFixed(2) + " s");
    ligne.append(libelle, champ, temps);
    ligne.addEventListener("click", () => allerA(evt.image));
    liste.appendChild(ligne);
  }
  majListeActive();
}

function majListeActive() {
  document.querySelectorAll("#liste-evenements li").forEach((li) => {
    const evt = etat.evenements.find((x) => String(x.id) === li.dataset.id);
    li.classList.toggle("actif", !!evt && evt.image === etat.image);
  });
}

async function poser(pied, type) {
  if (!etat.essai) return;
  try {
    const nouvel = await creerEvenement(etat.essai.id, pied, type, etat.image);
    etat.evenements.push(nouvel);
    majBadge(etat.essai.id);
    rendreFrise();
    rendreListe();
    montrer("");
  } catch (err) {
    montrer(err.message);
  }
}

async function corrigerEvenement(evt, image) {
  const dernier = etat.donnees.nb_images - 1;
  if (!Number.isInteger(image) || image < 0 || image > dernier) {
    montrer("Image attendue entre 0 et " + dernier + ".");
    rendreListe();
    return;
  }
  try {
    await changerImageEvenement(evt.id, image);
    evt.image = image;
    rendreFrise();
    rendreListe();
    montrer("");
  } catch (err) {
    montrer(err.message);
  }
}

function basculerLecture() {
  if (!etat.essai) return;
  etat.lecture = !etat.lecture;
  $("btn-lecture").textContent = etat.lecture ? "❚❚" : "▶";
}

function tic(maintenant) {
  const dt = Math.min(0.1, (maintenant - etat.dernier) / 1000);
  etat.dernier = maintenant;
  if (etat.lecture && etat.donnees) {
    etat.reste += dt * etat.essai.frequence_hz * etat.vitesse;
    const pas = Math.floor(etat.reste);
    etat.reste -= pas;
    if (pas > 0) {
      if (etat.image + pas >= etat.donnees.nb_images - 1) {
        allerA(etat.donnees.nb_images - 1);
        basculerLecture();
      } else {
        allerA(etat.image + pas);
      }
    }
  }
  requestAnimationFrame(tic);
}

function brancher() {
  $("btn-debut").addEventListener("click", () => etat.donnees && allerA(0));
  $("btn-fin").addEventListener("click", () => etat.donnees && allerA(etat.donnees.nb_images - 1));
  $("btn-prec").addEventListener("click", () => allerA(etat.image - 1));
  $("btn-suiv").addEventListener("click", () => allerA(etat.image + 1));
  $("btn-lecture").addEventListener("click", basculerLecture);
  $("curseur").addEventListener("input", (e) => allerA(Number(e.target.value)));

  for (const pied of ["gauche", "droit"]) {
    const zone = $("frise-" + pied);
    zone.addEventListener("click", (e) => {
      if (!etat.donnees) return;
      allerA((e.offsetX / zone.clientWidth) * (etat.donnees.nb_images - 1));
    });
  }

  document.querySelectorAll("[data-vitesse]").forEach((b) =>
    b.addEventListener("click", () => {
      etat.vitesse = Number(b.dataset.vitesse);
      document.querySelectorAll("[data-vitesse]").forEach((x) => x.classList.toggle("actif", x === b));
    })
  );

  document.querySelectorAll("[data-action]").forEach((b) =>
    b.addEventListener("click", () => poser(b.dataset.pied, b.dataset.action))
  );

  window.addEventListener("keydown", (e) => {
    if (e.target.matches("input")) return;
    if (e.key === " ") {
      e.preventDefault();
      basculerLecture();
    } else if (e.key === "ArrowLeft") {
      allerA(etat.image - 1);
    } else if (e.key === "ArrowRight") {
      allerA(etat.image + 1);
    }
  });
}

demarrer();
