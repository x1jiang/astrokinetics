"""Pack a compact, layered body model for the Crew Body Map from the Human Atlas geometry.

Source: github.com/ashemag/human-atlas (code MIT), geometry BodyParts3D 4.0 (CC BY 4.0, DBCLS).
Each output layer is one buffer: uint16 xyz+pad positions (normalised to the body bounds),
int8 xyz+pad normals, uint32 indices. Files are gzip-compressed and inflated in the browser.
"""
import gzip, json, sys
from pathlib import Path
import numpy as np

src = Path(sys.argv[1]); out = Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
atlas = json.loads((src / "atlas.json").read_text())
chunks = [gzip.decompress((src / "models" / f"body-{i}.bin.gz").read_bytes()) for i in range(len(atlas["chunks"]))]
for i, c in enumerate(chunks):
    assert len(c) == atlas["chunks"][i]["bytes"], i

LAYERS = {
    "skin": lambda p: p["system"] == "integumentary" and p["name"] == "Skin",
    "bone": lambda p: p["system"] == "skeletal",
    # the source files a few brain ventricles under "cardiac"; keep only what sits in the chest
    "heart": lambda p: p["system"] == "cardiac" and (p["bounds"][0][1] + p["bounds"][1][1]) / 2 < 1.45,
    "vessels": lambda p: p["system"] == "arterial",
    "muscle": lambda p: p["system"] == "muscular",
}
lo = np.array([min(p["bounds"][0][i] for p in atlas["parts"]) for i in range(3)], dtype=np.float64)
hi = np.array([max(p["bounds"][1][i] for p in atlas["parts"]) for i in range(3)], dtype=np.float64)

manifest = {"source": "BodyParts3D 4.0 via Human Atlas", "license": "CC BY 4.0", "min": lo.round(5).tolist(), "max": hi.round(5).tolist(), "layers": {}}
for name, pick in LAYERS.items():
    pos, nor, idx, base = [], [], [], 0
    for p in atlas["parts"]:
        if not pick(p):
            continue
        buf = chunks[p["chunk"]]
        v = np.frombuffer(buf, dtype="<f4", count=p["vertexCount"] * 3, offset=p["positions"]).reshape(-1, 3)
        n = np.frombuffer(buf, dtype="<i2", count=p["vertexCount"] * 3, offset=p["normals"]).reshape(-1, 3)
        ix = np.frombuffer(buf, dtype="<u4", count=p["indexCount"], offset=p["indices"])
        assert ix.max() < p["vertexCount"]
        pos.append(v); nor.append(n); idx.append(ix + base); base += p["vertexCount"]
    v = np.concatenate(pos); n = np.concatenate(nor); ix = np.concatenate(idx).astype("<u4")
    q = np.zeros((len(v), 4), dtype="<u2")
    q[:, :3] = np.clip(np.rint((v - lo) / (hi - lo) * 65535), 0, 65535)
    n8 = np.zeros((len(n), 4), dtype="i1")
    n8[:, :3] = np.clip(np.rint(n.astype(np.float64) / 32767 * 127), -127, 127)
    raw = q.tobytes() + n8.tobytes() + ix.tobytes()
    gz = gzip.compress(raw, compresslevel=9, mtime=0)
    (out / f"{name}.bin.gz").write_bytes(gz)
    manifest["layers"][name] = {"url": f"{name}.bin.gz", "vertices": int(len(v)), "indices": int(len(ix)), "bytes": len(raw), "gzipBytes": len(gz),
                                "center": ((v.min(0) + v.max(0)) / 2).round(4).tolist()}
    print(f"{name:8s} verts={len(v):7d} tris={len(ix)//3:7d} raw={len(raw)/1e6:6.2f} MB gz={len(gz)/1e6:6.2f} MB")

def part(name):
    return next(p for p in atlas["parts"] if p["name"] == name)
def mid(p):
    return [(a + b) / 2 for a, b in zip(*p["bounds"])]

# Viewer-left is the model's -x ("Right ..." in anatomical terms) when the body faces the camera.
r_rad, r_hum = part("Right radius"), part("Right humerus")
l_fem, l_pat = part("Left femur"), part("Left patella")
l_rad = part("Left radius")
l_tib = next(p for p in atlas["parts"] if p["name"] in ("Left tibia",))
heart = [round(c, 4) for c in mid(part("Wall of ventricle"))]
manifest["anchors"] = {
    "sleep": [0.0, part("Frontal bone")["bounds"][1][1] - 0.03, 0.085],
    "hr": [heart[0], heart[1], 0.07],
    "sbp": [mid(r_hum)[0] - 0.045, mid(r_hum)[1], 0.0],
    "spo2": [mid(r_rad)[0] - 0.02, r_rad["bounds"][0][1] + 0.03, 0.02],
    "temp": [mid(r_rad)[0] - 0.02, r_rad["bounds"][0][1] + 0.012, 0.02],
    "tremor": [mid(l_rad)[0] + 0.02, l_rad["bounds"][0][1] - 0.07, 0.03],
    "sym": [mid(l_fem)[0] + 0.05, mid(l_fem)[1], 0.07],
    "rom": [mid(l_pat)[0] + 0.02, mid(l_pat)[1], 0.06],
    "vol": [mid(l_tib)[0] + 0.045, mid(l_tib)[1] + 0.03, -0.03],
}
manifest["anchors"] = {k: [round(c, 4) for c in v] for k, v in manifest["anchors"].items()}
manifest["heartCenter"] = heart
(out / "manifest.json").write_text(json.dumps(manifest, separators=(",", ":")))
print("total gz MB:", round(sum(l["gzipBytes"] for l in manifest["layers"].values()) / 1e6, 2))
print(json.dumps(manifest["anchors"]))
