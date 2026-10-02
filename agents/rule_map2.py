# import math
# import numpy as np
# from utils import has_line_of_sight

# class RuleAgentMap2:
#     def __init__(self, team=0):
#         self.team = team
#         self.cover_timer = 0

#     def get_action(self, obs, state):
#         if obs is None or state is None:
#             return np.array([0, 2, 0], dtype=np.int64)

#         players = state.get("players", [])
#         if len(players) < 2:
#             return np.array([0, 2, 0])

#         self_player = players[self.team]
#         opp_player = players[1 - self.team]

#         if not self_player["alive"] or not opp_player["alive"]:
#             return np.array([0, 2, 0])

#         obstacles = state.get("obstacles", [])
#         self_x, self_y = self_player["x"], self_player["y"]
#         opp_x, opp_y = opp_player["x"], opp_player["y"]

#         dx = opp_x - self_x
#         dy = opp_y - self_y
#         dist = math.hypot(dx, dy) or 1.0
#         angle_to_opp = math.atan2(dy, dx)

#         has_los = self._check_los(self_x, self_y, opp_x, opp_y, obstacles)

#         move_dir = self._get_move_dir(dx, dy, dist, has_los)
#         aim_dir = self._get_aim_dir(angle_to_opp)
#         shoot = 1 if has_los and dist < 350 and self_player["ammo"] > 0 else 0

#         return np.array([move_dir, aim_dir, shoot], dtype=np.int64)

#     def _check_los(self, x1, y1, x2, y2, obstacles):
#         return has_line_of_sight(x1, y1, x2, y2, obstacles)

#     def _get_move_dir(self, dx, dy, dist, has_los):
#         if not has_los:
#             return 2
#         if dist > 250:
#             if abs(dx) > abs(dy):
#                 return 3 if dx > 0 else 7
#             else:
#                 return 1 if dy < 0 else 5
#         else:
#             if abs(dx) > abs(dy):
#                 return 7 if dx > 0 else 3
#             else:
#                 return 5 if dy < 0 else 1
#         return 0

#     def _get_aim_dir(self, angle):
#         angle = angle % (2 * math.pi)
#         step = (2 * math.pi) / 16
#         return int(round(angle / step)) % 16
# import numpy as np
# import math

# class DefensiveHiderAgent:
#     """
#     Map2 Agent: Shoot then hide behind nearest rubble
#     Strategy: Engage enemy, fire, then retreat to nearest obstacle for cover
#     """
#     name = "Hider"
#     color = "#f59e0b"

#     def __init__(self, team=0):
#         self.team = team
#         self.action_state = "hunt"  # hunt or hide
#         self.hide_timer = 0

#     def get_action(self, obs, env_state):
#         """
#         Shoot, then hide behind rubble
#         """
#         if env_state is None or not self._has_valid_state(env_state):
#             return self._random_action()

#         try:
#             my_pos = env_state['players'][self.team]
#             enemy_pos = env_state['players'][1 - self.team]
#             obstacles = env_state.get('obstacles', [])
            
#             # Check if we have line of sight to enemy
#             has_los = self._check_line_of_sight(my_pos, enemy_pos, obstacles)
            
#             # Calculate direction to enemy
#             dx = enemy_pos['x'] - my_pos['x']
#             dy = enemy_pos['y'] - my_pos['y']
#             distance = math.sqrt(dx**2 + dy**2)
            
#             if distance < 1:
#                 distance = 1
            
#             # If we have LOS, engage
#             if has_los and distance < 400:
#                 self.action_state = "hunt"
#                 self.hide_timer = 0
                
#                 # Aim and shoot at enemy
#                 aim_angle = math.atan2(dy, dx)
#                 aim_action = int(round(aim_angle / (math.pi / 8))) % 16
                
#                 # Move toward enemy slightly
#                 dir_x = dx / distance
#                 dir_y = dy / distance
#                 angle = math.atan2(dir_y, dir_x)
#                 angle_deg = (math.degrees(angle) + 90) % 360
#                 movement = int(round(angle_deg / 45.0)) % 8
                
#                 return np.array([movement, aim_action, 1], dtype=np.int64)
            
#             # No LOS - move to nearest cover
#             else:
#                 self.hide_timer += 1
                
