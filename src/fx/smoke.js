import * as THREE from 'three';
import { CEIL } from '../world/constants.js';
import { makeCanvas, texFrom } from '../world/textures.js';

/* pool of smoke sprites; returns { puff, update } */
export function createSmoke(scene) {
  const smokeTex = texFrom(makeCanvas(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(220,214,204,1)'); gr.addColorStop(0.55, 'rgba(200,194,184,.45)'); gr.addColorStop(1, 'rgba(200,194,184,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  }));
  const smoke = [];
  for (let i = 0; i < 90; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0, fog: true }));
    s.visible = false; scene.add(s); smoke.push({ s, life: 0, max: 1, vx: 0, vy: 0, vz: 0 });
  }
  let smokeIdx = 0;
  function puff(x, z, amt) {
    const p = smoke[smokeIdx = (smokeIdx + 1) % smoke.length];
    p.s.visible = true; p.life = 0; p.max = 1.2 + Math.random() * 1.0;
    p.s.position.set(x, 0.35, z); p.base = 0.6 + Math.random() * 0.5; p.amt = amt;
    p.vx = (Math.random() - 0.5) * 1.2; p.vz = (Math.random() - 0.5) * 1.2; p.vy = 0.5 + Math.random() * 0.6;
  }
  function update(dt) {
    for (const p of smoke) {
      if (!p.s.visible) continue;
      p.life += dt; const k = p.life / p.max;
      if (k >= 1) { p.s.visible = false; continue; }
      p.s.position.x += p.vx * dt; p.s.position.y = Math.min(p.s.position.y + p.vy * dt, CEIL - 0.6); p.s.position.z += p.vz * dt;
      const sc = p.base + k * 3.2; p.s.scale.set(sc, sc, sc);
      p.s.material.opacity = (1 - k) * 0.42 * p.amt;
    }
  }
  return { puff, update };
}
