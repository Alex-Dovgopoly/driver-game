/* keyboard + touch state, merged into one inputs() snapshot per frame */
export const keys = new Set();
export const touchK = { left: false, right: false, gas: false, brake: false, hand: false, burn: false };

/* onHotkey(code) — fired once per non-repeated keydown for C/M/R/Esc/Enter handling */
export function initKeyboard(onHotkey) {
  window.addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);
    onHotkey(e.code);
  });
  window.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); for (const k in touchK) touchK[k] = false; });
}

const K = (...c) => c.some(x => keys.has(x));
const NONE = { gas: false, brake: false, left: false, right: false, hand: false, burn: false };
/* live — whether the car currently accepts input (play / train) */
export function readInputs(live) {
  if (!live) return NONE;
  return {
    gas: K('KeyW', 'ArrowUp') || touchK.gas,
    brake: K('KeyS', 'ArrowDown') || touchK.brake,
    left: K('KeyA', 'ArrowLeft') || touchK.left,
    right: K('KeyD', 'ArrowRight') || touchK.right,
    hand: K('Space') || touchK.hand,
    burn: K('ShiftLeft', 'ShiftRight') || touchK.burn
  };
}
