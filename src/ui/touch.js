import { $ } from '../util.js';
import { touchK } from './input.js';

export function initTouch() {
  const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  if (isTouch) document.body.classList.add('touch');
  document.querySelectorAll('#touch button').forEach(b => {
    const k = b.dataset.k;
    const on = e => { e.preventDefault(); touchK[k] = true; b.classList.add('act'); try { b.setPointerCapture(e.pointerId); } catch (_) {} };
    const off = e => { touchK[k] = false; b.classList.remove('act'); };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off);
  });
}
export function showTouch(on) { $('#touch').classList.toggle('on', on); }
