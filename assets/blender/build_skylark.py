"""
Builds the player's car, a 1970 Buick Skylark hardtop coupe, procedurally in Blender
and exports it for the game.

Run inside Blender (Python console / Text editor / MCP):
    SKYLARK_ROOT = '/path/to/driver-game'      # optional, defaults to the repo this file lives in
    exec(open(SKYLARK_ROOT + '/assets/blender/build_skylark.py').read())

Outputs:
    assets/blender/skylark.blend   editable source (cage meshes with Subdivision modifiers)
    public/models/skylark.glb      export for three.js, modifiers applied

Car space in Blender: +X forward, +Y left, +Z up, ground at z = 0, origin midway
between the axles. The glTF exporter turns this into +X forward, +Y up, +Z right,
which is the convention of src/world/hero.js.

Colours are the raw hex values the game uses (sRGB numbers written as linear),
so the glb looks the same as the current procedural car under the game's lighting.

Hierarchy:  Skylark (empty)
              Body  (shell)  <- Glass, Bumpers, Trim, Details
              Wheel_FL / Wheel_FR / Wheel_RL / Wheel_RR  (origin at the hub, L = +Y side)
"""
import bpy, bmesh, os
from math import sin, cos, tan, pi, asin, radians, atan2
from mathutils import Vector

ROOT = globals().get('SKYLARK_ROOT', '/Users/aleksandrdovgopolyj/Work/driver-game')
DO_SAVE = globals().get('SKYLARK_SAVE', False)
DO_EXPORT = globals().get('SKYLARK_EXPORT', False)
OUT_BLEND = os.path.join(ROOT, 'assets', 'blender', 'skylark.blend')
OUT_GLB = os.path.join(ROOT, 'public', 'models', 'skylark.glb')

V = Vector

# ------------------------------------------------------------------ dimensions (m)
WB = 2.845                              # wheelbase 112 in
AX_F, AX_R = WB / 2, -WB / 2
TIRE_R, TIRE_W_F, TIRE_W_R = 0.343, 0.215, 0.245   # ~27 in tyres, wider at the back
WHEEL_Z = TIRE_R + 0.002
HALF_TRACK_F, HALF_TRACK_R = 0.78, 0.80     # tyres flush with the arch lips, rear track wider
ARCH_A, ARCH_B = 0.46, 0.41              # wheel opening: semi-ellipse, wider than tall
Z_FLOOR, Z_SILL = 0.26, 0.30
W_INNER = 0.56                          # wheel-well inner wall
X_NOSE, X_TAIL = 2.36, -2.64            # shell ends; bumpers reach 2.42 / -2.716 (5.136 m overall)

# half-width at the belt line along the length (coke-bottle: hips over the rear wheels)
W_TAB = [(-2.64, 0.90), (-2.50, 0.945), (-2.10, 0.976), (-1.40, 0.976), (-0.60, 0.93),
         (0.30, 0.925), (1.20, 0.95), (1.90, 0.945), (2.25, 0.905), (2.36, 0.86)]
# belt line / fender crest height
ZB_TAB = [(-2.64, 0.84), (-2.45, 0.875), (-2.10, 0.935), (-1.45, 1.0), (-0.90, 0.975), (-0.20, 0.955),
          (0.60, 0.965), (1.30, 0.955), (2.00, 0.90), (2.25, 0.845), (2.36, 0.815)]
# nose: the hood's leading edge is a V in plan (prow) and the face is raked back below the lip
PROW, BROW, RAKE = 0.05, 0.05, 0.06


def clamp01(v):
    return min(1.0, max(0.0, v))


def nose_dx(x, y, z):
    a = max(0.0, (x - 1.95) / (X_NOSE - 1.95)) ** 2
    W = pl(W_TAB, x)
    prow = PROW * (1 - (abs(y) / W) ** 2) * clamp01((z - 0.72) / 0.08)        # hood lip only
    brow = BROW * clamp01((abs(y) / W - 0.55) / 0.3) * clamp01((z - 0.60) / 0.15)  # fender tips over the lamps
    return a * (prow + brow + RAKE * (z - 0.55) / 0.35)
# top surface relative to the belt: deck a touch lower, hood lower than the fender peaks
DTOP_TAB = [(-2.64, -0.01), (-1.50, -0.005), (-1.42, 0.0), (0.62, 0.0), (0.70, -0.025), (2.36, -0.02)]


def pl(tab, x):
    if x <= tab[0][0]:
        return tab[0][1]
    for (x0, y0), (x1, y1) in zip(tab, tab[1:]):
        if x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return tab[-1][1]


