import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { makeHeroCar } from './hero.js';

/*
 * The player's car from public/models/skylark.glb (built by assets/blender/build_skylark.py).
 *
 * Returns the same shape as makeHeroCar() synchronously — { root, body, wheels, fronts,
 * tailMat, headMat } — so the main loop can drive it from the first frame; the groups are
 * filled in when the file arrives. The glb hierarchy is Skylark → Body (+ Glass, Bumpers,
 * Trim, Details) and Wheel_FL/FR/RL/RR with their origins at the hubs, +X forward, +Z right.
 * Each wheel is re-parented under a pivot group so steering (pivot.rotation.y) and spin
 * (wheel.rotation.z) stay separate, as with the procedural car.
 * If loading fails the procedural car from hero.js is used instead.
 */
const WHEEL_ORDER = ['Wheel_FR', 'Wheel_FL', 'Wheel_RR', 'Wheel_RL'];   // front right, front left, rear right, rear left — rears are i >= 2
const URL = `${import.meta.env.BASE_URL}models/skylark.glb`;

export function loadHeroCar(scene, url = URL) {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  scene.add(root);
  const P = {
    root, body, wheels: [], fronts: [],
    tailMat: new THREE.MeshStandardMaterial({ color: 0x7a0c08, emissive: 0xff2010, emissiveIntensity: 0.6 }),
    headMat: new THREE.MeshStandardMaterial({ color: 0xfff4d6, emissive: 0xfff0c0, emissiveIntensity: 1.8 }),
    loaded: false
  };

  new GLTFLoader().load(url, gltf => {
    const model = gltf.scene;
    const bodyNode = model.getObjectByName('Body');
    const wheelNodes = WHEEL_ORDER.map(n => model.getObjectByName(n));
    if (!bodyNode || wheelNodes.some(w => !w)) { fallback(new Error('skylark.glb: missing Body or Wheel_* nodes')); return; }

    model.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (m.name === 'Taillamp') P.tailMat = m;
        if (m.name === 'Headlamp') P.headMat = m;
      }
    });
    body.add(bodyNode);
    for (const w of wheelNodes) {
      const pivot = new THREE.Group();
      pivot.position.copy(w.position);
      w.position.set(0, 0, 0);
      pivot.add(w); root.add(pivot);
      P.wheels.push(w);
      if (pivot.position.x > 0) P.fronts.push(pivot);
    }
    P.loaded = true;
  }, undefined, fallback);

  function fallback(err) {
    console.warn('[hero] glb failed, using the procedural car:', err);
    const proc = makeHeroCar(scene);
    scene.remove(proc.root);
    for (const c of [...proc.body.children]) body.add(c);
    for (const c of [...proc.root.children]) if (c !== proc.body) root.add(c);
    P.wheels = proc.wheels; P.fronts = proc.fronts; P.tailMat = proc.tailMat; P.headMat = proc.headMat;
    P.loaded = true;
  }
  return P;
}
