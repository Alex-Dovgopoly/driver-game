import { TAU } from '../util.js';
import { START, ROWS, PX } from '../world/constants.js';
import { state } from './state.js';
import { car } from '../physics/car.js';
import { toast, buildList, refreshList } from '../ui/hud.js';
import { blip, thud } from '../audio.js';

export const MAN = [
  { id: 'burnout', name: 'Burnout', how: 'стоя на месте, зажми Shift на секунду' },
  { id: 'handbrake', name: 'Handbrake', how: 'разгонись больше 45 км/ч и дёрни ручник' },
  { id: 'slalom', name: 'Slalom', how: 'змейкой мимо колонн одного ряда туда и обратно' },
  { id: 'r180', name: '180°', how: 'на скорости ручник и руль, развернись на месте' },
  { id: 'r360', name: '360°', how: 'Shift и руль — крутись вокруг себя' },
  { id: 'rev180', name: 'Reverse 180°', how: 'разгонись задом и резко поверни, можно с ручником' },
  { id: 'speed', name: 'Speed', how: 'разгонись до 80 км/ч' },
  { id: 'brake', name: 'Brake test', how: 'с 55+ км/ч тормози до полной остановки, без ручника' },
  { id: 'lap', name: 'Lap', how: 'объезди весь гараж вокруг колонн по внешнему кругу' }
];
export const MAX_STRIKES = 4;

const live = () => state.mode === 'play' || state.mode === 'train';

/* onFinish(ok, why) — called when all 9 are done ('play' only) or on the 4th strike */
export function createManeuvers({ onFinish }) {
  const st = {
    done: {}, strikes: 0, lastHit: -9, gt: 0, timeLeft: 60,
    hist: [], burnT: 0, brakeTest: null, slideT: -9, lapSum: 0, lapPrev: null, prevX: 0, sl: []
  };

  function reset() {
    st.done = {}; st.strikes = 0; st.lastHit = -9; st.gt = 0; st.timeLeft = 60;
    st.hist = []; st.burnT = 0; st.brakeTest = null; st.slideT = -9; st.lapSum = 0; st.lapPrev = null; st.prevX = START.x;
    st.sl = ROWS.map(() => ({ dir: 0, side: 0, idx: -9, count: 0, done: { 1: false, '-1': false } }));
    buildList(MAN, state.lastMode === 'train', MAX_STRIKES);
  }

  /* progress text next to unfinished items: lap percentage, slalom half */
  function labels() {
    const l = {};
    const p = Math.floor(Math.abs(st.lapSum) / TAU * 100); if (p >= 8) l.lap = p + '%';
    if (st.sl.some(r => r.done[1] || r.done[-1])) l.slalom = '½';
    return l;
  }
  function refresh() { refreshList(st.done, labels(), st.strikes); }

  function complete(id) {
    if (st.done[id] || !live()) return;
    st.done[id] = true;
    const m = MAN.find(x => x.id === id);
    toast(`<div class="t-man">${m.name}</div>`, 1000);
    blip(660, 0.08); setTimeout(() => blip(990, 0.12), 80);
    refresh();
    if (state.mode === 'play' && MAN.every(x => st.done[x.id])) onFinish(true);
  }

  function onHit(impact) {
    if (impact > 0.8) thud(Math.min(1, impact / 10));
    if (!live()) return;
    if (impact < 2.2 || st.gt - st.lastHit < 0.9) return;
    st.lastHit = st.gt; st.strikes++; state.shake = Math.min(0.5, 0.15 + impact * 0.03);
    refresh();
    if (state.mode === 'play' && st.strikes >= MAX_STRIKES) { onFinish(false, 'hits'); return; }
    toast(`<div class="t-hit">Удар ${st.strikes} из ${MAX_STRIKES}</div>`, 900);
  }

  function check(dt) {
    const gt = st.gt;
    const kmh = car.speed * 3.6;
    if (car.spin) { st.burnT += dt; if (st.burnT > 0.8) complete('burnout'); } else st.burnT = 0;
    if (kmh >= 80 && car.vL > 0) complete('speed');
    if (car.hand && kmh >= 45) complete('handbrake');
    if (!st.brakeTest) { if (car.brakeHeld && !car.hand && car.vL > 0 && kmh >= 55) st.brakeTest = { t: gt }; }
    else if (!car.brakeHeld || car.hand) st.brakeTest = null;
    else if (kmh < 1.5) { complete('brake'); st.brakeTest = null; }
    else if (gt - st.brakeTest.t > 5) st.brakeTest = null;
    if (car.hand && car.speed > 3) st.slideT = gt;
    st.hist.push({ t: gt, yaw: car.th, vL: car.vL });
    while (st.hist.length && gt - st.hist[0].t > 4) st.hist.shift();
    for (const h of st.hist) {
      const age = gt - h.t, dy = Math.abs(car.th - h.yaw);
      if (age <= 3.6 && dy >= TAU * 0.95) complete('r360');
      if (age <= 2.4 && h.vL > 6 && dy >= Math.PI * 0.88 && gt - st.slideT < 2.4) complete('r180');
      if (age <= 2.8 && h.vL < -4 && dy >= Math.PI * 0.85) complete('rev180');
    }
    // slalom
    ROWS.forEach((r, ri) => {
      const s = st.sl[ri];
      if (Math.abs(car.z - r) > 4.6) { s.count = 0; s.dir = 0; return; }
      PX.forEach((px, i) => {
        let dir = 0;
        if (st.prevX < px && car.x >= px) dir = 1; else if (st.prevX > px && car.x <= px) dir = -1;
        if (!dir) return;
        const side = Math.sign(car.z - r) || 1;
        if (s.dir === dir && side !== s.side && i === s.idx + dir) s.count++; else s.count = 1;
        s.dir = dir; s.side = side; s.idx = i;
        if (s.count >= 4 && !s.done[dir]) {
          s.done[dir] = true;
          if (!(s.done[1] && s.done[-1]) && live() && !st.done.slalom)
            toast('<div class="t-sub">Слалом: теперь обратно по тому же ряду</div>', 1400);
        }
        if (s.done[1] && s.done[-1]) complete('slalom');
      });
    });
    st.prevX = car.x;
    // lap
    const ang = Math.atan2(car.z, car.x * 0.44);
    if (Math.abs(car.x) < 32.5 && Math.abs(car.z) < 9) st.lapSum = 0;
    else if (st.lapPrev !== null) {
      let d = ang - st.lapPrev; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU;
      st.lapSum += d; if (Math.abs(st.lapSum) >= TAU) complete('lap');
    }
    st.lapPrev = ang;
  }

  return { st, reset, refresh, complete, onHit, check };
}
