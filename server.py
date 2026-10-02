import os
import json
import zipfile
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS

from env import MiniMilitiaEnv
from maps import MAPS
from agents import (
    RandomAgent, 
    PPOAgent,
    ChaserAgent, 
    CirclerAgent,
    DefensiveHiderAgent, 
    StationaryAgent,
    MobileDefenseAgent,
    MAP1_AGENTS,
    MAP2_AGENTS,
    STAGE_NAMES,
)
from stable_baselines3 import PPO as PPOModel
from observations import OBS_DIM
from rewards import REWARDS

app = Flask(__name__)
CORS(app)


class GameSession:
    def __init__(self):
        self.env = None
        self.agents = [None, None]
        self.obs = [None, None]
        self.done = True
        self.match_info = {}

session = GameSession()

AGENT_REGISTRY = {
    "map1": {
        "chaser": ChaserAgent,
        "circler": CirclerAgent,
    },
    "map2": {
        "hider": DefensiveHiderAgent,
        "mobile": MobileDefenseAgent,
    },
}
PPO_VARIATION = os.environ.get("PPO_VARIATION", "v1")
_model_cache = {}


def _effective_name(name, map_id):
    """Name of the agent that will actually play (unknown names fall back to random)."""
    if name in ("human", "ppo", "random") or name in AGENT_REGISTRY.get(map_id, {}):
        return name
    return "random"


def _ppo_checkpoint(map_id, opponent):
    """Stage checkpoint trained against `opponent`; self-play checkpoint for human/ppo/unknown."""
    d, v = f"models/{map_id}", PPO_VARIATION
    stages = STAGE_NAMES[map_id]
    selfplay = [f"{d}/final_{v}.zip", f"{d}/{v}_stage_{len(stages) - 1}_final.zip"]
    cands = []
    # "random" is a ~0-2% warm-up stage, so its checkpoint is undertrained → use self-play
    if opponent in stages and opponent not in ("selfplay", "random"):
        cands.append(f"{d}/{v}_stage_{stages.index(opponent)}_final.zip")
    cands += selfplay + [f"{d}/{v}_best.zip", f"{d}/best.zip", f"{d}/ppo.zip"]
    return next((p for p in cands if os.path.exists(p) and _obs_compatible(p)), None)


def _obs_compatible(path):
    try:
        with zipfile.ZipFile(path) as z:
            shape = json.loads(z.read("data"))["observation_space"]["_shape"]
    except Exception:
        return False
    if list(shape) != [OBS_DIM]:
        print(f"⚠ skipping {path}: obs {shape} ≠ current {OBS_DIM} (retrain)")
        return False
    return True


def _load_ppo(map_id, opponent, team):
    agent = PPOAgent(team=team)
    path = _ppo_checkpoint(map_id, _effective_name(opponent, map_id))
    if path is None:
        print(f"⚠ No PPO checkpoint for {map_id}")
        return agent
    if path not in _model_cache:
        _model_cache[path] = PPOModel.load(path)
    agent.model = _model_cache[path]
    print(f"✓ PPO {map_id} vs {opponent}: {path}")
    return agent


def _make_agent(name, map_id="map1", team=0, opponent=None):
    if name == "random":
        return RandomAgent(team=team)
    if name == "ppo":
        return _load_ppo(map_id, opponent, team)
    agent_cls = AGENT_REGISTRY.get(map_id, {}).get(name, RandomAgent)
    return agent_cls(team=team)

@app.route("/api/agents", methods=["GET"])
def list_agents():
    return jsonify({
        "agents": [
            {"id": "random", "name": "Random", "color": "#ef4444", "ready": True},
            {"id": "rulebased", "name": "Rule-Based", "color": "#f59e0b", "ready": True},
            {"id": "ppo", "name": "PPO Agent", "color": "#22c55e", "ready": True},
        ]
    })

@app.route("/api/maps", methods=["GET"])
def list_maps():
    return jsonify({
        "maps": [
            {"id": m_id, "name": m.name}
            for m_id, m in MAPS.items()
        ]
    })