# ------------------------------------------------------------------ materials
def hexrgb(h):
    return ((h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255)


def material(name, color, rough, metal, emit=None, emit_str=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    rgb = hexrgb(color)
    bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if emit is not None:
        bsdf.inputs['Emission Color'].default_value = (*hexrgb(emit), 1)
        bsdf.inputs['Emission Strength'].default_value = emit_str
    try:
        m.diffuse_color = (*rgb, 1)
    except Exception:
        pass
    return m


MAT_DEFS = [
    ('Paint', 0x1b2a52, 0.26, 0.45, None, 0),
    ('Chrome', 0xe6e1d6, 0.22, 0.55, None, 0),
    ('Glass', 0x2b3b4a, 0.10, 0.40, None, 0),
    ('Rubber', 0x141210, 0.90, 0.00, None, 0),
    ('Dark', 0x0d0b09, 1.00, 0.00, None, 0),
    ('Vinyl', 0x15120f, 0.96, 0.00, None, 0),
    ('Grille', 0x1a1816, 0.60, 0.60, None, 0),
    ('Headlamp', 0xfff4d6, 0.30, 0.00, 0xfff0c0, 1.0),
    ('Taillamp', 0x7a0c08, 0.30, 0.00, 0xff2010, 0.6),
    ('Amber', 0xe8a040, 0.40, 0.00, 0xc06010, 0.4),
    ('White', 0xf0f0e0, 0.40, 0.00, None, 0),
    ('Letters', 0xd8d4c8, 0.85, 0.00, None, 0),
    ('Red', 0xc8102e, 0.40, 0.00, None, 0),
    ('Blue', 0x1b3f9a, 0.40, 0.00, None, 0),
    ('Plate', 0x1e3b8a, 0.60, 0.00, None, 0),
]
(I_PAINT, I_CHROME, I_GLASS, I_RUBBER, I_DARK, I_VINYL, I_GRILLE, I_HEAD, I_TAIL, I_AMBER,
 I_WHITE, I_LETTERS, I_RED, I_BLUE, I_PLATE) = range(len(MAT_DEFS))


# ------------------------------------------------------------------ mesh builder
def face_normal(pts):
    n = V((0, 0, 0))
    for i in range(len(pts)):
        a, b = pts[i], pts[(i + 1) % len(pts)]
        n.x += (a.y - b.y) * (a.z + b.z)
        n.y += (a.z - b.z) * (a.x + b.x)
        n.z += (a.x - b.x) * (a.y + b.y)
    return n


class MB:
    """Accumulates parts into one mesh. Every part gets its own material index and
    a normal fix: 'recalc' (closed shells, bmesh decides the outside) or 'ref'
    (open shells, faces flipped to point away from ref(center))."""

    def __init__(self):
        self.v, self.f, self.fm, self.crease = [], [], [], {}

    def add(self, verts, faces, mats, fix=None, ref=None):
        off = len(self.v)
        verts = [tuple(p) for p in verts]
        faces = [tuple(off + i for i in f) for f in faces]
        if fix == 'recalc':
            bm = bmesh.new()
            bvs = [bm.verts.new(p) for p in verts]
            bm.verts.index_update()
            for f in faces:
                bm.faces.new([bvs[i - off] for i in f])
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            bm.faces.ensure_lookup_table()
            faces = [tuple(off + v.index for v in bf.verts) for bf in bm.faces]
            bm.free()
        elif fix == 'ref':
            out = []
            for f in faces:
                pts = [V(verts[i - off]) for i in f]
                c = sum(pts, V((0, 0, 0))) / len(pts)
                if face_normal(pts).dot(c - ref(c)) < 0:
                    f = tuple(reversed(f))
                out.append(f)
            faces = out
        self.v += verts
        self.f += faces
        self.fm += mats if isinstance(mats, list) else [mats] * len(faces)
        return off

    def ck(self, a, b, val):
        self.crease[(min(a, b), max(a, b))] = val

    def build(self, name, coll, smooth=True, sharp_deg=None, subsurf=0, parent=None, loc=(0, 0, 0)):
        me = bpy.data.meshes.new(name)
        me.from_pydata(self.v, [], self.f)
        for n, c, r, m, e, es in MAT_DEFS:
            me.materials.append(bpy.data.materials[n])
        for p, mi in zip(me.polygons, self.fm):
            p.material_index = mi
        me.update()
        if self.crease:
            attr = me.attributes.new('crease_edge', 'FLOAT', 'EDGE')
            km = {(min(e.vertices), max(e.vertices)): e.index for e in me.edges}
            for k, val in self.crease.items():
                idx = km.get(k)
                if idx is not None:
                    attr.data[idx].value = val
        if smooth:
            for p in me.polygons:
                p.use_smooth = True
        if sharp_deg is not None:
            mark_sharp(me, sharp_deg)
        ob = bpy.data.objects.new(name, me)
        coll.objects.link(ob)
        ob.location = loc
        ob.parent = parent
        if subsurf:
            mod = ob.modifiers.new('Subdivision', 'SUBSURF')
            mod.levels = mod.render_levels = subsurf
        return ob


def mark_sharp(me, deg):
    cos_t = cos(radians(deg))
    ef = {}
    for p in me.polygons:
        for k in p.edge_keys:
            ef.setdefault(tuple(sorted(k)), []).append(p.index)
    km = {tuple(sorted(e.vertices)): e.index for e in me.edges}
    attr = me.attributes.get('sharp_edge') or me.attributes.new('sharp_edge', 'BOOLEAN', 'EDGE')
    for k, fs in ef.items():
        if len(fs) == 2 and me.polygons[fs[0]].normal.dot(me.polygons[fs[1]].normal) < cos_t:
            attr.data[km[k]].value = True


def angles(n):
    return [2 * pi * k / n for k in range(n)]


def loft(mb, rings, mats, cap_start=None, cap_end=None, fix='recalc', ref=None, loop=False, closed_ring=True):
    """rings: list of point lists (all the same length) or single-point poles."""
    N = max(len(r) for r in rings)
    verts, starts = [], []
    for r in rings:
        starts.append(len(verts))
        verts += list(r)
    faces, fm = [], []
    mat = mats if callable(mats) else (lambda s, i: mats)
    S = len(rings)
    pairs = [(s, s + 1) for s in range(S - 1)] + ([(S - 1, 0)] if loop else [])
    segs = range(N) if closed_ring else range(N - 1)
    for s, t in pairs:
        ra, rb = rings[s], rings[t]
        a, b = starts[s], starts[t]
        if len(ra) == 1 and len(rb) == 1:
            continue
        for i in segs:
            j = (i + 1) % N
            if len(ra) == 1:
                faces.append((a, b + j, b + i))
            elif len(rb) == 1:
                faces.append((a + i, a + j, b))
            else:
                faces.append((a + i, a + j, b + j, b + i))
            fm.append(mat(s, i))
    if cap_start is not None and len(rings[0]) > 1:
        faces.append(tuple(reversed([starts[0] + i for i in range(N)])))
        fm.append(cap_start)
    if cap_end is not None and len(rings[-1]) > 1:
        faces.append(tuple(starts[-1] + i for i in range(N)))
        fm.append(cap_end)
    off = mb.add(verts, faces, fm, fix=fix, ref=ref)
    return off, starts


BOX_FACES = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]


def box(mb, c, s, mat, rot_z=0.0, rot_y=0.0):
    sx, sy, sz = s[0] / 2, s[1] / 2, s[2] / 2
    cs, sn = cos(rot_z), sin(rot_z)
    cy, sy_ = cos(rot_y), sin(rot_y)
    verts = []
    for x, y, z in [(-sx, -sy, -sz), (sx, -sy, -sz), (sx, sy, -sz), (-sx, sy, -sz),
                    (-sx, -sy, sz), (sx, -sy, sz), (sx, sy, sz), (-sx, sy, sz)]:
        x, z = x * cy + z * sy_, -x * sy_ + z * cy                     # positive rot_y leans the top forward (+x)
        verts.append((c[0] + x * cs - y * sn, c[1] + x * sn + y * cs, c[2] + z))
    mb.add(verts, BOX_FACES, mat, fix='recalc')


def cyl(mb, c, axis, r, length, mat, segs=16):
    rings = []
    for e in (-0.5, 0.5):
        ring = []
        for a in angles(segs):
            u, v = r * cos(a), r * sin(a)
            if axis == 'x':
                p = (c[0] + e * length, c[1] + u, c[2] + v)
            elif axis == 'y':
                p = (c[0] + u, c[1] + e * length, c[2] + v)
            else:
                p = (c[0] + u, c[1] + v, c[2] + e * length)
            ring.append(V(p))
        rings.append(ring)
    loft(mb, rings, mat, cap_start=mat, cap_end=mat)


def catmull(points, n):
    pts = [V(p) for p in points]
    out = []
    for i in range(len(pts) - 1):
        p0, p1, p2, p3 = pts[max(i - 1, 0)], pts[i], pts[i + 1], pts[min(i + 2, len(pts) - 1)]
        for k in range(n):
            t = k / n
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t))
    out.append(pts[-1])
    return out


