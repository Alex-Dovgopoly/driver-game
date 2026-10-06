import { $ } from '../util.js';

const menuEl = $('#menu'), resultEl = $('#result');

export function renderHowto(MAN) {
  const howto = $('#howto');
  for (const m of MAN) howto.insertAdjacentHTML('beforeend', `<dt>${m.name}</dt><dd>${m.how}</dd>`);
}
export function showMenu(on) { menuEl.classList.toggle('on', on); }
export function showResult(on) { resultEl.classList.toggle('on', on); }
export function setResult(ok, text) {
  $('#rTitle').textContent = ok ? 'Принят' : 'Не принят';
  $('#rTitle').classList.toggle('fail', !ok);
  $('#rText').textContent = text;
}
export function focusStart() { $('#bStart').focus(); }
export function focusAgain() { $('#bAgain').focus(); }
export function bindButtons({ onStart, onTrain, onAgain, onMenu }) {
  $('#bStart').addEventListener('click', onStart);
  $('#bTrain').addEventListener('click', onTrain);
  $('#bAgain').addEventListener('click', onAgain);
  $('#bMenu').addEventListener('click', onMenu);
}
