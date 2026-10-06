/*
 * Visual-only body suspension. The physics gives a target pitch (from longitudinal
 * acceleration) and roll (from yaw rate × speed); both are near-constant while an input
 * is held, so applying them directly snaps the body between a few fixed poses.
 * Here each axis follows its target through a damped second-order spring, so load
 * transfer builds up over a few hundred ms and settles with a small overshoot.
 *
 * freq — natural frequency, Hz (how fast the body reacts)
 * zeta — damping ratio (<1 gives one visible bounce before settling)
 */
export function createSuspension({ freq = 2.0, zeta = 0.5 } = {}) {
  const w0 = 2 * Math.PI * freq, k = w0 * w0, c = 2 * zeta * w0;
  const s = { pitch: 0, pitchV: 0, roll: 0, rollV: 0 };
  const SUB = 1 / 120; // integrate in small steps so a slow frame cannot blow the spring up

  function axis(x, v, target, dt) {
    let t = dt;
    while (t > 0) {
      const h = Math.min(SUB, t); t -= h;
      v += (k * (target - x) - c * v) * h;   // semi-implicit Euler
      x += v * h;
    }
    return [x, v];
  }

  /* advance by dt towards the targets; returns the current { pitch, roll } */
  function update(dt, targetPitch, targetRoll) {
    [s.pitch, s.pitchV] = axis(s.pitch, s.pitchV, targetPitch, dt);
    [s.roll, s.rollV] = axis(s.roll, s.rollV, targetRoll, dt);
    return s;
  }
  function reset() { s.pitch = s.pitchV = s.roll = s.rollV = 0; }

  return { update, reset };
}