#                 # Find nearest obstacle
#                 nearest_obstacle = None
#                 min_dist = float('inf')
                
#                 for obs in obstacles:
#                     obs_center_x = obs['x'] + obs['w'] / 2
#                     obs_center_y = obs['y'] + obs['h'] / 2
#                     dist = math.sqrt((obs_center_x - my_pos['x'])**2 + 
#                                    (obs_center_y - my_pos['y'])**2)
#                     if dist < min_dist:
#                         min_dist = dist
#                         nearest_obstacle = (obs_center_x, obs_center_y)
                
#                 if nearest_obstacle:
#                     # Move toward nearest cover
#                     cover_dx = nearest_obstacle[0] - my_pos['x']
#                     cover_dy = nearest_obstacle[1] - my_pos['y']
#                     cover_dist = math.sqrt(cover_dx**2 + cover_dy**2)
                    
#                     if cover_dist < 1:
#                         cover_dist = 1
                    
#                     dir_x = cover_dx / cover_dist
#                     dir_y = cover_dy / cover_dist
#                     angle = math.atan2(dir_y, dir_x)
#                     angle_deg = (math.degrees(angle) + 90) % 360
#                     movement = int(round(angle_deg / 45.0)) % 8
#                 else:
#                     movement = np.random.randint(0, 8)
                
#                 # Don't shoot while moving to cover
#                 aim_action = np.random.randint(0, 16)
                
#                 return np.array([movement, aim_action, 0], dtype=np.int64)
                
#         except Exception as e:
#             print(f"❌ DefensiveHiderAgent ERROR: {e}")
#             import traceback
#             traceback.print_exc()
#             return self._random_action()

#     def _check_line_of_sight(self, my_pos, enemy_pos, obstacles):
#         """
#         Check if there's line of sight between player and enemy
#         Simple implementation: check if line segment intersects any obstacle
#         """
#         if not obstacles:
#             return True
        
#         # Simple LOS check: ray casting
#         my_x, my_y = my_pos['x'], my_pos['y']
#         enemy_x, enemy_y = enemy_pos['x'], enemy_pos['y']
        
#         for obs in obstacles:
#             # Check if ray from my_pos to enemy_pos intersects obstacle box
#             obs_x1, obs_y1 = obs['x'], obs['y']
#             obs_x2, obs_y2 = obs['x'] + obs['w'], obs['y'] + obs['h']
            
#             if self._line_intersects_rect(my_x, my_y, enemy_x, enemy_y, 
#                                          obs_x1, obs_y1, obs_x2, obs_y2):
#                 return False
        
#         return True

#     def _line_intersects_rect(self, x1, y1, x2, y2, rx1, ry1, rx2, ry2):
#         """
#         Check if line segment intersects rectangle
#         Uses parametric line and AABB collision
#         """
#         # Expand rect slightly to account for tank size
#         margin = 8
#         rx1 -= margin
#         ry1 -= margin
#         rx2 += margin
#         ry2 += margin
        
#         # Check if either endpoint is inside rect
#         if (rx1 <= x1 <= rx2 and ry1 <= y1 <= ry2) or (rx1 <= x2 <= rx2 and ry1 <= y2 <= ry2):
#             return True
        
#         # Check line intersection with rect edges
#         def ccw(ax, ay, bx, by, cx, cy):
#             return (cy - ay) * (bx - ax) > (by - ay) * (cx - ax)
        
#         def segments_intersect(ax, ay, bx, by, cx, cy, dx, dy):
#             return ccw(ax, ay, cx, cy, dx, dy) != ccw(bx, by, cx, cy, dx, dy) and \
#                    ccw(ax, ay, bx, by, cx, cy) != ccw(ax, ay, bx, by, dx, dy)
        
#         # Check against all 4 edges of rectangle
#         # Top edge
#         if segments_intersect(x1, y1, x2, y2, rx1, ry1, rx2, ry1):
#             return True
#         # Right edge
#         if segments_intersect(x1, y1, x2, y2, rx2, ry1, rx2, ry2):
#             return True
#         # Bottom edge
#         if segments_intersect(x1, y1, x2, y2, rx1, ry2, rx2, ry2):
#             return True
#         # Left edge
#         if segments_intersect(x1, y1, x2, y2, rx1, ry1, rx1, ry2):
#             return True
        
