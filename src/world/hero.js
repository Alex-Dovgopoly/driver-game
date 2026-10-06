import * as THREE from 'three';

/*
 * The player's car: a 1971–72 Buick Skylark hardtop coupe, built procedurally.
 * Long hood, cabin set back, vinyl roof with a wide sloping C-pillar, quad round
 * headlights beside a wide grille, chrome bumpers with the tail lights set into
 * the rear one, grey mag wheels. Same footprint and wheel positions as makeCar()
 * so the physics, collision circles and camera stay untouched.
 *
 * Car space: +X forward, +Y up, +Z right. The side profiles below are drawn in XY
 * and extruded along Z (width).
 */

// no environment map in the scene, so fully metallic surfaces render almost black: keep metalness moderate
const chrome = new THREE.MeshStandardMaterial({ color: 0xe6e1d6, roughness: 0.22, metalness: 0.55 });
const rubber = new THREE.MeshStandardMaterial({ color: 0x141210, roughness: 0.9 });
const glass = new THREE.MeshStandardMaterial({ color: 0x2b3b4a, roughness: 0.1, metalness: 0.4 });
const dark = new THREE.MeshStandardMaterial({ color: 0x0d0b09, roughness: 1 });
const vinyl = new THREE.MeshStandardMaterial({ color: 0x15120f, roughness: 0.96, metalness: 0 });
const mag = new THREE.MeshStandardMaterial({ color: 0x7c7873, roughness: 0.42, metalness: 0.45 });
const grilleMat = new THREE.MeshStandardMaterial({ color: 0x1a1816, roughness: 0.6, metalness: 0.6 });

export const HERO_PAINT = 0x1b2a52;

function profile(points) {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) s.lineTo(points[i][0], points[i][1]);
  s.closePath();
  return s;
}
/* extrude a side profile to the given total width, centred on z = 0 */
function extrude(shape, width, bevel = 0.03) {
  const depth = Math.max(0.01, width - 2 * bevel);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 14
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

/* lower body: rear bumper line → ducktail → deck → belt line → hood → nose → floor with two wheel arches */
function lowerBodyShape() {
  const b = new THREE.Shape();
  b.moveTo(-2.36, 0.34);
  b.lineTo(-2.50, 0.56);
  b.lineTo(-2.54, 0.84);
  b.lineTo(-2.46, 1.04);     // ducktail tip
  b.lineTo(-2.15, 1.07);
  b.lineTo(-1.55, 1.04);     // hip over the rear wheel
  b.lineTo(-0.95, 0.99);     // belt line dips through the doors
  b.lineTo(0.85, 0.975);     // cowl
  b.lineTo(1.10, 0.965);
  b.lineTo(2.35, 0.90);      // hood
  b.lineTo(2.58, 0.86);      // prow: the hood lip overhangs the grille
  b.lineTo(2.52, 0.62);
  b.lineTo(2.40, 0.34);
  b.lineTo(1.45 + 0.45, 0.34);
  b.absarc(1.45, 0.36, 0.45, 0, Math.PI, false);    // front arch (over the top), snug around the tyre
  b.lineTo(-1.45 + 0.45, 0.34);
  b.absarc(-1.45, 0.36, 0.45, 0, Math.PI, false);   // rear arch
  b.closePath();
  return b;
}

/* grey five-spoke mag with a polished lip; side = +1 right wheel, -1 left */
function makeWheel(side) {
  const spin = new THREE.Group();
  const tire = new THREE.CylinderGeometry(0.36, 0.36, 0.27, 24); tire.rotateX(Math.PI / 2);
  const t = new THREE.Mesh(tire, rubber); t.castShadow = true; spin.add(t);
  const rim = new THREE.CylinderGeometry(0.255, 0.255, 0.26, 24); rim.rotateX(Math.PI / 2);
  const r = new THREE.Mesh(rim, mag); r.position.z = side * 0.02; spin.add(r);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.265, 0.022, 8, 28), chrome);
  lip.position.z = side * 0.14; spin.add(lip);
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.02, 20).rotateX(Math.PI / 2), dark);
  dish.position.z = side * 0.12; spin.add(dish);
  for (let i = 0; i < 5; i++) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.40, 0.04), mag);
    sp.rotation.z = i * (Math.PI * 2 / 5); sp.position.z = side * 0.135; spin.add(sp);
  }
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 12).rotateX(Math.PI / 2), chrome);
  cap.position.z = side * 0.15; spin.add(cap);
  return spin;
}

