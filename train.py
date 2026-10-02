import argparse
import os
import json
import copy
import numpy as np
import gymnasium as gym
from stable_baselines3 import PPO
from stable_baselines3.common.vec_env import SubprocVecEnv, DummyVecEnv
from stable_baselines3.common.callbacks import BaseCallback
 
from env import MiniMilitiaEnv
from maps import MAPS
from agents import STAGE_NAMES
from agents import (
    PPOAgent, RandomAgent,
    ChaserAgent, CirclerAgent,
    StationaryAgent, SlowWalkerAgent, AggressiveWalkerAgent,
    EasyStraferAgent, SimpleHiderAgent,
    DefensiveHiderAgent, MobileDefenseAgent,
)
from rewards import REWARDS
from observations import to_world_action

 
# ------------------------------------------------------------------ #
# Env wrapper
# ------------------------------------------------------------------ #
class SingleAgentWrapper(gym.Env):
    def __init__(self, map_cfg, opponent, reward_fn=None, max_steps=1200):
        super().__init__()
        self.base_env = MiniMilitiaEnv(map_cfg=map_cfg, reward_fn=reward_fn, max_steps=max_steps)
        self.opponent = opponent
        self.observation_space = self.base_env.observation_space
        self.action_space = self.base_env.action_space
        self._last_state = None
 
    def reset(self, **kwargs):
        obs, info = self.base_env.reset(**kwargs)
        self._last_state = self.base_env.get_full_state()
        return obs, info
 
    def step(self, action):
        opp_action = self.opponent.get_action(
            self.base_env._get_obs(1), self._last_state
        )
        obs, reward, terminated, truncated, info = self.base_env.step([action, opp_action])
        self._last_state = self.base_env.get_full_state()
        return obs, reward, terminated, truncated, info
 
 
# ------------------------------------------------------------------ #
# Self-play opponent that reads the current policy from a shared ref
# ------------------------------------------------------------------ #
class SelfPlayOpponent:
    """Wraps a PPO model and always uses the *latest* one."""
    def __init__(self, team=1):
        self.team = team
        self.model = None          # set externally
        self._deterministic = False
 
    def get_action(self, obs, state=None):
        if self.model is None:
            return np.array([np.random.randint(9), np.random.randint(16), np.random.randint(2)])
        action, _ = self.model.predict(obs, deterministic=self._deterministic)
        return to_world_action(action, self.team)
 
 