@app.route("/api/start", methods=["POST"])
def start_game():
    data = request.json or {}
    a0_name = data.get("agent0", "ppo")
    a1_name = data.get("agent1", "rulebased")
    map_id = data.get("map_id", "map1")

    map_cfg = MAPS[map_id]
    reward_cls = REWARDS[map_id]

    session.env = MiniMilitiaEnv(map_cfg=map_cfg, reward_fn=reward_cls())
    obs0, _ = session.env.reset()
    obs1 = session.env._get_obs(1)

    session.agents = [
        _make_agent(a0_name, map_id=map_id, team=0, opponent=a1_name) if a0_name != "human" else None,
        _make_agent(a1_name, map_id=map_id, team=1, opponent=a0_name),
    ]
    session.obs = [obs0, obs1]
    session.done = False
    session.match_info = {"agent0": a0_name, "agent1": a1_name, "winner": None, "steps": 0, "map_id": map_id}

    return jsonify({
        "status": "started",
        "state": session.env.get_full_state(),
        "agents": [a0_name, a1_name],
        "map_id": map_id,
    })

@app.route("/api/step", methods=["POST"])
def step_game():
    if session.done or session.env is None:
        return jsonify({"error": "No active game"}), 400

    data = request.json or {}
    state = session.env.get_full_state()

    actions = []
    for i, agent in enumerate(session.agents):
        if agent is None:
            raw = data.get("human_action", [0, 0, 0])
            actions.append(np.array(raw, dtype=np.int64))
        else:
            # actions.append(agent.get_action(session.obs[i], state))
            # print(f"DEBUG: Calling get_action for agent {i}, state type: {type(state)}")
            try:
                action = agent.get_action(session.obs[i], state)
                # print(f"DEBUG: Got action: {action}")
                actions.append(action)
            except Exception as e:
                print(f"ERROR: Agent {i} failed: {e}")
                actions.append(np.array([0, 0, 0], dtype=np.int64))
                
                
    obs0, reward, terminated, truncated, info = session.env.step(actions)
    session.obs[0] = obs0
    session.obs[1] = session.env._get_obs(1)
    session.done = terminated or truncated

    if session.done:
        session.match_info["winner"] = _match_winner(
            info, session.match_info["agent0"], session.match_info["agent1"])
        session.match_info["steps"] = info["step"]

    return jsonify({
        "state": session.env.get_full_state(),
        "done": session.done,
        "match_info": session.match_info if session.done else None,
        "reward": float(reward),
        "info": info,
    })

def _match_winner(info, a0_name, a1_name):
    """0 / 1 / None (draw). A timeout with both alive counts as a loss for a PPO side."""
    if info["p0_alive"] and not info["p1_alive"]:
        return 0
    if info["p1_alive"] and not info["p0_alive"]:
        return 1
    ppo0, ppo1 = a0_name == "ppo", a1_name == "ppo"
    if ppo0 != ppo1:
        return 1 if ppo0 else 0
    if ppo0 and ppo1:
        return None
    if info["p0_health"] == info["p1_health"]:
        return None
    return 0 if info["p0_health"] > info["p1_health"] else 1

@app.route("/api/benchmark", methods=["POST"])
def benchmark():
    data = request.json or {}
    a0_name = data.get("agent0", "ppo")
    a1_name = data.get("agent1", "rulebased")
    n_episodes = min(int(data.get("episodes", 50)), 200)
    map_id = data.get("map_id", "map1")

    map_cfg = MAPS[map_id]
    reward_cls = REWARDS[map_id]

    results = {"agent0_wins": 0, "agent1_wins": 0, "draws": 0, "avg_steps": 0, "episodes": n_episodes}
    total_steps = 0

    for _ in range(n_episodes):
        env = MiniMilitiaEnv(map_cfg=map_cfg, reward_fn=reward_cls())
        obs0, _ = env.reset()
        obs1 = env._get_obs(1)
        agents = [_make_agent(a0_name, map_id=map_id, team=0, opponent=a1_name),
                  _make_agent(a1_name, map_id=map_id, team=1, opponent=a0_name)]
        done = False

        while not done:
            st = env.get_full_state()
            act0 = agents[0].get_action(obs0, st)
            act1 = agents[1].get_action(obs1, st)
            obs0, _, term, trunc, info = env.step([act0, act1])
            obs1 = env._get_obs(1)
            done = term or trunc

        total_steps += info["step"]
        w = _match_winner(info, a0_name, a1_name)
        results["agent0_wins" if w == 0 else "agent1_wins" if w == 1 else "draws"] += 1

    results["avg_steps"] = round(total_steps / n_episodes, 1)
    results["agent0_winrate"] = round(results["agent0_wins"] / n_episodes * 100, 1)
    results["agent1_winrate"] = round(results["agent1_wins"] / n_episodes * 100, 1)
    results["agent0_name"] = a0_name
    results["agent1_name"] = a1_name
    return jsonify(results)

if __name__ == "__main__":
    print("\n Mini Militia RL — API Server")
    print(" Running on http://localhost:5000\n")
    app.run(host="0.0.0.0", port=5000, debug=False)