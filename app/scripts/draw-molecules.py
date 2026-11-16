# IUPAC_Metro 분자 그림: data/molecules.json → public/molecule/<id>.svg (입체 공-막대 모형: 반사광·그림자·원기둥 막대)
# 실행: pip install rdkit && python scripts/draw-molecules.py [id ...]   (앱 빌드에는 필요 없다. 그림을 다시 만들 때만)
# 3D 구조(ETKDG + MMFF) → 분자를 넓게 펼치는 방향으로 돌리고 살짝 기울임 → 원근 투영 → 먼 것부터 그린다.
import json, math, pathlib, sys
import numpy as np
from rdkit import Chem
from rdkit.Chem import AllChem

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'molecule'
OUT.mkdir(parents=True, exist_ok=True)

# 원소: (공 반지름 Å, 밝은 색, 기본 색, 어두운 색, 글자 색) — CPK 관례 색
ATOM = {
    'C': (0.50, '#8a93a3', '#454c59', '#14171d', '#fff'),
    'H': (0.32, '#ffffff', '#e4e8ee', '#8d96a3', None),
    'O': (0.48, '#ffb3b3', '#e03131', '#7a1414', '#fff'),
    'N': (0.48, '#b4c3ff', '#3b5bdb', '#152a80', '#fff'),
    'Cl': (0.62, '#c8f5cf', '#37b24d', '#1b5e27', '#fff'),
    'Br': (0.66, '#e8a48f', '#a8432a', '#5a1c0e', '#fff'),
}
PX = 52          # 1 Å = 52 px
CAM = 9.0        # 카메라 거리 Å (작을수록 원근이 세다)
TILT_X, TILT_Y = math.radians(30), math.radians(-22)
PAD = 14
BOND_R = 0.13    # 결합 막대 반지름 Å

def coords3d(smiles: str):
    mol = Chem.AddHs(Chem.MolFromSmiles(smiles))
    AllChem.EmbedMolecule(mol, randomSeed=7)
    AllChem.MMFFOptimizeMolecule(mol)
    Chem.Kekulize(mol, clearAromaticFlags=True)  # 벤젠은 단일·이중 번갈아
    p = mol.GetConformer().GetPositions()
    p = p - p.mean(axis=0)
    # 무거운 원자 기준 주축: 가장 긴 방향 → 가로, 다음 → 세로, 가장 얇은 방향 → 깊이
    heavy = np.array([p[a.GetIdx()] for a in mol.GetAtoms() if a.GetSymbol() != 'H'])
    if len(heavy) >= 3:
        _, _, vt = np.linalg.svd(heavy - heavy.mean(axis=0))
        if np.linalg.det(vt) < 0:
            vt[2] *= -1
        p = p @ vt.T
    elif len(heavy) == 2:  # 두 원자: 결합을 가로로
        d = heavy[1] - heavy[0]
        ang = math.atan2(d[1], d[0])
        c, s = math.cos(-ang), math.sin(-ang)
        p = p @ np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]]).T
    else:  # 메테인처럼 중심 원자 하나: 결합 하나를 위로 세우면 사면체가 다 보인다
        v = p[1] - p[0]
        v /= np.linalg.norm(v)
        u = np.array([0.0, 1.0, 0.0])
        ax = np.cross(v, u)
        s, c = np.linalg.norm(ax), float(v @ u)
        if s > 1e-6:
            ax /= s
            K = np.array([[0, -ax[2], ax[1]], [ax[2], 0, -ax[0]], [-ax[1], ax[0], 0]])
            p = (p - p[0]) @ (np.eye(3) + s * K + (1 - c) * K @ K).T
    rx = np.array([[1, 0, 0], [0, math.cos(TILT_X), -math.sin(TILT_X)], [0, math.sin(TILT_X), math.cos(TILT_X)]])
    ry = np.array([[math.cos(TILT_Y), 0, math.sin(TILT_Y)], [0, 1, 0], [-math.sin(TILT_Y), 0, math.cos(TILT_Y)]])
    return mol, p @ (ry @ rx).T