def frames(pts):
    """tangent / normal / binormal along a polyline, normals carried along to avoid twists"""
    out, prev = [], None
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)])
        t = t.normalized() if t.length > 1e-9 else V((1, 0, 0))
        if prev is None:
            up = V((0, 0, 1)) if abs(t.z) < 0.9 else V((1, 0, 0))
            n = t.cross(up).normalized()
        else:
            n = (prev - prev.dot(t) * t)
            n = n.normalized() if n.length > 1e-6 else prev
        prev = n
        out.append((t, n, n.cross(t)))
    return out


def tube(mb, points, radius, mat, n=4, segs=6):
    pts = catmull(points, n)
    rings = []
    for p, (t, nr, bn) in zip(pts, frames(pts)):
        rings.append([p + nr * radius * cos(a) + bn * radius * sin(a) for a in angles(segs)])
    loft(mb, rings, mat, cap_start=mat, cap_end=mat)


def sweep(mb, path_xy, z, profile, mat):
    """profile (d, h): d outward in plan (to the right of travel), h vertical. Closed solid."""
    pts = [V((x, y, z)) for x, y in path_xy]
    rings = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        n = V((t.y, -t.x, 0))
        rings.append([p + n * d + V((0, 0, h)) for d, h in profile])
    return loft(mb, rings, mat, cap_start=mat, cap_end=mat)


