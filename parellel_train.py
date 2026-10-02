import argparse, os, sys
from train import CurriculumTrainer


class KaggleTrainingOrchestrator:
    def __init__(self, save_dir="/kaggle/working/models"):
        self.save_dir = save_dir
        self.jobs = {
            "map1_v1": dict(map_id="map1", variation="v1",
                            timesteps=100_000_000, warm_start=None,
                            description="Map1 v1 (2/40/40/18)"),
            "map1_v2": dict(map_id="map1", variation="v2",
                            timesteps=100_000_000, warm_start=None,
                            description="Map1 v2 (2/30/30/38)"),
            "map2_v1": dict(map_id="map2", variation="v1",
                            timesteps=100_000_000, warm_start=None,
                            description="Map2 v1 (2/40/40/18)"),
            "map2_v2": dict(map_id="map2", variation="v2",
                            timesteps=100_000_000, warm_start=None,
                            description="Map2 v2 (2/30/30/38)"),
        }

    def run_job(self, job_name,n_envs=8 , **kwargs):
        job = self.jobs[job_name]
        print(f"\n{'='*70}\n🎯 JOB: {job_name.upper()}\n{'='*70}")
        print(f"{job['description']}  |  steps={job['timesteps']:,}\n")

        tr = CurriculumTrainer(
            map_id=job["map_id"],
            save_dir=self.save_dir,
            variation=job["variation"],
            n_envs=n_envs,
        )
        ppo_kwargs = dict(
            learning_rate=3e-4,
            n_steps=1024,
            batch_size=512,
            n_epochs=10,
            gamma=0.999,
            gae_lambda=0.95,
            clip_range=0.2,
            ent_coef=0.1,
        )
        ppo_kwargs.update(kwargs)

        try:
            tr.train(timesteps=job["timesteps"],
                     warm_start_path=job["warm_start"],
                     **ppo_kwargs)
            print(f"\n✅ DONE: {job_name}\n")
            return True
        except Exception as e:
            import traceback; traceback.print_exc()
            print(f"\n❌ FAILED: {job_name}: {e}\n")
            return False

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--job", choices=["map1_v1", "map1_v2", "map2_v1", "map2_v2"])
    p.add_argument("--save_dir", default="/kaggle/working/models")
    p.add_argument("--lr", type=float, default=3e-4)
    p.add_argument("--batch_size", type=int, default=512)
    p.add_argument("--n_steps", type=int, default=1024)
    p.add_argument("--n_envs", type=int, default=8)
    p.add_argument("--n_epochs", type=int, default=10)
    p.add_argument("--timesteps", type=int, default=None)   # ADD
    args = p.parse_args()

    orch = KaggleTrainingOrchestrator(save_dir=args.save_dir)
    if not args.job:
        print("Pick one of:", list(orch.jobs.keys()))
        sys.exit(1)

    if args.timesteps is not None:                          # ADD
        orch.jobs[args.job]["timesteps"] = args.timesteps   # ADD

    ok = orch.run_job(
        args.job,
        n_envs=args.n_envs,                                 # ADD
        learning_rate=args.lr,
        batch_size=args.batch_size,
        n_steps=args.n_steps,
        n_epochs=args.n_epochs,
    )
    sys.exit(0 if ok else 1)

if __name__ == "__main__":
    main()