#         return False

#     def _has_valid_state(self, env_state):
#         """Check if env_state has required fields"""
#         return (env_state is not None and 
#                 'players' in env_state and 
#                 len(env_state['players']) >= 2)

#     def _random_action(self):
#         """Fallback random action"""
#         return np.array([
#             np.random.randint(0, 9),
#             np.random.randint(0, 16),
#             np.random.randint(0, 2),
#         ], dtype=np.int64)


# class MobileDefenseAgent:
#     """
#     Map2 Agent: Keeps moving and shoots defensively
#     Strategy: Constant movement, only shoots when has LOS, defensive posture
#     """
#     name = "Mobile"
#     color = "#8b5cf6"

#     def __init__(self, team=0):
#         self.team = team
#         self.step_counter = 0
#         self.movement_pattern = None

#     def get_action(self, obs, env_state):
#         """
#         Keep moving, shoot defensively when has LOS
#         """
#         if env_state is None or not self._has_valid_state(env_state):
#             return self._random_action()

#         try:
#             my_pos = env_state['players'][self.team]
#             enemy_pos = env_state['players'][1 - self.team]
#             obstacles = env_state.get('obstacles', [])
            
#             # Check if we have line of sight to enemy
#             has_los = self._check_line_of_sight(my_pos, enemy_pos, obstacles)
            
#             # Calculate direction to enemy
#             dx = enemy_pos['x'] - my_pos['x']
#             dy = enemy_pos['y'] - my_pos['y']
#             distance = math.sqrt(dx**2 + dy**2)
            
#             if distance < 1:
#                 distance = 1
            
#             self.step_counter += 1
            
#             # Defensive strategy: move away from enemy while strafing
#             # Move perpendicular to enemy direction (strafe)
#             perp_angle = math.atan2(dy, dx) + math.pi / 2
            
#             # Sometimes move away, sometimes move left/right
#             if self.step_counter % 20 < 10:
#                 # Move perpendicular (strafe)
#                 move_angle = perp_angle
#             else:
#                 # Move away
#                 move_angle = math.atan2(dy, dx) + math.pi  # opposite direction
            
#             # Convert angle to movement (0-8)
#             move_angle_deg = (math.degrees(move_angle) + 90) % 360
#             movement = int(round(move_angle_deg / 45)) % 8
            
#             # Only shoot if we have LOS
#             if has_los:
#                 aim_angle = math.atan2(dy, dx)
#                 aim_action = int(round(aim_angle / (math.pi / 8))) % 16
#                 shoot = 1
#             else:
#                 # Random aim while moving
#                 aim_action = np.random.randint(0, 16)
#                 shoot = 0
            
#             return np.array([movement, aim_action, shoot], dtype=np.int64)
                
#         except Exception as e:
#             print(f"❌ MobileDefenseAgent ERROR: {e}")
#             import traceback
#             traceback.print_exc()
#             return self._random_action()

#     def _check_line_of_sight(self, my_pos, enemy_pos, obstacles):
#         """Check if there's line of sight between player and enemy"""
#         if not obstacles:
#             return True
        
#         my_x, my_y = my_pos['x'], my_pos['y']
#         enemy_x, enemy_y = enemy_pos['x'], enemy_pos['y']
        
#         for obs in obstacles:
#             obs_x1, obs_y1 = obs['x'], obs['y']
#             obs_x2, obs_y2 = obs['x'] + obs['w'], obs['y'] + obs['h']
            
#             if self._line_intersects_rect(my_x, my_y, enemy_x, enemy_y, 
#                                          obs_x1, obs_y1, obs_x2, obs_y2):
#                 return False
        
#         return True

#     def _line_intersects_rect(self, x1, y1, x2, y2, rx1, ry1, rx2, ry2):
#         """
#         Check if line segment intersects rectangle
#         Uses parametric line and AABB collision
#         """
#         # Expand rect slightly to account for tank size
#         margin = 8
#         rx1 -= margin
#         ry1 -= margin
#         rx2 += margin
#         ry2 += margin
        
#         # Check if either endpoint is inside rect
#         if (rx1 <= x1 <= rx2 and ry1 <= y1 <= ry2) or (rx1 <= x2 <= rx2 and ry1 <= y2 <= ry2):
#             return True
        
