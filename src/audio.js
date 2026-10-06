import { state } from './game/state.js';

/* procedural engine, tyre screech, blips and thuds on the Web Audio API */
let ac = null, eng, eng2, engGain, filt, scrGain, master, noiseBuf;

export function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; return; }
  master = ac.createGain(); master.gain.value = 0.55; master.connect(ac.destination);
  filt = ac.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 800;
  engGain = ac.createGain(); engGain.gain.value = 0; filt.connect(engGain); engGain.connect(master);
  eng = ac.createOscillator(); eng.type = 'sawtooth'; eng.connect(filt); eng.start();
  eng2 = ac.createOscillator(); eng2.type = 'square';
  const g2 = ac.createGain(); g2.gain.value = 0.45; eng2.connect(g2); g2.connect(filt); eng2.start();
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const ns = ac.createBufferSource(); ns.buffer = noiseBuf; ns.loop = true;
  const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1750; bp.Q.value = 4;
  scrGain = ac.createGain(); scrGain.gain.value = 0; ns.connect(bp); bp.connect(scrGain); scrGain.connect(master); ns.start();
}

export function blip(f, dur) {
  if (!ac || state.muted) return;
  const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
  o.type = 'square'; o.frequency.value = f; g.gain.setValueAtTime(0.09, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}

let lastThud = 0;
export function thud(v) {
  if (!ac || state.muted || ac.currentTime - lastThud < 0.12) return; lastThud = ac.currentTime;
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), t = ac.currentTime;
  s.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.value = 500 + v * 1500;
  g.gain.setValueAtTime(0.25 + v * 0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + 0.4);
}

/* car — physics state, skidAmt — smoothed 0..1 tyre-screech amount from the main loop */
export function updateAudio(car, skidAmt) {
  if (!ac) return;
  const t = ac.currentTime, sp = car.speed;
  const gears = [0, 9, 17, 26, 36, 60];
  let gi = 1; while (gi < gears.length - 1 && sp > gears[gi]) gi++;
  let rpm = (sp - gears[gi - 1]) / (gears[gi] - gears[gi - 1]);
  if (car.spin) rpm = 0.9 + Math.random() * 0.06;
  const f = 46 + rpm * 74 + gi * 7;
  eng.frequency.setTargetAtTime(f, t, 0.05); eng2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
  const thr = (car.gas || car.spin) ? 1 : 0.35;
  const on = state.mode !== 'menu' && !state.muted;
  engGain.gain.setTargetAtTime(on ? 0.13 * thr + 0.04 : 0, t, 0.08);
  filt.frequency.setTargetAtTime(420 + rpm * 900 + thr * 500, t, 0.1);
  scrGain.gain.setTargetAtTime(on ? skidAmt * 0.2 : 0, t, 0.05);
}
