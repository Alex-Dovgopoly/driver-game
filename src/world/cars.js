import * as THREE from 'three';
import { HX, HZ } from './constants.js';
import { addBox } from '../physics/collide.js';
import { loadHeroCar } from './heroModel.js';

const chromeMat = new THREE.MeshStandardMaterial({ color: 0xd8d2c6, roughness: 0.22, metalness: 1 });
const rubberMat = new THREE.MeshStandardMaterial({ color: 0x141210, roughness: 0.9 });
const glassMat = new THREE.MeshStandardMaterial({ color: 0x1a232b, roughness: 0.08, metalness: 0.7 });
const underMat = new THREE.MeshStandardMaterial({ color: 0x0d0b09, roughness: 1 });
const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.27, 18); wheelGeo.rotateX(Math.PI / 2);
const hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.29, 12); hubGeo.rotateX(Math.PI / 2);

export function makeCar(scene, color, player = false) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.35 });
  const add = (geo, mat, x, y, z, parent = body) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  add(new THREE.BoxGeometry(4.4, 0.24, 1.72), underMat, 0, 0.36, 0);
  add(new THREE.BoxGeometry(4.9, 0.5, 1.95), paint, 0, 0.66, 0);
  add(new THREE.BoxGeometry(1.75, 0.06, 1.9), paint, 1.5, 0.93, 0);           // hood lip
  add(new THREE.BoxGeometry(2.2, 0.5, 1.72), glassMat, -0.35, 1.15, 0);      // cabin glass
  add(new THREE.BoxGeometry(2.05, 0.07, 1.76), player ? new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.6 }) : paint, -0.42, 1.43, 0); // vinyl roof
  add(new THREE.BoxGeometry(0.12, 0.5, 1.74), paint, 0.72, 1.15, 0);         // A-pillar frame
  add(new THREE.BoxGeometry(4.62, 0.05, 1.97), chromeMat, 0, 0.74, 0);       // side trim
  add(new THREE.BoxGeometry(0.14, 0.22, 2.0), chromeMat, 2.5, 0.48, 0);
  add(new THREE.BoxGeometry(0.14, 0.22, 2.0), chromeMat, -2.5, 0.48, 0);
  add(new THREE.BoxGeometry(0.05, 0.26, 1.15), underMat, 2.46, 0.68, 0);     // grille
  if (player) {
    const stripe = new THREE.MeshStandardMaterial({ color: 0xe0a526, roughness: 0.4 });
    add(new THREE.BoxGeometry(1.75, 0.012, 0.22), stripe, 1.5, 0.965, 0.28);
    add(new THREE.BoxGeometry(1.75, 0.012, 0.22), stripe, 1.5, 0.965, -0.28);
  }
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff4d6, emissive: 0xfff0c0, emissiveIntensity: player ? 1.4 : 0.05 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x7a0c08, emissive: 0xff2010, emissiveIntensity: player ? 0.6 : 0.0 });
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.06, 0.2, 0.32), headMat, 2.47, 0.69, s * 0.68);
    add(new THREE.BoxGeometry(0.06, 0.16, 0.44), tailMat, -2.47, 0.72, s * 0.66);
  }
  const wheels = [], fronts = [];
  for (const [wx, wz] of [[1.45, 0.9], [1.45, -0.9], [-1.45, 0.9], [-1.45, -0.9]]) {
    const pivot = new THREE.Group(); pivot.position.set(wx, 0.36, wz); root.add(pivot);
    const spin = new THREE.Group(); pivot.add(spin);
    const t = new THREE.Mesh(wheelGeo, rubberMat); t.castShadow = true; spin.add(t);
    const h = new THREE.Mesh(hubGeo, chromeMat); spin.add(h);
    const notch = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.3), underMat); notch.position.y = 0.05; spin.add(notch);
    wheels.push(spin); if (wx > 0) fronts.push(pivot);
  }
  scene.add(root);
  return { root, body, wheels, fronts, tailMat, headMat };
}

/* parked cars along the long walls and at the far end; registers their obstacles */
const PALETTE = [0x5e6b2e, 0xc98b1e, 0xa9461a, 0x4b3020, 0xd9cba8, 0x2e4a5c, 0x7d7466, 0x8c2f1e, 0x3f5a3a];
const occupied = {
  '-1': [0, 1, 3, 4, 5, 8, 10, 11, 14, 15, 17, 20, 21, 22, 25, 27],
  '1': [1, 2, 4, 7, 8, 9, 12, 13, 16, 18, 19, 23, 24, 26, 28]
};
export function placeParkedCars(scene) {
  let pc = 0;
  for (const sd of [-1, 1]) for (const k of occupied[sd]) {
    const x = -46 + 1.6 + 3.2 * k, z = sd * (HZ - 0.45 - 2.45);
    const c = makeCar(scene, PALETTE[(pc++ * 5 + k) % PALETTE.length]);
    c.root.position.set(x + (Math.random() - 0.5) * 0.25, 0, z);
    const nose = Math.random() < 0.65 ? sd : -sd;
    c.root.rotation.y = nose > 0 ? -Math.PI / 2 : Math.PI / 2;
    c.root.rotation.y += (Math.random() - 0.5) * 0.05;
    addBox(x - 1.0, x + 1.0, z - 2.45, z + 2.45);
  }
  // a couple parked along the far end
  for (const [x, z] of [[HX - 3.4, 12], [HX - 3.4, -15.5]]) {
    const c = makeCar(scene, PALETTE[(pc++) % PALETTE.length]);
    c.root.position.set(x, 0, z); c.root.rotation.y = Math.random() < 0.5 ? 0 : Math.PI;
    addBox(x - 2.45, x + 2.45, z - 1.0, z + 1.0);
  }
}

/* the player's car (glb model, procedural fallback) with its headlight */
export function createPlayer(scene) {
  const P = loadHeroCar(scene);
  const head = new THREE.SpotLight(0xfff0c8, 1.3, 34, 0.52, 0.55, 1.2);
  head.position.set(2.4, 0.75, 0); P.root.add(head);
  const headTarget = new THREE.Object3D(); headTarget.position.set(14, -0.6, 0); P.root.add(headTarget); head.target = headTarget;
  return P;
}