#         # Check line intersection with rect edges
#         def ccw(ax, ay, bx, by, cx, cy):
#             return (cy - ay) * (bx - ax) > (by - ay) * (cx - ax)
        
#         def segments_intersect(ax, ay, bx, by, cx, cy, dx, dy):
#             return ccw(ax, ay, cx, cy, dx, dy) != ccw(bx, by, cx, cy, dx, dy) and \
#                    ccw(ax, ay, bx, by, cx, cy) != ccw(ax, ay, bx, by, dx, dy)
        
#         # Check against all 4 edges of rectangle
#         # Top edge
#         if segments_intersect(x1, y1, x2, y2, rx1, ry1, rx2, ry1):
#             return True
#         # Right edge
#         if segments_intersect(x1, y1, x2, y2, rx2, ry1, rx2, ry2):
#             return True
#         # Bottom edge
#         if segments_intersect(x1, y1, x2, y2, rx1, ry2, rx2, ry2):
#             return True
#         # Left edge
#         if segments_intersect(x1, y1, x2, y2, rx1, ry1, rx1, ry2):
#             return True
        
#         return False

#     def _has_valid_state(self, env_state):
#         """Check if env_state has required fields"""
#         return (env_state is not None and 
#                 'players' in env_state and 
#                 len(env_state['players']) >= 2)

#     def _random_action(self):
#         """Fallback random action"""
#         return np.array([
#             np.random.randint(0, 9),
#             np.random.randint(0, 16),
#             np.random.randint(0, 2),
#         ], dtype=np.int64)

import numpy as np
import math
from utils import has_line_of_sight


# ── shared helpers ──────────────────────────────────────────────────────────

def _angle_to_aim(angle):
    """Convert radian angle to 0-15 aim index."""
    return int(round(angle / (math.pi / 8))) % 16

def _angle_to_move(angle):
    """Convert radian angle to 1-8 movement index (0 = stay)."""
    angle_deg = (math.degrees(angle) + 90) % 360
    return (int(round(angle_deg / 45.0)) % 8) + 1

def _toward(my_pos, target_pos):
    """Return (dx, dy, dist, angle) from my_pos toward target_pos."""
    dx = target_pos['x'] - my_pos['x']
    dy = target_pos['y'] - my_pos['y']
    dist = math.hypot(dx, dy) or 1.0
    angle = math.atan2(dy, dx)
    return dx, dy, dist, angle

def _valid(env_state):
    return (env_state is not None and
            'players' in env_state and
            len(env_state['players']) >= 2)

def _random_action():
    return np.array([
        np.random.randint(0, 9),
        np.random.randint(0, 16),
        np.random.randint(0, 2),
    ], dtype=np.int64)


# ── Stage 1: Stationary ─────────────────────────────────────────────────────
# Never moves. Aims at enemy and shoots if has LOS.
# Teaches the agent: aim at a target and shoot it.

class StationaryAgent:
    name = "Stationary"
    color = "#94a3b8"

    def __init__(self, team=0):
        self.team = team

    def get_action(self, obs, env_state):
        if not _valid(env_state):
            return _random_action()
        try:
            me = env_state['players'][self.team]
            en = env_state['players'][1 - self.team]
            if not me['alive'] or not en['alive']:
                return np.array([0, 0, 0], dtype=np.int64)

            _, _, _, angle = _toward(me, en)
            aim = _angle_to_aim(angle)
            obstacles = env_state.get('obstacles', [])
            los = has_line_of_sight(me['x'], me['y'], en['x'], en['y'], obstacles)
            shoot = 1 if los and me['ammo'] > 0 else 0
            return np.array([0, aim, 0], dtype=np.int64)   # 0 = don't move
        except Exception:
            return _random_action()


# ── Stage 2: SlowWalker ─────────────────────────────────────────────────────
# Walks toward enemy at ~30% speed (moves 1 tick out of every 3).
# Stops to aim and shoot when it has LOS.
# Teaches the agent: hit a slowly approaching target.

