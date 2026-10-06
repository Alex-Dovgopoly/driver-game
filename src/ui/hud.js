import { $ } from '../util.js';

const hudEl = $('#hud'), timerEl = $('#timer'), spdEl = $('#speedo');
const manEl = $('#man'), strikesEl = $('#strikes'), toastEl = $('#toast');

export function showHud(on) { hudEl.classList.toggle('on', on); }

let toastTimer = 0;
export function toast(html, ms) {
  toastEl.innerHTML = html; toastEl.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}
export function hideToast() { toastEl.classList.remove('show'); }

export function setTimer(html) { timerEl.innerHTML = html; }
export function setTimerLow(low) { timerEl.classList.toggle('low', low); }
export function setSpeed(kmh) { spdEl.innerHTML = `${kmh}<small>км/ч</small>`; }

/* maneuver list + strike boxes. train — show the how-to hints under each item */
export function buildList(MAN, train, maxStrikes) {
  manEl.innerHTML = MAN.map(m => `<li data-id="${m.id}">${m.name}<span class="pr"></span>${train ? `<small>${m.how}</small>` : ''}</li>`).join('');
  strikesEl.innerHTML = Array.from({ length: maxStrikes }, () => '<span>✕</span>').join('');
}
/* done — {id: true}, labels — {id: progressText} for unfinished items, strikes — count */
export function refreshList(done, labels, strikes) {
  for (const li of manEl.children) {
    const id = li.dataset.id; li.classList.toggle('done', !!done[id]);
    const pr = li.querySelector('.pr');
    const t = done[id] ? '' : (labels[id] || '');
    if (pr.textContent !== t) pr.textContent = t;
  }
  [...strikesEl.children].forEach((s, i) => s.classList.toggle('hit', i < strikes));
}