export function makeHeroCar(scene, color = HERO_PAINT) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.26, metalness: 0.45 });
  const add = (geo, mat, x = 0, y = 0, z = 0, parent = body) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };

  // --- shell ---
  add(extrude(lowerBodyShape(), 1.95, 0.035), paint);
  add(new THREE.BoxGeometry(4.2, 0.06, 1.7), dark, 0, 0.33);                       // floor pan / sills shadow
  // greenhouse glass: windshield → roof → rear window
  add(extrude(profile([[0.84, 0.985], [0.28, 1.42], [-0.70, 1.44], [-1.02, 1.36], [-1.60, 1.035]]), 1.66, 0.02), glass);
  // vinyl roof cap
  add(extrude(profile([[0.34, 1.395], [0.27, 1.45], [-0.70, 1.468], [-1.04, 1.385], [-1.08, 1.36], [-0.74, 1.43], [0.26, 1.41]]), 1.70, 0.01), vinyl);
  // C-pillars (vinyl), one per side, sitting on the glass flanks
  const cShape = profile([[-0.42, 1.44], [-0.70, 1.44], [-1.60, 1.035], [-1.14, 1.01]]);
  for (const s of [-1, 1]) add(extrude(cShape, 0.26, 0.015), vinyl, 0, 0, s * 0.715);
  // A-pillars
  for (const s of [-1, 1]) {
    const p = add(new THREE.BoxGeometry(0.72, 0.075, 0.07), paint, 0.56, 1.20, s * 0.80);
    p.rotation.z = Math.atan2(1.42 - 0.975, 0.28 - 0.84);
  }
  // hood centre ridge and cowl vent
  add(new THREE.BoxGeometry(1.5, 0.025, 0.46), paint, 1.6, 0.955);
  add(new THREE.BoxGeometry(0.16, 0.02, 1.3), dark, 0.95, 0.985);

  // --- chrome ---
  add(new THREE.BoxGeometry(0.12, 0.17, 2.02), chrome, 2.58, 0.57);                 // front bumper
  add(new THREE.BoxGeometry(0.12, 0.26, 2.02), chrome, -2.58, 0.66);                // rear bumper
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(3.3, 0.035, 0.02), chrome, -0.1, 0.395, s * 0.99);   // rocker trim
    add(new THREE.BoxGeometry(0.16, 0.025, 0.03), chrome, 0.05, 0.84, s * 0.99);   // door handle
  }
  add(new THREE.BoxGeometry(0.07, 0.085, 0.12), chrome, 0.55, 1.09, -1.02);        // driver's mirror
  for (const s of [-1, 1]) {
    const e = add(new THREE.CylinderGeometry(0.035, 0.035, 0.18, 10), chrome, -2.36, 0.27, s * 0.55);
    e.rotation.z = Math.PI / 2;                                                     // exhaust tips
  }

  // --- face ---
  add(new THREE.BoxGeometry(0.03, 0.04, 1.92), chrome, 2.575, 0.845);              // chrome strip under the hood lip
  add(new THREE.BoxGeometry(0.03, 0.24, 1.92), paint, 2.55, 0.73);                  // fascia panel
  add(new THREE.BoxGeometry(0.03, 0.24, 1.0), chrome, 2.575, 0.73);                 // grille frame
  add(new THREE.BoxGeometry(0.03, 0.19, 0.92), grilleMat, 2.585, 0.73);             // grille
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff4d6, emissive: 0xfff0c0, emissiveIntensity: 1.8 });
  const lampGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.05, 18).rotateZ(Math.PI / 2);
  const bezelGeo = new THREE.CylinderGeometry(0.108, 0.108, 0.04, 18).rotateZ(Math.PI / 2);
  for (const s of [-1, 1]) for (const z of [0.60, 0.815]) {
    add(bezelGeo, chrome, 2.585, 0.73, s * z);
    add(lampGeo, headMat, 2.605, 0.73, s * z);
  }
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.02, 0.06, 0.14), new THREE.MeshStandardMaterial({ color: 0xe8a040, emissive: 0xc06010, emissiveIntensity: 0.4 }), 2.0, 0.70, s * 0.985); // side markers

  // --- tail ---
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x7a0c08, emissive: 0xff2010, emissiveIntensity: 0.6 });
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.03, 0.10, 0.62), tailMat, -2.645, 0.69, s * 0.56);
    add(new THREE.BoxGeometry(0.02, 0.05, 0.08), new THREE.MeshStandardMaterial({ color: 0xf0f0e0 }), -2.65, 0.69, s * 0.40); // reverse lamp
  }
  add(new THREE.BoxGeometry(0.02, 0.13, 0.30), new THREE.MeshStandardMaterial({ color: 0x1e3b8a, roughness: 0.6 }), -2.65, 0.62, 0); // plate

  // --- wheels ---
  const wheels = [], fronts = [];
  for (const [wx, wz] of [[1.45, 0.9], [1.45, -0.9], [-1.45, 0.9], [-1.45, -0.9]]) {
    const pivot = new THREE.Group(); pivot.position.set(wx, 0.36, wz); root.add(pivot);
    const spin = makeWheel(Math.sign(wz)); pivot.add(spin);
    wheels.push(spin); if (wx > 0) fronts.push(pivot);
  }
  scene.add(root);
  return { root, body, wheels, fronts, tailMat, headMat };
}
