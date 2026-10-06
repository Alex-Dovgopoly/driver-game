import * as THREE from 'three';
import { $, clamp } from './util.js';
import { HX, HZ, START } from './world/constants.js';
import { configureTextures } from './world/textures.js';
import { buildGarage } from './world/garage.js';
import { placeParkedCars, createPlayer } from './world/cars.js';
import { createSmoke } from './fx/smoke.js';
import { createSkids } from './fx/skids.js';
import { createSuspension } from './fx/suspension.js';
import { car, resetCar, physStep, steerMax } from './physics/car.js';
import { createManeuvers, MAN } from './game/maneuvers.js';
import { state } from './game/state.js';
import { initAudio, blip, updateAudio } from './audio.js';
import * as hud from './ui/hud.js';
import * as menu from './ui/menu.js';
import { initKeyboard, readInputs } from './ui/input.js';
import { initTouch, showTouch } from './ui/touch.js';

function boot() {
  /* ---------- renderer ---------- */
  const canvas = $('#gl');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch (e) {
    document.body.innerHTML = '<p style="padding:40px;font:20px sans-serif;color:#F3E6C8">Браузеру не удалось запустить WebGL. Попробуй другой браузер или включи аппаратное ускорение.</p>';
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x120c08);
  scene.fog = new THREE.Fog(0x120c08, 30, 100);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 220);
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 1 ? 78 : 62;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  /* ---------- world ---------- */
  configureTextures(renderer);
  const { ceilingGroup } = buildGarage(scene);
  placeParkedCars(scene);
  const P = createPlayer(scene);
  const smoke = createSmoke(scene);
  const skids = createSkids(scene);
  const suspension = createSuspension();

  /* ---------- game ---------- */
  const man = createManeuvers({ onFinish: finish });
  menu.renderHowto(MAN);
  let curIn = readInputs(false);

  /* ---------- input ---------- */
  initKeyboard(code => {
    if (code === 'KeyC') { state.camMode = 1 - state.camMode; ceilingGroup.visible = state.camMode === 0; }
    if (code === 'KeyM') { state.muted = !state.muted; }
    if (code === 'KeyR' && (state.mode === 'play' || state.mode === 'train' || state.mode === 'count')) start(state.lastMode);
    if (code === 'Escape' && state.mode !== 'menu') toMenu();
    if (code === 'Enter') { if (state.mode === 'menu') start('play'); else if (state.mode === 'over' && state.resultShown) start(state.lastMode); }
  });
  initTouch();

  /* ---------- UI flow ---------- */
  let countT = 0;
  function start(m) {
    initAudio();
    state.lastMode = m; resetCar(); man.reset(); skids.clear(); suspension.reset();
    camYaw = car.th; snapCam = true;
    menu.showMenu(false); menu.showResult(false);
    hud.showHud(true); showTouch(true);
    state.resultShown = false;
    if (m === 'play') { state.mode = 'count'; countT = 3; hud.toast('<div class="t-big">3</div>', 900); }
    else { state.mode = 'train'; hud.toast('<div class="t-sub">Тренировка: удары считаются, но не выгоняют</div>', 1800); }
    man.refresh();
    hud.setTimer(m === 'train' ? '∞<small>тренировка</small>' : '1:00<small>осталось</small>');
  }
  function toMenu() {
    state.mode = 'menu'; menu.showResult(false); hud.showHud(false); showTouch(false);
    menu.showMenu(true); hud.hideToast(); menu.focusStart();
  }
  function finish(ok, why) {
    state.mode = 'over';
    const { done, strikes, timeLeft } = man.st;
    const n = MAN.filter(x => done[x.id]).length;
    if (ok) hud.toast('<div class="t-man">Принят!</div>', 1400);
    else hud.toast(`<div class="t-hit">${why === 'time' ? 'Время вышло' : 'Четвёртый удар'}</div>`, 1400);
    setTimeout(() => {
      menu.setResult(ok, ok
        ? `Все девять манёвров за ${(60 - timeLeft).toFixed(1)} с, ударов: ${strikes}. Работа твоя — завтра первое задание.`
        : (why === 'time'
          ? `Шестьдесят секунд истекли. Выполнено ${n} из 9. Не хватило: ${MAN.filter(x => !done[x.id]).map(x => x.name).join(', ')}.`
          : `Четыре удара — слишком дорого для водителя. Выполнено ${n} из 9 за ${(60 - timeLeft).toFixed(1)} с.`));
      menu.showResult(true); showTouch(false); state.resultShown = true; menu.focusAgain();
    }, 1500);
  }
  menu.bindButtons({
    onStart: () => start('play'),
    onTrain: () => start('train'),
    onAgain: () => start(state.lastMode),
    onMenu: toMenu
  });

  /* ---------- camera ---------- */
  let snapCam = true, menuT = 0, camYaw = 0;
  const camTarget = new THREE.Vector3(), look = new THREE.Vector3(), lookS = new THREE.Vector3();
  function updateCamera(dt) {
    if (state.mode === 'menu') {
      menuT += dt * 0.07;
      camera.position.set(Math.cos(menuT) * 26, 3.3, Math.sin(menuT) * 13);
      camera.lookAt(START.x * 0.3, 1.0, 0); snapCam = true; return;
    }
    camYaw += (car.th - camYaw) * Math.min(1, 3.2 * dt);
    const fx = Math.cos(camYaw), fz = Math.sin(camYaw);
    if (state.camMode === 0) {
      camTarget.set(car.x - fx * 7.4, 2.85, car.z - fz * 7.4);
      look.set(car.x + fx * 4, 0.9, car.z + fz * 4);
    } else {
      camTarget.set(car.x - fx * 4, 19, car.z - fz * 4);
      look.set(car.x + fx * 2, 0, car.z + fz * 2);
    }
    camTarget.x = clamp(camTarget.x, -HX + 0.7, HX - 0.7);
    camTarget.z = clamp(camTarget.z, -HZ + 0.7, HZ - 0.7);
    if (snapCam) { camera.position.copy(camTarget); lookS.copy(look); snapCam = false; }
    const k = 1 - Math.exp(-8 * dt);
    camera.position.lerp(camTarget, k); lookS.lerp(look, 1 - Math.exp(-12 * dt));
    if (state.shake > 0) {
      camera.position.x += (Math.random() - 0.5) * state.shake; camera.position.y += (Math.random() - 0.5) * state.shake;
      state.shake = Math.max(0, state.shake - dt * 1.4);
    }
    camera.lookAt(lookS);
  }

  /* ---------- main loop ---------- */
  let last = performance.now(), acc = 0, lastSec = -1, skidAmt = 0;
  const FIX = 1 / 120;
  const onHit = impact => man.onHit(impact);
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (state.mode === 'count') {
      const prev = Math.ceil(countT); countT -= dt; const cur = Math.ceil(countT);
      if (cur !== prev) {
        if (cur > 0) { hud.toast(`<div class="t-big">${cur}</div>`, 900); blip(440, 0.12); }
        else { hud.toast('<div class="t-big">Поехали!</div>', 900); blip(880, 0.25); state.mode = 'play'; }
      }
    }
    const live = state.mode === 'play' || state.mode === 'train';
    curIn = readInputs(live);
    acc += dt;
    while (acc >= FIX) { physStep(FIX, curIn, onHit); acc -= FIX; }
    if (live) {
      man.st.gt += dt;
      man.check(dt);
      if (state.mode === 'play') {
        man.st.timeLeft = Math.max(0, man.st.timeLeft - dt);
        const s = Math.ceil(man.st.timeLeft);
        if (s !== lastSec) {
          lastSec = s;
          hud.setTimer(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}<small>осталось</small>`);
          hud.setTimerLow(s <= 10);
          if (s <= 5 && s > 0) blip(520, 0.05);
        }
        if (man.st.timeLeft <= 0) finish(false, 'time');
      }
      if (Math.random() < 0.1) man.refresh();
    }
    // visuals
    const c = Math.cos(car.th), s = Math.sin(car.th);
    P.root.position.set(car.x, 0, car.z);
    P.root.rotation.y = -car.th;
    // target poses from the physics; the body reaches them through a damped spring
    const rollT = clamp(-car.w * car.vL * 0.006, -0.07, 0.07);
    const pitchT = clamp(car.accel * 0.0035, -0.06, 0.05);
    const { pitch, roll } = suspension.update(dt, pitchT, rollT);
    P.body.rotation.set(roll, 0, pitch);
    const dmax = steerMax(car.vL);
    for (const f of P.fronts) f.rotation.y = -car.steer * dmax;
    const roll1 = car.vL * dt / 0.36;
    P.wheels.forEach((w, i) => { w.rotation.z -= (i >= 2 && car.spin) ? 0.9 : roll1; });
    P.tailMat.emissiveIntensity = car.brakeHeld && (car.vL > 0.3 || car.spin) ? 2.4 : (car.vL < -0.3 ? 1.4 : 0.6);
    // skid & smoke
    const sliding = Math.abs(car.vS) > 3;
    const hb = car.hand && car.speed > 2;
    const hardBrake = car.brakeHeld && car.vL > 10;
    const skidding = sliding || hb || car.spin || hardBrake;
    skidAmt += ((skidding ? (car.spin ? 1 : clamp(Math.abs(car.vS) / 8 + (hb ? 0.5 : 0) + (hardBrake ? 0.5 : 0), 0, 1)) : 0) - skidAmt) * Math.min(1, dt * 10);
    const rx = -s, rz = c;
    for (let i = 0; i < 2; i++) {
      const side = i ? 0.9 : -0.9;
      const wx = car.x - c * 1.45 + rx * side, wz = car.z - s * 1.45 + rz * side;
      skids.markAt(i, wx, wz, skidding && state.mode !== 'menu');
      const smokeRate = car.spin ? 0.7 : (sliding && car.speed > 6 ? 0.25 : (hb && car.speed > 8 ? 0.2 : 0));
      if (Math.random() < smokeRate) smoke.puff(wx, wz, car.spin ? 1 : 0.6);
    }
    smoke.update(dt);
    hud.setSpeed(Math.round(car.speed * 3.6));
    updateCamera(dt);
    updateAudio(car, skidAmt);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
  menu.focusStart();
}

boot();
