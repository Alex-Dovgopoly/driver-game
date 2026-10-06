import * as THREE from 'three';
import { GW, GD, HX, HZ, CEIL, ROWS, PX, PS, START } from './constants.js';
import { makeCanvas, texFrom, speckle, blotches } from './textures.js';
import { addBox } from '../physics/collide.js';

/* builds floor, walls, decals, pillars, ceiling and lights; registers static obstacles */
export function buildGarage(scene) {
  // floor
  const FW = 2048, FH = Math.round(FW * GD / GW);
  const fx = x => (x + HX) / GW * FW, fz = z => (z + HZ) / GD * FH, fsc = FW / GW;
  const floorCanvas = makeCanvas(FW, FH, (g, w, h) => {
    g.fillStyle = '#6a645a'; g.fillRect(0, 0, w, h);
    blotches(g, w, h, 320, 20, 130);
    speckle(g, w, h, 46000, 0.28, '22,19,15');
    speckle(g, w, h, 22000, 0.16, '205,195,175');
    // slab joints
    g.strokeStyle = 'rgba(28,24,20,.55)'; g.lineWidth = 2;
    for (let x = -HX; x <= HX; x += 10) { g.beginPath(); g.moveTo(fx(x), 0); g.lineTo(fx(x), h); g.stroke(); }
    for (let z = -HZ; z <= HZ; z += 11) { g.beginPath(); g.moveTo(0, fz(z)); g.lineTo(w, fz(z)); g.stroke(); }
    // tyre wear in lanes
    for (let i = 0; i < 60; i++) {
      const lane = [-14, 14, 0][i % 3];
      g.fillStyle = 'rgba(25,20,16,.05)';
      g.fillRect(0, fz(lane - 1.6 + Math.random() * 0.4), w, 0.5 * fsc);
      g.fillRect(0, fz(lane + 1.1 + Math.random() * 0.4), w, 0.5 * fsc);
    }
    // parking bays along long walls
    g.strokeStyle = 'rgba(236,226,200,.78)'; g.lineWidth = 0.12 * fsc;
    for (let x = -46; x <= 46.01; x += 3.2) {
      for (const sd of [-1, 1]) {
        g.beginPath(); g.moveTo(fx(x), fz(sd * HZ)); g.lineTo(fx(x), fz(sd * (HZ - 5.8))); g.stroke();
      }
    }
    // oil stains in bays
    for (let i = 0; i < 40; i++) {
      const x = fx(-45 + Math.random() * 90), z = fz((Math.random() < 0.5 ? -1 : 1) * (HZ - 2.5 - Math.random()));
      const r = 0.5 * fsc + Math.random() * 0.6 * fsc;
      const gr = g.createRadialGradient(x, z, 0, x, z, r);
      gr.addColorStop(0, 'rgba(15,12,10,.5)'); gr.addColorStop(1, 'rgba(15,12,10,0)');
      g.fillStyle = gr; g.fillRect(x - r, z - r, r * 2, r * 2);
    }
    // yellow line under pillar rows
    g.strokeStyle = 'rgba(224,165,38,.85)'; g.lineWidth = 0.2 * fsc;
    g.setLineDash([1.6 * fsc, 1.0 * fsc]);
    for (const r of ROWS) { g.beginPath(); g.moveTo(fx(-34), fz(r)); g.lineTo(fx(34), fz(r)); g.stroke(); }
    g.setLineDash([]);
    // lane arrows
    g.fillStyle = 'rgba(236,226,200,.7)';
    const arrow = (x, z, dir) => {
      g.save(); g.translate(fx(x), fz(z)); g.scale(dir * fsc, fsc);
      g.beginPath(); g.moveTo(-2.2, -0.25); g.lineTo(0.6, -0.25); g.lineTo(0.6, -0.8); g.lineTo(2.2, 0);
      g.lineTo(0.6, 0.8); g.lineTo(0.6, 0.25); g.lineTo(-2.2, 0.25); g.closePath(); g.fill(); g.restore();
    };
    arrow(-12, -14, -1); arrow(24, -14, -1); arrow(-24, 14, 1); arrow(12, 14, 1); arrow(-12, 0, 1); arrow(12, 0, 1);
    // start box
    g.strokeStyle = 'rgba(224,165,38,.9)'; g.lineWidth = 0.18 * fsc;
    g.strokeRect(fx(START.x - 3.3), fz(-1.6), 6.6 * fsc, 3.2 * fsc);
    g.save(); g.translate(fx(START.x - 4.3), fz(0)); g.rotate(-Math.PI / 2);
    g.font = `bold ${1.0 * fsc}px Impact, "Arial Black", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(224,165,38,.85)'; g.fillText('START', 0, 0); g.restore();
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(GW, GD),
    new THREE.MeshStandardMaterial({ map: texFrom(floorCanvas), roughness: 0.92, metalness: 0 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  // walls
  const wallCanvas = makeCanvas(512, 236, (g, w, h) => {
    const m = v => h - v / CEIL * h;
    g.fillStyle = '#8b8377'; g.fillRect(0, 0, w, h);
    blotches(g, w, h, 40, 10, 60);
    speckle(g, w, h, 5000, 0.25, '30,26,20');
    for (let i = 0; i < 14; i++) { // water streaks
      const x = Math.random() * w, len = 30 + Math.random() * 90;
      const gr = g.createLinearGradient(0, 0, 0, len);
      gr.addColorStop(0, 'rgba(40,34,26,.35)'); gr.addColorStop(1, 'rgba(40,34,26,0)');
      g.fillStyle = gr; g.fillRect(x, 0, 2 + Math.random() * 4, len);
    }
    g.fillStyle = '#3b2416'; g.fillRect(0, m(0.9), w, h - m(0.9));
    g.fillStyle = '#c4561d'; g.fillRect(0, m(1.5), w, m(0.9) - m(1.5));
    g.fillStyle = '#e0a526'; g.fillRect(0, m(1.64), w, m(1.5) - m(1.64));
    speckle(g, w, h * 0.4, 1200, 0.2, '0,0,0');
    g.fillStyle = 'rgba(0,0,0,.28)'; for (let x = 0; x < w; x += w / 2) g.fillRect(x, 0, 3, h);
  });
  const wallMatLong = new THREE.MeshStandardMaterial({ map: texFrom(wallCanvas, GW / 10, 1), roughness: 0.95 });
  const wallMatShort = new THREE.MeshStandardMaterial({ map: texFrom(wallCanvas, GD / 10, 1), roughness: 0.95 });
  function wall(len, mat, x, z, ry) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, CEIL), mat);
    m.position.set(x, CEIL / 2, z); m.rotation.y = ry; m.receiveShadow = true; scene.add(m);
  }
  wall(GW, wallMatLong, 0, -HZ, 0);
  wall(GW, wallMatLong, 0, HZ, Math.PI);
  wall(GD, wallMatShort, -HX, 0, Math.PI / 2);
  wall(GD, wallMatShort, HX, 0, -Math.PI / 2);
  addBox(-HX - 10, HX + 10, -HZ - 10, -HZ);
  addBox(-HX - 10, HX + 10, HZ, HZ + 10);
  addBox(-HX - 10, -HX, -HZ - 10, HZ + 10);
  addBox(HX, HX + 10, -HZ - 10, HZ + 10);

  // wall decals
  function decal(text, x, z, ry, w = 6, color = '#e0a526') {
    const c = makeCanvas(512, 256, (g, cw, ch) => {
      g.font = 'bold 170px Impact, "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = color; g.fillText(text, cw / 2, ch / 2 + 8);
      g.globalCompositeOperation = 'destination-out'; speckle(g, cw, ch, 2500, 0.7, '0,0,0');
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 2),
      new THREE.MeshStandardMaterial({ map: texFrom(c), transparent: true, roughness: 0.95, depthWrite: false }));
    m.position.set(x, 2.9, z); m.rotation.y = ry; m.renderOrder = 1; scene.add(m);
  }
  decal('P1', -25, -HZ + 0.02, 0); decal('P1', 25, HZ - 0.02, Math.PI);
  decal('EXIT', HX - 0.02, -8, -Math.PI / 2, 7, '#f3e6c8'); decal('P1', -HX + 0.02, 10, Math.PI / 2);

  // pillars
  const pillarCanvas = makeCanvas(128, 420, (g, w, h) => {
    const m = v => h - v / CEIL * h;
    g.fillStyle = '#918a7e'; g.fillRect(0, 0, w, h);
    blotches(g, w, h, 12, 8, 40); speckle(g, w, h, 1800, 0.25, '30,26,20');
    g.save(); g.beginPath(); g.rect(0, m(0.95), w, h - m(0.95)); g.clip();
    g.fillStyle = '#e0a526'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1d1610';
    for (let i = -10; i < 20; i++) { g.beginPath(); g.moveTo(i * 30, h); g.lineTo(i * 30 + 15, h); g.lineTo(i * 30 + 15 + 90, m(0.95) - 10); g.lineTo(i * 30 + 90, m(0.95) - 10); g.fill(); }
    speckle(g, w, h, 900, 0.35, '20,16,12'); g.restore();
    g.fillStyle = '#c4561d'; g.fillRect(0, m(2.55), w, m(2.15) - m(2.55));
  });
  const pillarMat = new THREE.MeshStandardMaterial({ map: texFrom(pillarCanvas), roughness: 0.9 });
  const pillarGeo = new THREE.BoxGeometry(PS, CEIL, PS);
  for (const r of ROWS) for (const x of PX) {
    const p = new THREE.Mesh(pillarGeo, pillarMat);
    p.position.set(x, CEIL / 2, r); p.castShadow = true; p.receiveShadow = true; scene.add(p);
    addBox(x - PS / 2, x + PS / 2, r - PS / 2, r + PS / 2);
  }

  // ceiling, beams, lamps
  const ceilingGroup = new THREE.Group(); scene.add(ceilingGroup);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(GW, GD), new THREE.MeshStandardMaterial({ color: 0x2b241d, roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = CEIL; ceilingGroup.add(ceil);
  const beamMat = new THREE.MeshStandardMaterial({ color: 0x3a3128, roughness: 1 });
  for (let x = -40; x <= 40; x += 10) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.38, GD), beamMat);
    b.position.set(x, CEIL - 0.19, 0); ceilingGroup.add(b);
  }
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff0c8 });
  const lampDead = new THREE.MeshBasicMaterial({ color: 0x5a5244 });
  const lampGeo = new THREE.BoxGeometry(2.6, 0.07, 0.22);
  let li = 0;
  for (const z of [-14, 0, 14]) for (let x = -45; x <= 45; x += 10) {
    const l = new THREE.Mesh(lampGeo, (li++ % 11 === 7) ? lampDead : lampMat);
    l.position.set(x, CEIL - 0.06, z); ceilingGroup.add(l);
  }

  /* ---------- lights ---------- */
  scene.add(new THREE.HemisphereLight(0xffe3b8, 0x2a2016, 0.5));
  const sun = new THREE.DirectionalLight(0xffe2b0, 0.55);
  sun.position.set(8, 40, 6); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -54, right: 54, top: 26, bottom: -26, near: 1, far: 80 });
  sun.shadow.bias = -0.0008;
  scene.add(sun);
  for (const [x, z] of [[-34, -12], [-34, 12], [0, -14], [0, 14], [34, -12], [34, 12], [-12, 0], [12, 0]]) {
    const pl = new THREE.PointLight(0xffd59a, 0.55, 26, 1.6); pl.position.set(x, CEIL - 0.5, z); scene.add(pl);
  }

  return { ceilingGroup };
}
