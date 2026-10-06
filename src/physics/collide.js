import { clamp } from '../util.js';

/* static obstacles: axis-aligned boxes in the XZ plane */
export const obstacles = [];
export const addBox = (x0, x1, z0, z1) => obstacles.push({ x0, x1, z0, z1 });

/* collision circles along the car's long axis, and their radius */
const CIRC = [1.55, 0, -1.55], CR = 0.98;

export function collide(car, onHit) {
  for (let pass = 0; pass < 2; pass++) {
    const c = Math.cos(car.th), s = Math.sin(car.th);
    for (const off of CIRC) {
      const px = car.x + c * off, pz = car.z + s * off;
      for (const o of obstacles) {
        if (px < o.x0 - CR || px > o.x1 + CR || pz < o.z0 - CR || pz > o.z1 + CR) continue;
        const qx = clamp(px, o.x0, o.x1), qz = clamp(pz, o.z0, o.z1);
        const dx = px - qx, dz = pz - qz, d2 = dx * dx + dz * dz;
        if (d2 >= CR * CR) continue;
        let nx, nz, pen;
        if (d2 < 1e-9) {
          const dl = px - o.x0, dr = o.x1 - px, dt_ = pz - o.z0, db = o.z1 - pz;
          const m = Math.min(dl, dr, dt_, db);
          if (m === dl) { nx = -1; nz = 0; } else if (m === dr) { nx = 1; nz = 0; } else if (m === dt_) { nx = 0; nz = -1; } else { nx = 0; nz = 1; }
          pen = m + CR;
        } else { const d = Math.sqrt(d2); nx = dx / d; nz = dz / d; pen = CR - d; }
        car.x += nx * pen; car.z += nz * pen;
        const vn = car.vx * nx + car.vz * nz;
        if (vn < 0) {
          car.vx -= nx * vn * 1.35; car.vz -= nz * vn * 1.35;
          car.vx *= 0.88; car.vz *= 0.88;
          // a little twist from off-centre hits
          car.w += (off * (nx * s - nz * c)) * (-vn) * 0.08;
          car.w *= 0.7;
          onHit(-vn);
        }
      }
    }
  }
}