def lathe(mb, profile, mat, side=1, segs=28, loop=False, fix='recalc', ref=None, axis='y', at=(0, 0, 0)):
    """revolve (r, t) around the local Y axis (or X); t is the offset along the axis, scaled by side"""
    rings, at = [], V(at)
    for r, t in profile:
        if r < 1e-6:
            pts = [V((0, side * t, 0))]
        else:
            pts = [V((r * cos(a), side * t, r * sin(a))) for a in angles(segs)]
        if axis == 'x':
            pts = [V((q.y, q.x, q.z)) for q in pts]
        rings.append([q + at for q in pts])
    loft(mb, rings, mat, loop=loop, fix=fix, ref=ref)


def spoke(mb, a, r0, r1, w0, w1, t0, t1, mat, side):
    er, et = V((cos(a), 0, sin(a))), V((-sin(a), 0, cos(a)))

    def P(r, w, t):
        return er * r + et * w + V((0, side * t, 0))
    verts = [P(r0, -w0, t0), P(r1, -w1, t0), P(r1, w1, t0), P(r0, w0, t0),
             P(r0, -w0, t1), P(r1, -w1, t1), P(r1, w1, t1), P(r0, w0, t1)]
    mb.add(verts, BOX_FACES, mat, fix='recalc')


def sector(mb, r0, r1, a0, a1, t, mat, side, n=10):
    rings = []
    for k in range(n + 1):
        a = a0 + (a1 - a0) * k / n
        rings.append([V((r0 * cos(a), side * t, r0 * sin(a))), V((r1 * cos(a), side * t, r1 * sin(a)))])
    loft(mb, rings, mat, fix='ref', ref=lambda c: V((0, 0, 0)), closed_ring=False)


# ------------------------------------------------------------------ body shell
SIDE_LEVELS = [(0.30, -0.16), (0.44, -0.06), (0.60, -0.005)]   # (z, offset from W) down the lower side
LIP = -0.06                                                   # arch lip flare relative to W


def body_ring(x, za=None):
    """20-point cross-section at x; za = wheel-arch ceiling height when inside an arch.
    Side points sit at fixed heights on every station so the loft stays smooth; inside an
    arch the levels below the ceiling turn into ceiling points. Returns (ring, lip index)."""
    W, zb = pl(W_TAB, x), pl(ZB_TAB, x)
    zt = zb + pl(DTOP_TAB, x)
    chain, lip_i = [], None
    if za is None:
        chain.append((W_INNER + 0.16, Z_FLOOR))
        chain += [(W + dw, z) for z, dw in SIDE_LEVELS]
    else:
        kept = [(W + dw, z) for z, dw in SIDE_LEVELS if z > za + 0.03]
        n_ceil = 4 - len(kept)
        for k in range(n_ceil):
            t = k / max(1, n_ceil - 1)
            chain.append((W_INNER + (W + LIP - W_INNER) * t, za))
        lip_i = 2 + n_ceil - 1
        chain += kept
    chain.append((W, zb - 0.12))
    pts = [(0.0, Z_FLOOR), (W_INNER, Z_FLOOR)] + chain + [(W, zb), (W - 0.12, zb - 0.012), (W * 0.5, zt), (0.0, zt)]
    ring = [V((x, y, z)) for y, z in pts] + [V((x, -y, z)) for y, z in reversed(pts[1:-1])]
    return ring, lip_i


def arch_stations(cx, n=8):
    out = []
    for k in range(n + 1):
        th = pi - k * pi / n
        out.append((cx + ARCH_A * cos(th), Z_SILL + ARCH_B * sin(th), 0.0))
    return out


