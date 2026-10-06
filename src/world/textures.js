import * as THREE from 'three';

let maxAniso = 1;
export function configureTextures(renderer) {
  maxAniso = renderer.capabilities.getMaxAnisotropy();
}

export function makeCanvas(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h); return c;
}
export function texFrom(c, rx = 1, ry = 1) {
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding; t.anisotropy = maxAniso;
  if (rx !== 1 || ry !== 1) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); }
  return t;
}
export function speckle(g, w, h, n, a, rgb) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(${rgb},${Math.random() * a})`;
    const s = Math.random() * 2.5 + 0.8;
    g.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
}
export function blotches(g, w, h, n, rmin, rmax) {
  for (let i = 0; i < n; i++) {
    const x = Math.random() * w, y = Math.random() * h, r = rmin + Math.random() * (rmax - rmin);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const dark = Math.random() < 0.6;
    gr.addColorStop(0, dark ? 'rgba(30,24,18,.22)' : 'rgba(170,160,140,.12)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}