# ------------------------------------------------------------------ #
# Callback: curriculum + PBT-style hyperparam mutation
# ------------------------------------------------------------------ #
class CurriculumPBTCallback(BaseCallback):
    """
    Curriculum opponent rotation + PBT-style hyperparameter mutation.
    Saves a checkpoint after every stage and every `pbt_every` steps.
    """
 
    def __init__(
        self,
        curriculum_stages,          # list of (name, steps, opponent_factory)
        n_envs,
        print_freq=10_000,
        save_dir="models",
        map_id="map1",
        variation="v1",
        pbt_every=None,             # mutate hyperparams every N steps (None = off)
        seed=0,
        verbose=0,
        start_stage=0,
        replay_frac=0.3,            # share of envs that keep fighting earlier-stage opponents
    ):
        super().__init__(verbose)
        self.stages = curriculum_stages
        self.n_envs = n_envs
        self.print_freq = print_freq
        self.save_dir = save_dir
        self.map_id = map_id
        self.variation = variation
        self.pbt_every = pbt_every
        self.replay_frac = replay_frac

        self.stage_idx = start_stage
        self.stage_name, self.stage_len, _ = self.stages[start_stage]
        self.stage_start = 0
 
        self.ep_rewards = []
        self.ep_wins = []
        self.ep_buf = np.zeros(n_envs, dtype=np.float64)
        self.last_print = 0
        self.best_wr = 0.0
        self.rng = np.random.default_rng(seed)
 
        # records
        self.history = []
 
    # -------------------------------------------------------------- #
    def _set_opponent_on_all_envs(self, factory):
        """factory is a zero-arg callable that returns a NEW agent per env."""
        # VecEnv.set_attr applies to every sub-env in one call
        self.training_env.set_attr("opponent", None)  # force refresh
        for i in range(self.n_envs):
            agent = factory()
            # We use env_method so the sub-env actually owns its own copy
            self.training_env.env_method("set_opponent", agent, indices=[i])
 
    # -------------------------------------------------------------- #
    def _on_training_start(self):
        self._assign_opponents()

    def _assign_opponents(self):
        """Current-stage opponent on most envs; the rest replay earlier stages
        so skills learned against previous bots aren't overwritten."""
        current = self.stages[self.stage_idx][2]
        previous = [s[2] for s in self.stages[:self.stage_idx]]
        n_replay = int(round(self.n_envs * self.replay_frac)) if previous else 0
        for i in range(self.n_envs):
            if i >= self.n_envs - n_replay:
                spec = previous[self.rng.integers(len(previous))]
            else:
                spec = current
            self.training_env.env_method("set_opponent", self._make_opponent(spec), indices=[i])
 
    def _make_opponent(self, spec):
        """spec can be: an agent instance, a dict {name: agent}, or 'selfplay'."""
        if spec == "selfplay":
            # Don't attach model here — PPO holds SubprocVecEnv with open pipes,
            # which can't be pickled across subprocess boundaries.
            # Workers start with model=None (random actions) and get synced below.
            return SelfPlayOpponent(team=1)
        if isinstance(spec, dict):
            return list(spec.values())[0]
        return copy.deepcopy(spec)
 
    # -------------------------------------------------------------- #
    def _on_step(self):
        # rotation happens once, right when a stage starts
        if self.n_calls == self.stage_start or (
            self.n_calls - self.stage_start == 1 and self.n_calls == 1
        ):
            pass  # handled in _advance_stage / _on_training_start
 
        # ---- episode bookkeeping ---------------------------------- #
        # AFTER (fixed)
        for i, done in enumerate(self.locals["dones"]):
            self.ep_buf[i] += self.locals["rewards"][i]
            if done:
                # info = self.locals["infos"][i]
                # tinfo = info.get("terminal_info", info)
                # won = tinfo.get("p0_alive", False) and not tinfo.get("p1_alive", False)
                # self.ep_wins.append(int(won))
                # self.ep_buf[i] = 0.0
                # AFTER
               
                info = self.locals["infos"][i]
                self.ep_rewards.append(self.ep_buf[i])
                tinfo = info.get("terminal_info", info)   # ← only change
                won = tinfo.get("p0_alive", False) and not tinfo.get("p1_alive", False)
                self.ep_wins.append(int(won))
                self.ep_buf[i] = 0.0
        # ---- self-play: sync opponent from file every ~10k steps ---
        # PPO model can't be pickled (holds SubprocVecEnv pipes), so we
        # save to disk and have workers load from the path string instead.
        if self.stage_name == "selfplay" and self.num_timesteps % 10_000 < self.n_envs:
            sync_path = self._save("_selfplay_tmp") + ".zip"
            for i in range(self.n_envs):
                self.training_env.env_method("sync_selfplay_from_file", sync_path, indices=[i])
 
        # ---- curriculum advance ----------------------------------- #
        if self.num_timesteps - self.stage_start >= self.stage_len:
            self._advance_stage()
 
        # ---- PBT: mutate hyperparams ------------------------------ #
        if self.pbt_every and self.num_timesteps % self.pbt_every < self.n_envs:
            self._pbt_step()
 
        # ---- logging / checkpointing ------------------------------ #
        if self.num_timesteps - self.last_print >= self.print_freq:
            self.last_print = self.num_timesteps
            if len(self.ep_rewards) >= 10:
                avg_r = float(np.mean(self.ep_rewards[-200:]))
                wr = float(np.mean(self.ep_wins[-200:])) * 100
                prog = min(100.0, 100.0 * (self.num_timesteps - self.stage_start)
                           / max(1, self.stage_len))
                print(
                    f"[{self.num_timesteps:>9,}] "
                    f"stage={self.stage_name:<10} ({prog:5.1f}%) | "
                    f"AvgR={avg_r:8.2f} | Win%={wr:5.1f}"
                )
                self.history.append({
                    "t": int(self.num_timesteps),
                    "stage": self.stage_name,
                    "avg_r": avg_r, "win": wr,
                })
                if wr > self.best_wr:
                    self.best_wr = wr
                    self._save("best")
        return True
    # -------------------------------------------------------------- #
    def _advance_stage(self):
        self._save(f"stage_{self.stage_idx}_final")
        print(f"\n✓ stage {self.stage_idx} ({self.stage_name}) done @ "
              f"{self.num_timesteps:,} steps  →  saved stage_{self.stage_idx}_final.zip\n")
 
        if self.stage_idx + 1 >= len(self.stages):
            print("✓ All curriculum stages complete.")
            self.stage_len = float("inf")   # don't re-trigger for the rest of the rollout
            return
 
        self.stage_idx += 1
        self.stage_name, self.stage_len, spec = self.stages[self.stage_idx]
        self.stage_start = self.num_timesteps
        print(f"→ Entering stage {self.stage_idx}: {self.stage_name}")
        self._assign_opponents()
 
    # -------------------------------------------------------------- #
    def _pbt_step(self):
        """
        Very lightweight PBT:
        - look at win rate over last ~200 eps
        - if it improved, keep going
        - if it dropped, roll hyperparams back to last-known-good + jitter
        """
        if len(self.ep_wins) < 500:
            return
        wr = float(np.mean(self.ep_wins[-200:])) * 100
 
        # Only mutate occasionally to avoid thrash
        if self.rng.random() < 0.5:
            return
 
        lr = float(self.model.learning_rate) if not callable(self.model.learning_rate) else self.model.learning_rate(1.0)
        new_lr = float(np.clip(lr * self.rng.uniform(0.7, 1.4), 1e-5, 1e-3))
        new_clip = float(np.clip(
            self.model.clip_range(1.0) * self.rng.uniform(0.85, 1.15),
            0.05, 0.4,
        ))
        new_ent = float(np.clip(
            self.model.ent_coef * self.rng.uniform(0.7, 1.4),
            1e-4, 5e-2,
        ))
 
        self.model.learning_rate = new_lr
        self.model.clip_range = lambda _: new_clip   # SB3 expects callable in newer versions
        # self.model.clip_range = new_clip
        self.model.ent_coef = new_ent
 
        print(f"  [PBT] wr={wr:5.1f}  lr→{new_lr:.2e}  clip→{new_clip:.3f}  ent→{new_ent:.4f}")
 
    # -------------------------------------------------------------- #
    def _save(self, tag):
        d = os.path.join(self.save_dir, self.map_id)
        os.makedirs(d, exist_ok=True)
        p = os.path.join(d, f"{self.variation}_{tag}")
        self.model.save(p)
        return p
 
 