def build_body(coll, root):
    mb = MB()
    stations = ([(X_TAIL, None, -0.03), (-2.58, None, 0), (-2.48, None, 0), (-2.34, None, 0), (-2.18, None, 0), (-2.02, None, 0)]
                + arch_stations(AX_R)
                + [(-0.85, None, 0), (-0.60, None, 0), (-0.35, None, 0), (-0.10, None, 0), (0.15, None, 0), (0.40, None, 0), (0.62, None, 0), (0.82, None, 0)]
                + arch_stations(AX_F)
                + [(1.98, None, 0), (2.10, None, 0), (2.22, None, 0), (2.31, None, 0), (X_NOSE, None, 0.04)])
    rings, lips = [], []
    for x, za, dx in stations:
        r, lip = body_ring(x, za)
        for i in (8, 9, 10, 11, 12):
            r[i].x += dx
        for v in r:
            v.x += nose_dx(x, v.y, v.z)
        rings.append(r)
        lips.append(lip)

    def inner(ring, dx):                                   # shrunk copy of an end ring, set back a little
        c = sum(ring, V((0, 0, 0))) / len(ring)
        return [V((p.x + dx, c.y + (p.y - c.y) * 0.6, c.z + (p.z - c.z) * 0.6)) for p in ring]
    rings = [inner(rings[0], 0.02)] + rings + [inner(rings[-1], -0.02)]
    lips = [None] + lips + [None]

    def bmat(s, k):
        seg = k if k < 10 else 19 - k
        return I_DARK if seg <= 2 else I_PAINT
    off, st = loft(mb, rings, bmat, cap_start=I_PAINT, cap_end=I_PAINT)
    N, S = 20, len(rings)

    def gi(s, i):
        return off + st[s] + i
    for s in range(S - 1):
        for i in (7, 13):
            mb.ck(gi(s, i), gi(s + 1, i), 1.0)           # belt crease
        if lips[s] is not None and lips[s] == lips[s + 1]:
            for i in (lips[s], 20 - lips[s]):
                mb.ck(gi(s, i), gi(s + 1, i), 1.0)       # arch lip
    for s in (1, S - 2):
        for i in range(N):
            mb.ck(gi(s, i), gi(s, (i + 1) % N), 1.0)      # blunt nose / tail
    return mb.build('Body', coll, subsurf=2, parent=root)


# ------------------------------------------------------------------ greenhouse
GH = [(0.62, 0.99, 0.0), (0.46, 1.13, 0.0), (0.30, 1.26, 0.0), (0.15, 1.33, 0.0), (-0.10, 1.345, 0.0),
      (-0.38, 1.345, 0.0), (-0.70, 1.335, 0.0), (-0.98, 1.21, 0.12), (-1.22, 1.09, 0.20), (-1.44, 0.997, 0.26)]
GH_ZB = 0.93                                        # window sills run straight, sunk into the body


def gh_ring(x, zt, sail):
    zb = GH_ZB if x < 0.5 else pl(ZB_TAB, x) - 0.03
    h = zt - zb
    Wg = pl(W_TAB, x) - 0.035                       # glass nearly flush with the doors
    Wt = Wg - 0.045                                 # tumblehome up to the roof edge
    mid = (Wg - 0.01, zb + 0.45 * h) if sail == 0 else (Wg - 0.45 * (Wg - Wt), zb + 0.45 * h)   # sail panels are flat
    pts = [(0.0, zb), (Wg, zb), mid, (Wt, zt - min(0.04, 0.4 * h)),
           (Wt - 0.04 - sail, zt), (0.0, zt + 0.004)]     # sail: rear window narrower than the roof
    return [V((x, y, z)) for y, z in pts] + [V((x, -y, z)) for y, z in reversed(pts[1:-1])]


def build_glass(coll, body):
    mb = MB()
    rings = [gh_ring(*g) for g in GH]

    def gmat(s, k):
        seg = k if k < 5 else 9 - k
        if seg == 0:
            return I_DARK
        if s <= 2:
            return I_GLASS                                  # windshield wraps round
        if s <= 6:
            return I_GLASS if seg <= 2 else I_VINYL         # door / quarter glass, vinyl roof
        return I_GLASS if seg == 4 else I_VINYL             # rear window between vinyl sail panels
    off, st = loft(mb, rings, gmat, fix='ref', ref=lambda c: V((c.x, 0, 0.98)))
    N, S = 10, len(rings)

    def gi(s, i):
        return off + st[s] + i
    for s in (0, S - 1):
        for i in range(N):
            mb.ck(gi(s, i), gi(s, (i + 1) % N), 1.0)
    for i in range(3, 7):
        mb.ck(gi(3, i), gi(3, i + 1), 0.6)                   # windshield header
        mb.ck(gi(6, i), gi(6, i + 1), 0.6)                   # rear window header
    for s in range(S - 1):
        for i in (3, 7):
            mb.ck(gi(s, i), gi(s + 1, i), 0.9)              # drip rail
        for i in (1, 9):
            mb.ck(gi(s, i), gi(s + 1, i), 0.8)              # belt
    ob = mb.build('Glass', coll, subsurf=2, parent=body)
    return ob, rings


