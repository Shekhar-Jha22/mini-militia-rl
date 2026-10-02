
# Multi-Agent PPO Training Guide

## Overview

This training setup uses **Population Based Training (PBT)** to train PPO agents against diverse hardcoded opponents and self-play. Each map has its own set of opponents tailored to that map's unique challenges.

---

## Agent Pool by Map

### Map 1: Open Arena

#### Opponents:

1. **Random Agent** - Takes completely random actions

   - Color: Gray (#6b7280)
   - Strategy: Baseline for random behavior
2. **Chaser Agent** - Aggressive pursuer

   - Color: Red (#ef4444)
   - Strategy:
     - Follows opponent directly
     - Always aims at opponent
     - Constantly shoots when moving toward target
     - Good for testing evasion and defense
3. **Circler Agent** - Perimeter patrol

   - Color: Blue (#3b82f6)
   - Strategy:
     - Patrols map in circular pattern (4 corners)
     - Randomly changes direction (30% chance every 300 steps)
     - Rarely shoots (10% of time)
     - Good for testing positioning and hunting skills

#### PPO Agent:

- **Color**: Green (#22c55e)
- **Goal**: Learn to survive against diverse tactics

---

### Map 2: Rubble-Filled Warzone

#### Opponents:

1. **Random Agent** - Takes completely random actions

   - Color: Gray (#6b7280)
   - Strategy: Baseline
2. **Hider Agent** - Defensive with cover-based strategy

   - Color: Amber (#f59e0b)
   - Strategy:
     - Shoots when has line of sight (LOS) to enemy
     - Moves to nearest obstacle for cover
     - Only attacks with clear vision
     - Good for testing LOS awareness and tactical retreat
3. **Mobile Agent** - Constant movement with defensive fire

   - Color: Purple (#8b5cf6)
   - Strategy:
     - Continuously moves and strafes
     - Only shoots when has LOS
     - Uses obstacles as cover while moving
     - Good for testing obstacle navigation and dynamic combat

Both map2 agents respect line-of-sight and won't shoot through walls.

---

## Training Configuration

### Opponent Rotation Schedule:

- **Frequency**: Every 10,000 timesteps
- **60% Hardcoded Agents**: Random + Map-specific agents
- **40% Self-play**: PPO plays against itself

### PPO Hyperparameters (Defaults):

```python
learning_rate=3e-4
n_steps=2048
batch_size=64
n_epochs=10
gamma=0.99
gae_lambda=0.95
clip_range=0.2
```

### Training Duration:

- Default: 150,000 timesteps (~2-3 hours on GPU)
- Each opponent gets ~10,000-15,000 steps before rotation

---

## Usage

### Basic Training on Map1:

```bash
python train_pbt.py --map map1 --timesteps 150000
```

### Training on Map2:

```bash
python train_pbt.py --map map2 --timesteps 200000
```

### Custom Hyperparameters:

```bash
python train_pbt.py --map map1 \
    --lr 5e-4 \
    --n_steps 4096 \
    --batch_size 128 \
    --n_epochs 15 \
    --timesteps 300000
```

### Save Location:

- Best model: `models/{map_id}/best.zip`
- Final model: `models/{map_id}/final.zip`

---

## Training Progress Output

During training, you'll see:

```
[    50000] vs Chaser          | Avg R:   15.23 | Win%:  72.3%
  Opponent Stats:
    Random : 85.0% (17/20)
    Chaser : 68.5% (13/19)
    Circler: 75.2% (16/21)
  ★ Best (75.2%) → models/map1/best.zip
```

This shows:

- Current timestep and opponent
- Average reward and win rate
- Performance breakdown vs each opponent
- When a new best model is saved

---

## Agent Architecture

### PPOAgent

- Loads trained models via `load(path)`
- Falls back to random actions if model not loaded
- Deterministic prediction for evaluation

### Map1 Agents

- **ChaserAgent**: Direct pursuit + constant fire
- **CirclerAgent**: Perimeter patrol + rare shots

### Map2 Agents

- **DefensiveHiderAgent**: LOS-based engagement + cover retreat
- **MobileDefenseAgent**: Strafing movement + defensive LOS fire

All agents use simple but effective LOS checks to prevent shooting through obstacles.

---

## Tips for Training

1. **Start with Map1** (simpler, faster convergence)
2. **Monitor win rates** against each opponent
3. **Early rotations** can help avoid overfitting to one strategy
4. **Longer training** = Better generalization across opponent types
5. **Self-play** kicks in after initial opponent rotations
6. **Save checkpoints** regularly (best model auto-saves)

---

## Evaluation

After training, test your agent:

```python
from ppo_agent import PPOAgent
from env import MiniMilitiaEnv
from maps import MAPS

agent = PPOAgent()
agent.load("models/map1/best")

env = MiniMilitiaEnv(map_cfg=MAPS["map1"])
obs, info = env.reset()

for _ in range(1000):
    action = agent.get_action(obs, env.get_full_state())
    obs, reward, done, truncated, info = env.step([action, random_action])
    if done:
        break
```

---

## Future Improvements

- [ ] Add PBT-based hyperparameter evolution
- [ ] Implement AlphaZero-style self-play ladder
- [ ] Add model checkpointing during training
- [ ] Tournament-style evaluation
- [ ] Curriculum learning (easy → hard opponents)
