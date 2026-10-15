import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const COULEURS = { gauche: 0x38bdf8, droit: 0xfb923c, bassin: 0x94a3b8 };
const VITESSE_DEPLACEMENT = 0.6;
const LONGUEUR_TRAJECTOIRE = 40;

const ARETES = [
  ["L_IAS", "L_IPS"], ["R_IAS", "R_IPS"], ["L_IAS", "R_IAS"], ["L_IPS", "R_IPS"],
  ["L_IAS", "L_FTC"], ["L_FTC", "L_FLE"], ["L_FLE", "L_FAX"], ["L_FLE", "L_TTC"],
  ["L_TTC", "L_FAL"], ["L_FAL", "L_FCC"], ["L_FCC", "L_FM1"], ["L_FCC", "L_FM5"], ["L_FM1", "L_FM5"],
  ["R_IAS", "R_FTC"], ["R_FTC", "R_FLE"], ["R_FLE", "R_FAX"], ["R_FLE", "R_TTC"],
  ["R_TTC", "R_FAL"], ["R_FAL", "R_FCC"], ["R_FCC", "R_FM1"], ["R_FCC", "R_FM5"], ["R_FM1", "R_FM5"],
];

const TRAJECTOIRES = ["L_FCC", "R_FCC"];

const NOMS_MARQUEURS = [
  "L_IAS", "L_IPS", "R_IPS", "R_IAS",
  "L_FTC", "L_FLE", "L_FAX", "L_TTC", "L_FAL", "L_FCC", "L_FM1", "L_FM5",
  "R_FTC", "R_FLE", "R_FAX", "R_TTC", "R_FAL", "R_FCC", "R_FM1", "R_FM5",
];

function couleurMarqueur(nom) {
  if (nom.startsWith("L_")) return nom.includes("IAS") || nom.includes("IPS") ? COULEURS.bassin : COULEURS.gauche;
  if (nom.startsWith("R_")) return nom.includes("IAS") || nom.includes("IPS") ? COULEURS.bassin : COULEURS.droit;
  return COULEURS.bassin;
}

function versVue(p) {
  return new THREE.Vector3(p[0], p[2], -p[1]);
}

function estNul(p) {
  return !p || (p[0] === 0 && p[1] === 0 && p[2] === 0);
}

export function creerScene(conteneur) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  conteneur.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1220);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
  camera.position.set(2.2, 1.4, 2.4);

  const controles = new OrbitControls(camera, renderer.domElement);
  controles.target.set(0, 0.5, 0);
  controles.update();

  const grille = new THREE.GridHelper(6, 30, 0x1e3a5f, 0x172033);
  scene.add(grille);

  const sol = new THREE.Mesh(
    new THREE.CircleGeometry(1.4, 64),
    new THREE.MeshBasicMaterial({ color: 0x17335c, transparent: true, opacity: 0.55 })
  );
  sol.rotation.x = -Math.PI / 2;
  scene.add(sol);

  const sphere = new THREE.SphereGeometry(0.022, 16, 12);
  const marqueurs = {};
  for (const nom of NOMS_MARQUEURS) {
    const mesh = new THREE.Mesh(sphere, new THREE.MeshStandardMaterial({ color: couleurMarqueur(nom) }));
    mesh.visible = false;
    scene.add(mesh);
    marqueurs[nom] = mesh;
  }

  const materielOs = new THREE.LineBasicMaterial({ color: 0xcbd5e1, transparent: true, opacity: 0.7 });
  const aretes = ARETES.map(() => {
    const ligne = new THREE.Line(new THREE.BufferGeometry(), materielOs);
    ligne.frustumCulled = false;
    scene.add(ligne);
    return ligne;
  });

  const trajectoires = TRAJECTOIRES.map((nom) => {
    const ligne = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: nom.startsWith("L_") ? 0x38bdf8 : 0xfb923c, transparent: true, opacity: 0.5 })
    );
    ligne.frustumCulled = false;
    scene.add(ligne);
    return ligne;
  });

  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const lumiere = new THREE.DirectionalLight(0xffffff, 0.6);
  lumiere.position.set(1, 3, 2);
  scene.add(lumiere);

  let donnees = null;
  let image = 0;
  const touches = new Set();

  function dimensionner() {
    const w = conteneur.clientWidth;
    const h = conteneur.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", dimensionner);
  dimensionner();

  function majImage() {
    if (!donnees) return;
    for (const nom of Object.keys(marqueurs)) {
      const p = donnees.marqueurs[nom][image];
      marqueurs[nom].visible = !estNul(p);
      if (!estNul(p)) marqueurs[nom].position.copy(versVue(p));
    }
    ARETES.forEach(([a, b], k) => {
      const pa = donnees.marqueurs[a][image];
      const pb = donnees.marqueurs[b][image];
      aretes[k].visible = !estNul(pa) && !estNul(pb);
      if (aretes[k].visible) {
        aretes[k].geometry.setFromPoints([versVue(pa), versVue(pb)]);
      }
    });
    TRAJECTOIRES.forEach((nom, k) => {
      const points = [];
      for (let j = Math.max(0, image - LONGUEUR_TRAJECTOIRE); j <= image; j++) {
        const p = donnees.marqueurs[nom][j];
        if (!estNul(p)) points.push(versVue(p));
      }
      trajectoires[k].geometry.setFromPoints(points);
    });
  }

  function deplacer(dt) {
    const vecteurs = {
      z: [0, 0, -1], s: [0, 0, 1], q: [-1, 0, 0], d: [1, 0, 0],
    };
    const direction = new THREE.Vector3();
    for (const touche of touches) {
      if (vecteurs[touche]) direction.add(new THREE.Vector3(...vecteurs[touche]));
    }
    if (direction.lengthSq() === 0) return;
    direction.normalize();

    const avant = new THREE.Vector3();
    camera.getWorldDirection(avant);
    avant.y = 0;
    avant.normalize();
    const droite = new THREE.Vector3().crossVectors(avant, new THREE.Vector3(0, 1, 0)).normalize();

    const pas = new THREE.Vector3()
      .addScaledVector(avant, -direction.z)
      .addScaledVector(droite, direction.x)
      .multiplyScalar(VITESSE_DEPLACEMENT * dt * Math.max(1, camera.position.distanceTo(controles.target)));

    camera.position.add(pas);
    controles.target.add(pas);
  }

  let dernier = performance.now();
  function boucle(now) {
    const dt = Math.min(0.1, (now - dernier) / 1000);
    dernier = now;
    deplacer(dt);
    controles.update();
    renderer.render(scene, camera);
    requestAnimationFrame(boucle);
  }
  requestAnimationFrame(boucle);

  window.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea")) return;
    const t = e.key.toLowerCase();
    if (["z", "q", "s", "d"].includes(t)) {
      touches.add(t);
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", (e) => touches.delete(e.key.toLowerCase()));
  window.addEventListener("blur", () => touches.clear());

  return {
    definirEssai(d) {
      donnees = d;
      image = 0;
      majImage();
    },
    allerA(i) {
      image = i;
      majImage();
    },
  };
}