# ------------------------------------------------------------------ chrome and details
def build_bumpers(coll, body):
    mb = MB()
    prof = [(-0.03, -0.075), (0.03, -0.06), (0.045, 0.0), (0.03, 0.06), (-0.03, 0.075), (-0.045, 0.0)]
    front = [(2.10, 0.95), (2.24, 0.96), (2.33, 0.92), (2.375, 0.80), (2.40, 0.45), (2.43, 0.0),
             (2.40, -0.45), (2.375, -0.80), (2.33, -0.92), (2.24, -0.96), (2.10, -0.95)]
    sweep(mb, front, 0.44, prof, I_CHROME)
    prof_r = [(d, h * 1.6) for d, h in prof]
    rear = [(-2.38, -0.95), (-2.52, -0.96), (-2.61, -0.92), (-2.66, -0.80), (-2.67, -0.45), (-2.672, 0.0),
            (-2.67, 0.45), (-2.66, 0.80), (-2.61, 0.92), (-2.52, 0.96), (-2.38, 0.95)]
    sweep(mb, rear, 0.50, prof_r, I_CHROME)
    return mb.build('Bumpers', coll, subsurf=1, parent=body)


def text_mesh(mb, text, size, matrix, mat, shear=0.0):
    """Blender text → mesh faces appended to mb, placed by the given world matrix"""
    cu = bpy.data.curves.new('badge', 'FONT')
    cu.body, cu.size, cu.extrude, cu.shear = text, size, 0.003, shear
    cu.align_x, cu.resolution_u = 'CENTER', 3
    ob = bpy.data.objects.new('badge', cu)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.update()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    me.transform(matrix)
    verts = [v.co.copy() for v in me.vertices]
    faces = [tuple(p.vertices) for p in me.polygons]
    mb.add(verts, faces, mat)
    bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.meshes.remove(me)
    bpy.data.curves.remove(cu)


def build_trim(coll, body, gh_rings):
    mb = MB()
    from mathutils import Matrix
    R = lambda deg, axis: Matrix.Rotation(radians(deg), 4, axis)
    for sgn in (1, -1):                                                # "Skylark" script on the quarter panels
        rot = R(-90, 'X') @ R(180, 'Z') if sgn > 0 else R(90, 'X')
        text_mesh(mb, 'Skylark', 0.075, Matrix.Translation((-2.0, sgn * (pl(W_TAB, -2.0) - 0.002), 0.70)) @ rot, I_CHROME, shear=0.35)
    text_mesh(mb, 'BUICK', 0.04, Matrix.Translation((-2.736, 0, 0.505)) @ R(-90, 'Y') @ R(-90, 'Z'), I_DARK)
    up = V((0, 0, 0.035))
    for i in (3, 7):                                                   # A-pillar + drip rail
        tube(mb, [gh_rings[s][i] for s in range(10)], 0.012, I_CHROME)
    tube(mb, [gh_rings[3][i] for i in range(3, 8)], 0.012, I_CHROME)   # windshield header
    tube(mb, [gh_rings[0][i] + up for i in range(2, 9)], 0.012, I_CHROME)   # windshield base
    tube(mb, [gh_rings[9][i] + up for i in range(2, 9)], 0.012, I_CHROME)   # rear window base
    for i in (1, 9):                                                   # window sills
        tube(mb, [gh_rings[s][i] + up for s in range(0, 8)], 0.010, I_CHROME)
    for sgn in (1, -1):                                                # rocker mouldings
        pts = [(x, sgn * (pl(W_TAB, x) - 0.10), 0.35) for x in [-0.95, -0.6, -0.2, 0.2, 0.6, 0.95]]
        tube(mb, pts, 0.012, I_CHROME, n=3)                                                   # rocker moulding between the arches
        box(mb, (-0.30, sgn * (pl(W_TAB, -0.3) + 0.004), 0.86), (0.17, 0.025, 0.03), I_CHROME)   # door handle
        cyl(mb, (-2.60, sgn * 0.42, 0.27), 'x', 0.03, 0.16, I_CHROME, 12)                      # exhaust tip
    box(mb, (2.395 + nose_dx(X_NOSE, 0.405, 0.78), 0, 0.775), (0.015, 1.64, 0.03), I_CHROME)   # strip under the hood lip
    tube(mb, [(0.47, 0.92, 0.975), (0.46, 0.97, 1.0), (0.45, 1.0, 1.03)], 0.011, I_CHROME, n=3)   # mirror stalk
    lathe(mb, [(0.0, 0.05), (0.045, 0.04), (0.058, 0.0), (0.05, -0.035), (0.0, -0.04)], I_CHROME, segs=16, axis='x', at=(0.45, 1.0, 1.05))  # mirror head
    lathe(mb, [(0.0, -0.041), (0.044, -0.041)], I_DARK, segs=16, axis='x', at=(0.45, 1.0, 1.05), fix='ref', ref=lambda c: V((0.5, 1.0, 1.05)))  # mirror glass
    box(mb, (-2.724, 0, 0.52), (0.02, 0.40, 0.06), I_CHROME)          # rear centre plate
    return mb.build('Trim', coll, sharp_deg=40, parent=body)


