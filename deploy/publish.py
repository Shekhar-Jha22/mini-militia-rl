"""Stage a slim, torch-free deploy bundle into a git repo and push it (Render deploys from it).

Usage:  python tools/export_policies.py        # after training, refresh models/*.npz
        python deploy/publish.py [--repo ../iron-duel-deploy]
"""
import argparse
import shutil
import subprocess
from pathlib import Path

from hf_space import DEPLOY, stage


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default=str(DEPLOY.parent.parent / "iron-duel-deploy"))
    args = ap.parse_args()
    repo = Path(args.repo).resolve()
    if not (repo / ".git").exists():
        raise SystemExit(f"{repo} is not a git checkout of the deploy repo")
    for item in repo.iterdir():
        if item.name != ".git":
            shutil.rmtree(item) if item.is_dir() else item.unlink()
    stage(repo)
    shutil.copy2(DEPLOY / "render.yaml", repo / "render.yaml")
    (repo / "README.md").write_text("# Iron Duel\n\nDeploy bundle generated from the main project by `deploy/publish.py`.\n")
    subprocess.run(["git", "add", "-A"], cwd=repo, check=True)
    if subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=repo).returncode == 0:
        print("No changes to deploy.")
        return
    subprocess.run(["git", "commit", "-m", "Deploy Iron Duel"], cwd=repo, check=True)
    subprocess.run(["git", "push", "origin", "HEAD"], cwd=repo, check=True)
    print("Pushed. Render redeploys automatically.")


if __name__ == "__main__":
    main()
