"""Convert trained SB3 PPO checkpoints (models/**/*.zip) to torch-free .npz files.

Run after training:  python tools/export_policies.py
"""
import io
import json
import sys
import zipfile
from pathlib import Path

import numpy as np
import torch

ROOT = Path(__file__).resolve().parent.parent


def export(zip_path: Path):
    with zipfile.ZipFile(zip_path) as z:
        meta = json.loads(z.read("data"))
        sd = torch.load(io.BytesIO(z.read("policy.pth")), map_location="cpu", weights_only=False)
    nvec = meta["action_space"].get("nvec") or meta["action_space"]["_nvec"]
    if isinstance(nvec, str):
        nvec = [int(v) for v in nvec.strip("[]").split()]
    idx = sorted({int(k.split(".")[2]) for k in sd if k.startswith("mlp_extractor.policy_net.") and k.endswith(".weight")})
    arrays = {"n_layers": np.array(len(idx)), "nvec": np.array(nvec, dtype=np.int64)}
    for i, j in enumerate(idx):
        arrays[f"w{i}"] = sd[f"mlp_extractor.policy_net.{j}.weight"].numpy().astype(np.float32)
        arrays[f"b{i}"] = sd[f"mlp_extractor.policy_net.{j}.bias"].numpy().astype(np.float32)
    arrays["wa"] = sd["action_net.weight"].numpy().astype(np.float32)
    arrays["ba"] = sd["action_net.bias"].numpy().astype(np.float32)
    out = zip_path.with_suffix(".npz")
    np.savez_compressed(out, **arrays)
    return out


if __name__ == "__main__":
    paths = [Path(p) for p in sys.argv[1:]] or sorted((ROOT / "models").glob("*/*.zip"))
    for p in paths:
        if "_selfplay_tmp" in p.name:
            continue
        print(f"✓ {export(p).relative_to(ROOT)}")