def build_details(coll, body):
    mb = MB()
    # hood centre panel follows the hood surface
    rings = []
    for x in [0.75, 1.0, 1.3, 1.6, 1.9, 2.15, 2.30, 2.40]:
        z = pl(ZB_TAB, x) + pl(DTOP_TAB, x)
        w = 0.27 * min(1.0, (2.46 - x) / 0.3)                      # panel tapers into the prow
        hgt = 0.014 * min(1.0, (2.46 - x) / 0.3)
        x = x + nose_dx(min(x, X_NOSE), 0.0, z)
        rings.append([V((x, -w, z - 0.012)), V((x, w, z - 0.012)), V((x, w * 0.9, z + hgt)), V((x, -w * 0.9, z + hgt))])
    loft(mb, rings, I_PAINT, cap_start=I_PAINT, cap_end=I_PAINT)
    # face: grille between the inner headlamps
    box(mb, (2.33, 0, 0.30), (0.08, 1.74, 0.11), I_DARK)              # valance under the front bumper
    box(mb, (-2.61, 0, 0.30), (0.08, 1.74, 0.11), I_DARK)             # and under the rear one
    # fascia: a flat raked panel in front of the shell cap; the grille and lamps sit on it
    TILT = atan2(RAKE, 0.35)
    fx = X_NOSE + 0.01 + RAKE * (0.65 - 0.55) / 0.35

    def fz(z):                                                         # fascia x at height z
        return fx + (z - 0.65) * tan(TILT)
    box(mb, (fx - 0.01, 0, 0.65), (0.02, 1.70, 0.28), I_PAINT, rot_y=TILT)
    gx = fz(0.655) + 0.012
    for sgn in (1, -1):
        box(mb, (gx, sgn * 0.245, 0.655), (0.02, 0.49, 0.24), I_CHROME, rot_y=TILT)
        box(mb, (gx + 0.006, sgn * 0.245, 0.655), (0.02, 0.45, 0.20), I_GRILLE, rot_y=TILT)
        for dz in (-0.06, -0.02, 0.02, 0.06):
            box(mb, (fz(0.655 + dz) + 0.03, sgn * 0.245, 0.655 + dz), (0.012, 0.45, 0.008), I_CHROME, rot_y=TILT)
        for k in range(5):
            yy = sgn * (0.05 + k * 0.1)
            box(mb, (gx + 0.018, yy, 0.655), (0.012, 0.008, 0.20), I_CHROME, rot_y=TILT)
        for y in (0.575, 0.74):
            lx = fz(0.66)
            cyl(mb, (lx + 0.005, sgn * y, 0.66), 'x', 0.082, 0.05, I_CHROME, 20)   # bezel
            cyl(mb, (lx + 0.028, sgn * y, 0.66), 'x', 0.068, 0.028, I_HEAD, 20)   # sealed beam
        box(mb, (2.44, sgn * 0.62, 0.44), (0.02, 0.18, 0.06), I_WHITE)         # parking lamp in bumper
        box(mb, (2.02, sgn * pl(W_TAB, 2.02), 0.72), (0.14, 0.02, 0.06), I_AMBER)   # side marker
        box(mb, (-2.45, sgn * pl(W_TAB, -2.45), 0.60), (0.12, 0.02, 0.06), I_TAIL)
        box(mb, (-2.722, sgn * 0.56, 0.52), (0.015, 0.64, 0.12), I_CHROME)    # tail lamp frame
        box(mb, (-2.728, sgn * 0.56, 0.52), (0.015, 0.62, 0.10), I_TAIL)      # tail lamp strip in the bumper
        box(mb, (-2.734, sgn * 0.30, 0.52), (0.012, 0.07, 0.07), I_WHITE)     # reverse lamp
    box(mb, (-2.722, 0, 0.405), (0.015, 0.30, 0.15), I_PLATE)                 # licence plate
    return mb.build('Details', coll, sharp_deg=40, parent=body)


