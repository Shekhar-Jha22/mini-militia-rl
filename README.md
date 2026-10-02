
# Mini-Militia RL Agent

A reinforcement learning agent trained to play a 2D top-down shooter from scratch,
using PPO with a 9-stage curriculum. Built with Python, Stable-Baselines3, and a
custom game engine.

## Project Structure

```
├── env.py              # Game environment (Gymnasium)
├── train.py            # PPO training + curriculum + PBT
├── server.py           # Flask backend — serves model inference
├── observations.py     # Observation vector builder
├── physics.py          # Physics engine (movement, bullets, collisions)
├── agents/             # Opponent agents (Stationary, Random, Rule-based, Self-play)
├── maps/               # Map configs — add a new file to add a new map
├── rewards/            # Reward functions per map
├── models/             # Trained weights (already trained, included in the repo)
├── frontend/           # Game visualiser (JS)
└── utils/              # Collision detection, LOS, helpers
```

## Quickstart

**The models are already trained.** Trained weights for both maps ship in `models/` (about 40 MB), so you can play right away. No training is needed.

### Prerequisites

- Python 3.10+ (`python3 --version`)
- Node.js 18+ and npm (`node --version`)
- ~4 GB RAM, and a few GB of disk for PyTorch on the first run
- macOS or Linux (on Windows use WSL or Git Bash)

### 1. Clone

```bash
git clone https://github.com/Shekhar-Jha22/mini-militia-rl.git
cd mini-militia-rl
```

### 2. Run (one command)

```bash
bash run.sh
```

`run.sh` does everything in order:

1. Checks Python, Node and that ports 5000 and 5173 are free.
2. Creates a `.venv` virtual environment and installs the Python dependencies (the first run downloads PyTorch, which takes a few minutes).
3. Runs `npm install` for the frontend.
4. Checks that the trained weights in `models/` are present.
5. Starts the backend at **http://localhost:5000** and the frontend at **http://localhost:5173**, and opens the browser.

Press **Ctrl+C** in that terminal to stop both. Logs are written to `logs/backend.log` and `logs/frontend.log`.

### 3. Play

Open **http://localhost:5173**, pick a map and an opponent, and start the match.

### Run manually (optional)

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python server.py                      # terminal 1: backend on :5000

cd frontend && npm install && npm run dev   # terminal 2: frontend on :5173
```

### Troubleshooting

- **Port already in use**: stop the process using 5000 or 5173 (`lsof -i :5173`), then re-run.
- **Blank page or API errors**: check `logs/backend.log`. The backend must be running on port 5000.
- **Different Python**: `PYTHON=python3.12 bash run.sh`

---

## Training from scratch (optional)

Skip this unless you want to retrain. The models in `models/` are already trained; retraining overwrites them. See `train_guide.md` and `parellel_kaggle_setup.md` for training on Kaggle.

```bash
# Map 1
python train.py --map map1 --total-steps 10000000

# Map 2
python train.py --map map2 --total-steps 20000000
```

Training logs print every 10k steps:

```
[1,000,000] stage=stationary (5.0%) | AvgR= 12.3 | Win%= 34.5
```

Stages advance automatically when Win% > 60% over the last 200 episodes.

## Architecture

- **Environment**: custom Gymnasium env, 52-dim observation vector, MultiDiscrete action space (9 move × 16 aim × 2 shoot)
- **Algorithm**: PPO (Stable-Baselines3), 8 parallel envs via SubprocVecEnv
- **Curriculum**: 9 stages — Stationary → Random → Rule-based → Self-play variants
- **Hyperparameter tuning**: Population Based Training (PBT) on lr, clip range, entropy coef
- **Maps**: entity-component design — each map is a config file + reward file, no core changes needed

## Key design decisions

- Reward shaping: per-tick rewards kept well below `R_KILL/episode_length` to prevent tick-farming
- Survival bleed (`-0.05/tick`) forces engagement
- Double `on_kill` bug fix: kill reward applied only at termination block, not in bullet loop
- `terminal_info` fix for SB3 SubprocVecEnv: win% logging reads `info.get("terminal_info", info)`