# ------------------------------------------------------------------ #
# Patch: make sure SingleAgentWrapper exposes set_opponent / sync_selfplay
# ------------------------------------------------------------------ #
def _saw_set_opponent(self, agent):
    self.opponent = agent
 
def _saw_sync_selfplay(self, model):
    if isinstance(self.opponent, SelfPlayOpponent):
        self.opponent.model = model

def _saw_sync_selfplay_from_file(self, model_path):
    if isinstance(self.opponent, SelfPlayOpponent):
        try:
            self.opponent.model = PPO.load(model_path)
        except Exception:
            pass  # keep previous model if load fails

SingleAgentWrapper.set_opponent = _saw_set_opponent
SingleAgentWrapper.sync_selfplay = _saw_sync_selfplay
SingleAgentWrapper.sync_selfplay_from_file = _saw_sync_selfplay_from_file
 
 
# ------------------------------------------------------------------ #
# Trainer
# ------------------------------------------------------------------ #
class CurriculumTrainer:
    def __init__(self, map_id="map1", save_dir="models", variation="v1",
                 n_envs=16, seed=0):
        self.map_id = map_id
        self.save_dir = save_dir
        self.variation = variation
        self.n_envs = n_envs
        self.seed = seed
        self.map_cfg = MAPS[map_id]
        self.reward_cls = REWARDS[map_id]
        self.stages = self._stages(variation)
        assert [n for n, _, _ in self.stages] == STAGE_NAMES[map_id], "update agents.STAGE_NAMES"
 
    # -------------------------------------------------------------- #
    def _stages(self, variation):
        # NOTE: timestep budget for each stage is set in train() via `total_steps`
        # Here we just return specs.
        if self.map_id == "map1":
            return [
                ("random",   None, RandomAgent(team=1)),
                ("chaser",   None, {"chaser": ChaserAgent(team=1)}),
                ("circler",  None, {"circler": CirclerAgent(team=1)}),
                ("selfplay", None, "selfplay"),
            ]
        else:
            return [
                ("random",      None, RandomAgent(team=1)),
                ("stationary",  None, {"stationary":  StationaryAgent(team=1)}),
                ("walker",      None, {"walker":       SlowWalkerAgent(team=1)}),
                ("aggwalker",   None, {"aggwalker":    AggressiveWalkerAgent(team=1)}),
                ("strafer",     None, {"strafer":      EasyStraferAgent(team=1)}),
                ("simplehider", None, {"simplehider":  SimpleHiderAgent(team=1)}),
                ("hider",       None, {"hider":        DefensiveHiderAgent(team=1)}),
                ("mobile",      None, {"mobile":       MobileDefenseAgent(team=1)}),
                ("selfplay",    None, "selfplay"),
            ]
 
    def _budget(self, total_steps):
        """Split total_steps across stages."""
        if self.map_id == "map1":
            if self.variation == "v1":
                pcts = [0.02, 0.10, 0.35, 0.53]
            else:
                pcts = [0.02, 0.20, 0.30, 0.48]
        else:
            # map2: 9 stages
            # random/stationary/walker/aggwalker/strafer/simplehider/hider/mobile/selfplay
            if self.variation == "v1":
                pcts = [0.0, 0.02, 0.02, 0.05, 0.10, 0.10, 0.20, 0.18, 0.33]
            else:
                pcts = [0.01, 0.03, 0.05, 0.06, 0.07, 0.08, 0.10, 0.10, 0.10]
        budgets = [int(total_steps * p) for p in pcts]
        # fix rounding
        budgets[-1] += total_steps - sum(budgets)
        return [
            (name, budgets[i], spec)
            for i, (name, _, spec) in enumerate(self.stages)
        ]
 
    # -------------------------------------------------------------- #
    def train(self, timesteps=150_000, warm_start_path=None, start_stage=0, pbt=False, **ppo_kwargs):
        os.makedirs(f"{self.save_dir}/{self.map_id}", exist_ok=True)
 
        stages = self._budget(timesteps)
        learn_steps = sum(n for _, n, _ in stages[start_stage:])

        # ---- model kwargs ------------------------------------------ #
        default_kwargs = dict(
            learning_rate=3e-4,
            n_steps=1024,
            batch_size=1024,
            n_epochs=10,
            gamma=0.995,
            gae_lambda=0.95,
            clip_range=0.2,
            ent_coef=0.01,
            target_kl=0.03,
            policy_kwargs=dict(net_arch=dict(pi=[256, 256], vf=[256, 256])),
            verbose=0,
            seed=self.seed,
            device="cpu",          # small MLP: CPU beats MPS/CUDA transfer overhead
        )
        default_kwargs.update(ppo_kwargs)
        gamma = default_kwargs["gamma"]

        # ---- env: one SubprocVecEnv with N workers ----------------- #
        def make_env(rank):
            def _f():
                opp = self._make_opp_for_worker(stages[0][2])
                reward_fn = self.reward_cls(gamma=gamma)   # PBRS γ must equal PPO γ
                return SingleAgentWrapper(self.map_cfg, opp, reward_fn=reward_fn, max_steps=1200)
            return _f

        env = SubprocVecEnv([make_env(i) for i in range(self.n_envs)],
                            start_method="spawn")
 
        if warm_start_path and os.path.exists(f"{warm_start_path}.zip"):
            print(f"✓ warm-start from {warm_start_path}")
            load_kwargs = {k: v for k, v in default_kwargs.items() if k != "policy_kwargs"}
            model = PPO.load(warm_start_path, env=env, **load_kwargs)
        else:
            model = PPO("MlpPolicy", env, **default_kwargs)
 
        # ---- callback --------------------------------------------- #
        cb = CurriculumPBTCallback(
            curriculum_stages=stages,
            n_envs=self.n_envs,
            print_freq=10_000,
            save_dir=self.save_dir,
            map_id=self.map_id,
            variation=self.variation,
            pbt_every=50_000 if pbt else None,
            seed=self.seed,
            start_stage=start_stage,
        )
 
        print(f"\n{'='*70}")
        print(f"Curriculum+PBT training: {self.map_cfg.name} [{self.variation}]")
        print(f"  envs={self.n_envs}  total_steps={timesteps:,}")
        print(f"  stages: " + ", ".join(f"{n}({s:,})" for n, s, _ in stages))
        print(f"{'='*70}\n")
 
        model.learn(total_timesteps=learn_steps, callback=cb, progress_bar=False)
 
        # ---- final save ------------------------------------------- #
        final_path = os.path.join(self.save_dir, self.map_id,
                                  f"final_{self.variation}")
        model.save(final_path)
        print(f"\n✓ done → {final_path}.zip")
 
        with open(os.path.join(self.save_dir, self.map_id,
                               f"metadata_{self.variation}.json"), "w") as f:
            json.dump({
                "map_id": self.map_id,
                "variation": self.variation,
                "total_timesteps": timesteps,
                "n_envs": self.n_envs,
                "warm_start": warm_start_path,
                "stages": [{"name": n, "steps": s} for n, s, _ in stages],
                "history": cb.history,
            }, f, indent=2)
 
        env.close()
        return model, cb
 
    # -------------------------------------------------------------- #
    def _make_opp_for_worker(self, spec):
        if spec == "selfplay":
            return SelfPlayOpponent(team=1)   # model attached later
        if isinstance(spec, dict):
            return copy.deepcopy(list(spec.values())[0])
        return copy.deepcopy(spec)
 
 