# ------------------------------------------------------------------ wheels: Buick Rally
def build_wheel(name, coll, root, pos, side, tw):
    mb = MB()
    side = side * tw / 0.215                        # scale every lateral offset to the tyre width
    tire = [(0.19, -0.095), (0.30, -0.105), (0.335, -0.098), (0.343, -0.07),
            (0.343, 0.07), (0.335, 0.098), (0.30, 0.105), (0.19, 0.095)]
    lathe(mb, tire, I_RUBBER, side, 28, loop=True)
    rim = [(0.185, -0.09), (0.185, 0.085), (0.178, 0.100), (0.165, 0.092), (0.16, 0.055), (0.15, 0.046)]
    lathe(mb, rim, I_CHROME, side, 28, fix='ref', ref=lambda c: V((0, 0, 0)))
    pocket = [(0.16, 0.046), (0.10, 0.034), (0.0, 0.03)]
    lathe(mb, pocket, I_DARK, side, 28, fix='ref', ref=lambda c: V((0, 0, 0)))
    for k in range(5):
        spoke(mb, pi / 2 + k * 2 * pi / 5, 0.045, 0.165, 0.012, 0.05, 0.034, 0.066, I_CHROME, side)
    ring = [(0.172 + 0.008 * cos(b), 0.100 + 0.008 * sin(b)) for b in angles(8)]
    lathe(mb, ring, I_CHROME, side, 28, loop=True)                    # trim ring
    cap = [(0.0, 0.06), (0.046, 0.062), (0.048, 0.084), (0.03, 0.09), (0.0, 0.092)]
    lathe(mb, cap, I_CHROME, side, 16)
    for k, mat in enumerate((I_RED, I_WHITE, I_BLUE)):               # tri-shield
        spoke(mb, radians(45), (k - 1) * 0.013 - 0.005, (k - 1) * 0.013 + 0.005, 0.009, 0.009, 0.088, 0.097, mat, side)
    for a0 in (radians(25), radians(205)):                            # raised white letters
        sector(mb, 0.262, 0.292, a0, a0 + radians(80), 0.108, I_LETTERS, side)
    return mb.build(name, coll, sharp_deg=40, parent=root, loc=pos)


# ------------------------------------------------------------------ scene
def reset_scene():
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for coll in list(bpy.data.collections):
        bpy.data.collections.remove(coll)
    for data in (bpy.data.meshes, bpy.data.materials, bpy.data.curves):
        for d in list(data):
            if d.users == 0:
                data.remove(d)


def build():
    reset_scene()
    for n, c, r, m, e, es in MAT_DEFS:
        material(n, c, r, m, e, es)
    coll = bpy.data.collections.new('Skylark')
    bpy.context.scene.collection.children.link(coll)
    root = bpy.data.objects.new('Skylark', None)
    coll.objects.link(root)

    body = build_body(coll, root)
    glass, gh_rings = build_glass(coll, body)
    build_bumpers(coll, body)
    build_trim(coll, body, gh_rings)
    build_details(coll, body)
    for name, x, y, side, tw in (('Wheel_FL', AX_F, HALF_TRACK_F, 1, TIRE_W_F), ('Wheel_FR', AX_F, -HALF_TRACK_F, -1, TIRE_W_F),
                                 ('Wheel_RL', AX_R, HALF_TRACK_R, 1, TIRE_W_R), ('Wheel_RR', AX_R, -HALF_TRACK_R, -1, TIRE_W_R)):
        build_wheel(name, coll, root, (x, y, WHEEL_Z), side, tw)

    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    total = 0
    for ob in coll.objects:
        if ob.type != 'MESH':
            continue
        ev = ob.evaluated_get(dg)
        me = ev.to_mesh()
        tris = sum(len(p.vertices) - 2 for p in me.polygons)
        ev.to_mesh_clear()
        total += tris
        print(f'{ob.name:10s} {tris:6d} tris')
    print(f'{"total":10s} {total:6d} tris')

    if DO_SAVE:
        os.makedirs(os.path.dirname(OUT_BLEND), exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
        print('saved', OUT_BLEND)
    if DO_EXPORT:
        os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
        bpy.ops.export_scene.gltf(filepath=OUT_GLB, export_format='GLB', export_apply=True)
        print('exported', OUT_GLB)


build()
