/* shared mutable session state (mode machine + toggles) */
export const state = {
  mode: 'menu',        // 'menu' | 'count' | 'play' | 'train' | 'over'
  lastMode: 'play',    // 'play' | 'train' — what R / «Ещё раз» restarts
  muted: false,
  camMode: 0,          // 0 chase, 1 top-down
  shake: 0,            // camera shake amount after a hit
  resultShown: false
};
