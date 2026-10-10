"""Build the frontend and publish the game to a Hugging Face Docker Space.

Usage:  hf auth login            (once, with a write token)
        python deploy/hf_space.py [--name iron-duel] [--private]
"""
import argparse
import secrets
import shutil
import subprocess
import tempfile
from pathlib import Path

from huggingface_hub import HfApi

ROOT = Path(__file__).resolve().parent.parent
DEPLOY = ROOT / "deploy"
PACKAGES = ["agents", "maps", "rewards", "utils"]
MODULES = ["server.py", "auth.py", "matches.py", "env.py", "observations.py", "physics.py"]

IGNORE = shutil.ignore_patterns("__pycache__", "*.pyc", "*.zip", "*.json", ".DS_Store")


def stage(dest: Path):
    subprocess.run(["npm", "run", "build"], cwd=ROOT / "frontend", check=True)
    for m in MODULES:
        shutil.copy2(ROOT / m, dest / m)
    for p in PACKAGES + ["models"]:
        shutil.copytree(ROOT / p, dest / p, ignore=IGNORE)
    shutil.copytree(ROOT / "frontend" / "dist", dest / "frontend" / "dist")
    shutil.copy2(DEPLOY / "Dockerfile", dest / "Dockerfile")
    shutil.copy2(DEPLOY / "requirements.txt", dest / "requirements.txt")
    shutil.copy2(DEPLOY / "SPACE_README.md", dest / "README.md")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", default="iron-duel")
    ap.add_argument("--private", action="store_true")
    args = ap.parse_args()

    api = HfApi()
    user = api.whoami()["name"]
    repo_id = f"{user}/{args.name}"
    exists = api.repo_exists(repo_id, repo_type="space")
    if not exists:
        api.create_repo(repo_id, repo_type="space", space_sdk="docker", private=args.private)
        # Signing key for login tokens; set once so sessions survive rebuilds.
        api.add_space_secret(repo_id, "TANK_SECRET", secrets.token_hex(32))

    with tempfile.TemporaryDirectory() as tmp:
        stage(Path(tmp))
        api.upload_folder(repo_id=repo_id, repo_type="space", folder_path=tmp,
                          commit_message="Deploy Iron Duel",
                          delete_patterns=["*.py", "agents/**", "maps/**", "rewards/**", "utils/**", "frontend/**"])

    print(f"\nSpace:  https://huggingface.co/spaces/{repo_id}")
    print(f"Play:   https://{user.lower()}-{args.name}.hf.space")


if __name__ == "__main__":
    main()