# ------------------------------------------------------------------ #
def main():
    p = argparse.ArgumentParser()
    p.add_argument("--map", default="map1", choices=["map1", "map2"])
    p.add_argument("--variation", default="v1", choices=["v1", "v2"])
    p.add_argument("--timesteps", type=int, default=25_000_000)
    p.add_argument("--save_dir", default="models")
    p.add_argument("--warm_start", default=None)
    p.add_argument("--n_envs", type=int, default=8)
    p.add_argument("--seed", type=int, default=0)
    p.add_argument("--start_stage", type=int, default=0)
    p.add_argument("--pbt", action="store_true")
    # PPO hyperparams
    p.add_argument("--lr", type=float, default=3e-4)
    p.add_argument("--n_steps", type=int, default=1024)
    p.add_argument("--batch_size", type=int, default=1024)
    p.add_argument("--n_epochs", type=int, default=10)
    p.add_argument("--gamma", type=float, default=0.995)
    p.add_argument("--gae_lambda", type=float, default=0.95)
    p.add_argument("--clip_range", type=float, default=0.2)
    p.add_argument("--ent_coef", type=float, default=0.01)
    args = p.parse_args()
 
    tr = CurriculumTrainer(
        map_id=args.map,
        save_dir=args.save_dir,
        variation=args.variation,
        n_envs=args.n_envs,
        seed=args.seed,
    )
    tr.train(
        timesteps=args.timesteps,
        warm_start_path=args.warm_start,
        start_stage=args.start_stage,
        pbt=args.pbt,
        learning_rate=args.lr,
        n_steps=args.n_steps,
        batch_size=args.batch_size,
        n_epochs=args.n_epochs,
        gamma=args.gamma,
        gae_lambda=args.gae_lambda,
        clip_range=args.clip_range,
        ent_coef=args.ent_coef,
    )
 
 
if __name__ == "__main__":
    main()