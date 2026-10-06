import * as THREE from 'three';

const SKID_MAX = 1400;

/* ring buffer of skid-mark quads as one InstancedMesh; returns { markAt, clear } */
export function createSkids(scene) {
  const skidMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 0.27),
    new THREE.MeshBasicMaterial({ color: 0x0b0907, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), SKID_MAX);
  skidMesh.count = 0; skidMesh.frustumCulled = false; scene.add(skidMesh);
  let skidIdx = 0, skidFilled = 0;
  const dummy = new THREE.Object3D();
  const lastMark = [null, null];
  /* i — wheel index (0/1), emit — whether this wheel is skidding right now */
  function markAt(i, x, z, emit) {
    const lm = lastMark[i];
    if (!emit) { lastMark[i] = null; return; }
    if (!lm) { lastMark[i] = { x, z }; return; }
    const dx = x - lm.x, dz = z - lm.z, d = Math.hypot(dx, dz);
    if (d < 0.25) return;
    if (d > 3) { lastMark[i] = { x, z }; return; }
    dummy.position.set((x + lm.x) / 2, 0.012, (z + lm.z) / 2);
    dummy.rotation.set(-Math.PI / 2, 0, -Math.atan2(dz, dx));
    dummy.scale.set(d + 0.04, 1, 1); dummy.updateMatrix();
    skidMesh.setMatrixAt(skidIdx, dummy.matrix);
    skidIdx = (skidIdx + 1) % SKID_MAX; skidFilled = Math.min(SKID_MAX, skidFilled + 1);
    skidMesh.count = skidFilled; skidMesh.instanceMatrix.needsUpdate = true;
    lastMark[i] = { x, z };
  }
  function clear() { skidIdx = 0; skidFilled = 0; skidMesh.count = 0; lastMark[0] = lastMark[1] = null; }
  return { markAt, clear };
}