class SlowWalkerAgent:
    name = "SlowWalker"
    color = "#64748b"

    def __init__(self, team=0):
        self.team = team
        self.tick = 0

    def get_action(self, obs, env_state):
        if not _valid(env_state):
            return _random_action()
        try:
            me = env_state['players'][self.team]
            en = env_state['players'][1 - self.team]
            if not me['alive'] or not en['alive']:
                return np.array([0, 0, 0], dtype=np.int64)

            self.tick += 1
            obstacles = env_state.get('obstacles', [])
            _, _, _, angle = _toward(me, en)
            aim = _angle_to_aim(angle)
            los = has_line_of_sight(me['x'], me['y'], en['x'], en['y'], obstacles)
            shoot = 1 if los and me['ammo'] > 0 else 0

            # move only every 3rd tick, and only if no LOS (stop to shoot)
            if self.tick % 3 == 0 and not los:
                move = _angle_to_move(angle)
            else:
                move = 0

            return np.array([move, aim, 0], dtype=np.int64)
        except Exception:
            return _random_action()


# ── Stage 3: AggressiveWalker ───────────────────────────────────────────────
# Walks toward enemy at full speed. Shoots whenever it has LOS.
# No cover seeking, no strafing. Pure aggression.
# Teaches the agent: deal with a target that closes distance while shooting.

class AggressiveWalkerAgent:
    name = "AggressiveWalker"
    color = "#f97316"

    def __init__(self, team=0):
        self.team = team

    def get_action(self, obs, env_state):
        if not _valid(env_state):
            return _random_action()
        try:
            me = env_state['players'][self.team]
            en = env_state['players'][1 - self.team]
            if not me['alive'] or not en['alive']:
                return np.array([0, 0, 0], dtype=np.int64)

            obstacles = env_state.get('obstacles', [])
            _, _, dist, angle = _toward(me, en)
            aim = _angle_to_aim(angle)
            los = has_line_of_sight(me['x'], me['y'], en['x'], en['y'], obstacles)
            shoot = 1 if los and me['ammo'] > 0 else 0

            # always walk toward enemy
            move = _angle_to_move(angle) if dist > 60 else 0

            return np.array([move, aim, shoot], dtype=np.int64)
        except Exception:
            return _random_action()


# ── Stage 4: EasyStrafer ────────────────────────────────────────────────────
# Strafes side to side (perpendicular to enemy) but stays in place overall.
# Shoots when it has LOS. Doesn't reposition or seek cover.
# Teaches the agent: lead shots on a laterally moving target.