def draw(smiles: str) -> str:
    mol, p = coords3d(smiles)
    sym = [a.GetSymbol() for a in mol.GetAtoms()]
    f = [CAM / (CAM - z) for z in p[:, 2]]  # 원근: 앞(z 큼)일수록 크게
    sx = [p[i, 0] * PX * f[i] for i in range(len(sym))]
    sy = [-p[i, 1] * PX * f[i] for i in range(len(sym))]
    rad = [ATOM[s][0] * PX * f[i] for i, s in enumerate(sym)]
    zmin, zmax = p[:, 2].min(), p[:, 2].max()
    depth = lambda i: 0.0 if zmax - zmin < 0.3 else (p[i, 2] - zmin) / (zmax - zmin)  # 0 = 가장 뒤

    SH = 0.35 * PX  # 그림자를 오른쪽 아래로
    x0 = min(sx[i] - rad[i] for i in range(len(sym))) - PAD
    y0 = min(sy[i] - rad[i] for i in range(len(sym))) - PAD
    x1 = max(sx[i] + rad[i] for i in range(len(sym))) + PAD + SH * .6
    y1 = max(sy[i] + rad[i] for i in range(len(sym))) + PAD + SH

    defs = [f'<filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="{PX * .12:.1f}"/></filter>']
    for s, (_r, hi, base, dark, _t) in ATOM.items():
        if s in sym:  # 구: 왼쪽 위 반사광 → 기본 색 → 가장자리 어둡게
            defs.append(f'<radialGradient id="g{s}" cx="50%" cy="50%" r="50%" fx="33%" fy="28%">'
                        f'<stop offset="0" stop-color="#fff"/><stop offset=".12" stop-color="{hi}"/>'
                        f'<stop offset=".55" stop-color="{base}"/><stop offset=".9" stop-color="{dark}"/><stop offset="1" stop-color="{dark}"/></radialGradient>')
    defs.append('<radialGradient id="rim" cx="50%" cy="50%" r="50%" fx="65%" fy="72%"><stop offset=".7" stop-color="#fff" stop-opacity="0"/>'
                '<stop offset="1" stop-color="#fff" stop-opacity=".28"/></radialGradient>')  # 반대편 반사광

    shadows, items = [], []
    for i in range(len(sym)):
        shadows.append(f'<ellipse cx="{sx[i] + SH * .5:.1f}" cy="{sy[i] + SH:.1f}" rx="{rad[i] * 1.05:.1f}" ry="{rad[i] * .8:.1f}"/>')
    for b in mol.GetBonds():
        i, j = b.GetBeginAtomIdx(), b.GetEndAtomIdx()
        ax, ay, bx, by = sx[i], sy[i], sx[j], sy[j]
        L = math.hypot(bx - ax, by - ay) or 1
        nx, ny = -(by - ay) / L, (bx - ax) / L
        order = int(b.GetBondTypeAsDouble())
        k = (f[i] + f[j]) / 2
        r = BOND_R * PX * k * {1: 1, 2: .72, 3: .6}[order]
        offs = {1: [0], 2: [-1.25, 1.25], 3: [-2.3, 0, 2.3]}[order]
        shade = 0.55 + 0.45 * (depth(i) + depth(j)) / 2
        s = ''
        for n_, o in enumerate(offs):
            o *= r
            cx_, cy_ = (ax + bx) / 2 + nx * o, (ay + by) / 2 + ny * o
            gid = f'b{i}_{j}_{n_}'
            # 원기둥: 막대 폭 방향으로 어두움 → 밝음 → 어두움
            defs.append(f'<linearGradient id="{gid}" gradientUnits="userSpaceOnUse" x1="{cx_ - nx * r:.1f}" y1="{cy_ - ny * r:.1f}" x2="{cx_ + nx * r:.1f}" y2="{cy_ + ny * r:.1f}">'
                        f'<stop offset="0" stop-color="#3a3f48"/><stop offset=".35" stop-color="#e9edf2"/><stop offset=".6" stop-color="#aab1bc"/><stop offset="1" stop-color="#2b2f36"/></linearGradient>')
            s += (f'<line x1="{ax + nx * o:.1f}" y1="{ay + ny * o:.1f}" x2="{bx + nx * o:.1f}" y2="{by + ny * o:.1f}" '
                  f'stroke="url(#{gid})" stroke-width="{2 * r:.1f}"/>')
        items.append(((p[i, 2] + p[j, 2]) / 2 - 0.05, f'<g opacity="{0.6 + 0.4 * shade:.2f}">{s}</g>'))
    for i, s in enumerate(sym):
        _r, _hi, _b, dark, txt = ATOM[s]
        d = depth(i)
        a = (f'<g opacity="{0.78 + 0.22 * d:.2f}"><circle cx="{sx[i]:.1f}" cy="{sy[i]:.1f}" r="{rad[i]:.1f}" fill="url(#g{s})"/>'
             f'<circle cx="{sx[i]:.1f}" cy="{sy[i]:.1f}" r="{rad[i]:.1f}" fill="url(#rim)"/>')
        if txt and s != 'C':  # 탄소·수소는 색으로, 나머지 원소만 글자
            a += (f'<text x="{sx[i]:.1f}" y="{sy[i] + rad[i] * .34:.1f}" text-anchor="middle" font-family="Pretendard,sans-serif" '
                  f'font-weight="800" font-size="{rad[i] * .95:.1f}" fill="{txt}" stroke="{dark}" stroke-width="{rad[i] * .08:.1f}" paint-order="stroke">{s}</text>')
        chg = mol.GetAtomWithIdx(i).GetFormalCharge()
        if chg:
            a += (f'<text x="{sx[i] + rad[i] * .95:.1f}" y="{sy[i] - rad[i] * .6:.1f}" text-anchor="middle" font-family="Pretendard,sans-serif" '
                  f'font-weight="800" font-size="{rad[i] * .8:.1f}" fill="#191c24">{"+" if chg > 0 else "−"}</text>')
        items.append((p[i, 2], a + '</g>'))
    items.sort(key=lambda t: t[0])
    w, h = x1 - x0, y1 - y0
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0:.1f} {y0:.1f} {w:.1f} {h:.1f}" width="{w:.0f}" height="{h:.0f}">'
            f'<defs>{"".join(defs)}</defs><g fill="#1f2430" opacity=".18" filter="url(#sh)">{"".join(shadows)}</g>'
            f'{"".join(t[1] for t in items)}</svg>')


mols = json.loads((ROOT / 'data' / 'molecules.json').read_text(encoding='utf-8'))
only = set(sys.argv[1:])
for m in mols:
    if only and m['id'] not in only:
        continue
    (OUT / f"{m['id']}.svg").write_text(draw(m['smiles']), encoding='utf-8')
print(len(mols), 'molecules')
