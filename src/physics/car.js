import { clamp } from '../util.js';
import { START } from '../world/constants.js';
import { collide } from './collide.js';

export const car = {};
export function resetCar() {
  Object.assign(car, { x: START.x, z: START.z, th: START.th, vx: 0, vz: 0, w: 0, steer: 0, hbSign: 1, hand: false, spin: false,
    vL: 0, vS: 0, speed: 0, gas: false, brakeHeld: false, accel: 0 });
}
resetCar();

const WB = 2.8;

/* max steering angle shrinks with speed; also used for the visual front wheels */
export const steerMax = vL => 0.62 - 0.44 * Math.min(1, Math.abs(vL) / 35);

/* one fixed-step physics tick. I — current inputs, onHit(impact) — collision callback */
export function physStep(dt, I, onHit) {
  const sIn = (I.right ? 1 : 0) - (I.left ? 1 : 0);
  const rate = sIn !== 0 ? 4.5 : 7;
  car.steer += clamp(sIn - car.steer, -rate * dt, rate * dt);
  const c = Math.cos(car.th), s = Math.sin(car.th);
  let vL = car.vx * c + car.vz * s, vS = -car.vx * s + car.vz * c;
  const speed = Math.hypot(vL, vS);
  if (I.hand && !car.hand) car.hbSign = vL >= 0 ? 1 : -1;
  car.hand = I.hand;
  const spinning = I.burn && speed < 6 && !I.hand;
  car.spin = spinning;
  let a = 0;
  if (spinning) {
    vL *= Math.exp(-4 * dt);
    vL += Math.abs(car.steer) * 3.4 * dt;
  } else {
    if (I.gas) a += vL > -0.5 ? 14 * (1 - vL / 50) : 22;
    if (I.brake) { if (vL > 0.5) a -= 22; else if (!I.gas) a -= 9 * (1 + vL / 14); }
    if (!I.gas && !I.brake) a -= Math.sign(vL) * 1.5;
    a -= vL * 0.06;
  }
  let nvL = vL + a * dt;
  if (!spinning) {
    if (!I.gas && !I.brake && Math.sign(nvL) !== Math.sign(vL)) nvL = 0;
    if (I.brake && vL > 0.5 && nvL < 0) nvL = 0;
  }
  if (car.hand) { const d = 4.5 * dt; nvL = Math.abs(nvL) <= d ? 0 : nvL - Math.sign(nvL) * d; }
  car.accel = (nvL - vL) / dt;
  vL = nvL;
  const grip = car.hand ? 1.1 : spinning ? 2.5 : (Math.abs(vS) > 4 ? 4.5 : 9);
  vS *= Math.exp(-grip * dt);
  const dmax = steerMax(vL);
  let target = vL * Math.tan(car.steer * dmax) / WB, resp = 12;
  if (car.hand && speed > 2.5) { target = sIn !== 0 ? car.steer * 3.4 * car.hbSign : car.w * 0.85; resp = 7; }
  else if (spinning) { target = car.steer * 3.4; resp = 6; }
  else if (Math.abs(vS) > 4) { target = target + (car.w - target) * 0.5; resp = 6; }
  car.w += (target - car.w) * Math.min(1, resp * dt);
  car.w = clamp(car.w, -4.5, 4.5);
  car.th += car.w * dt;
  car.vx = c * vL - s * vS; car.vz = s * vL + c * vS;
  car.x += car.vx * dt; car.z += car.vz * dt;
  collide(car, onHit);
  const c2 = Math.cos(car.th), s2 = Math.sin(car.th);
  car.vL = car.vx * c2 + car.vz * s2; car.vS = -car.vx * s2 + car.vz * c2;
  car.speed = Math.hypot(car.vx, car.vz);
  car.gas = I.gas; car.brakeHeld = I.brake;
}