class EasyStraferAgent:
    name = "EasyStrafer"
    color = "#eab308"

    def __init__(self, team=0):
        self.team = team
        self.tick = 0

    def get_action(self, obs, env_state):
        if not _valid(env_state):
            return _random_action()
        try:
            me = env_state['players'][self.team]
            en = env_state['players'][1 - self.team]
            if not me['alive'] or not en['alive']:
                return np.array([0, 0, 0], dtype=np.int64)

            self.tick += 1
            obstacles = env_state.get('obstacles', [])
            _, _, _, angle = _toward(me, en)
            aim = _angle_to_aim(angle)
            los = has_line_of_sight(me['x'], me['y'], en['x'], en['y'], obstacles)
            shoot = 1 if los and me['ammo'] > 0 else 0

            # alternate strafe direction every 30 ticks
            perp = angle + (math.pi / 2 if (self.tick // 30) % 2 == 0 else -math.pi / 2)
            move = _angle_to_move(perp)

            return np.array([move, aim, shoot], dtype=np.int64)
        except Exception:
            return _random_action()


# ── Stage 5: SimpleHider ────────────────────────────────────────────────────
# Moves toward nearest obstacle when exposed, peeks to shoot when hidden.
# No LOS checking for shooting accuracy — just dumb peek-and-fire.
# Easier than DefensiveHiderAgent (no aim correction, slower decisions).

class SimpleHiderAgent:
    name = "SimpleHider"
    color = "#22c55e"

    def __init__(self, team=0):
        self.team = team
        self.tick = 0

    def get_action(self, obs, env_state):
        if not _valid(env_state):
            return _random_action()
        try:
            me = env_state['players'][self.team]
            en = env_state['players'][1 - self.team]
            obstacles = env_state.get('obstacles', [])
            if not me['alive'] or not en['alive']:
                return np.array([0, 0, 0], dtype=np.int64)

            self.tick += 1
            los = has_line_of_sight(me['x'], me['y'], en['x'], en['y'], obstacles)
            _, _, _, angle_to_en = _toward(me, en)
            aim = _angle_to_aim(angle_to_en)

            if los:
                # exposed — shoot then immediately try to move to cover
                shoot = 1 if me['ammo'] > 0 else 0
                # find nearest obstacle
                best = None
                best_dist = float('inf')
                for obs in obstacles:
                    cx = obs['x'] + obs['w'] / 2
                    cy = obs['y'] + obs['h'] / 2
                    d = math.hypot(cx - me['x'], cy - me['y'])
                    if d < best_dist:
                        best_dist = d
                        best = (cx, cy)
                if best and best_dist > 40:
                    _, _, _, cover_angle = _toward(me, {'x': best[0], 'y': best[1]})
                    move = _angle_to_move(cover_angle)
                else:
                    move = 0
            else:
                # hidden — peek every 40 ticks
                shoot = 0
                if self.tick % 40 < 5:
                    move = _angle_to_move(angle_to_en)   # peek out
                else:
                    move = 0                              # stay in cover

            return np.array([move, aim, shoot], dtype=np.int64)
        except Exception:
            return _random_action()


# ── Stage 6: DefensiveHiderAgent (existing, unchanged) ──────────────────────
# Full hider with accurate LOS, cover-seeking, and proper aim.

class DefensiveHiderAgent:
    name = "Hider"
    color = "#f59e0b"

    def __init__(self, team=0):
        self.team = team
        self.action_state = "hunt"
        self.hide_timer = 0

    def get_action(self, obs, env_state):
        if env_state is None or not _valid(env_state):
            return _random_action()
        try:
            me = env_state['players'][self.team]
            en = env_state['players'][1 - self.team]
            obstacles = env_state.get('obstacles', [])

            los = has_line_of_sight(me['x'], me['y'], en['x'], en['y'], obstacles)
            _, _, dist, angle = _toward(me, en)
            aim = _angle_to_aim(angle)

            if los and dist < 400:
                self.hide_timer = 0
                move_dir = _angle_to_move(angle)
                shoot = 1 if me['ammo'] > 0 else 0
                return np.array([move_dir, aim, shoot], dtype=np.int64)
            else:
                self.hide_timer += 1
                best = None
                best_dist = float('inf')
                for ob in obstacles:
                    cx = ob['x'] + ob['w'] / 2
                    cy = ob['y'] + ob['h'] / 2
                    d = math.hypot(cx - me['x'], cy - me['y'])
                    if d < best_dist:
                        best_dist = d
                        best = (cx, cy)
                if best:
                    _, _, _, cover_angle = _toward(me, {'x': best[0], 'y': best[1]})
                    move = _angle_to_move(cover_angle)
                else:
                    move = np.random.randint(1, 9)
                return np.array([move, aim, 0], dtype=np.int64)
        except Exception as e:
            print(f"❌ DefensiveHiderAgent ERROR: {e}")
            return _random_action()


# ── Stage 7: MobileDefenseAgent (existing, with ammo fix) ───────────────────

class MobileDefenseAgent:
    name = "Mobile"
    color = "#8b5cf6"

    def __init__(self, team=0):
        self.team = team
        self.tick = 0

    def get_action(self, obs, env_state):
        if env_state is None or not _valid(env_state):
            return _random_action()
        try:
            me = env_state['players'][self.team]
            en = env_state['players'][1 - self.team]
            obstacles = env_state.get('obstacles', [])

            self.tick += 1
            los = has_line_of_sight(me['x'], me['y'], en['x'], en['y'], obstacles)
            _, _, _, angle = _toward(me, en)
            aim = _angle_to_aim(angle)

            perp = angle + math.pi / 2
            if self.tick % 20 < 10:
                move_angle = perp
            else:
                move_angle = angle + math.pi
            move = _angle_to_move(move_angle)

            if los and me['ammo'] > 0:
                shoot = 1
            else:
                shoot = 0

            return np.array([move, aim, shoot], dtype=np.int64)
        except Exception as e:
            print(f"❌ MobileDefenseAgent ERROR: {e}")
            return _random_action()