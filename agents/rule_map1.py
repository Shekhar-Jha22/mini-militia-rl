# import math
# import numpy as np

# class RuleAgentMap1:
#     def __init__(self, team=0):
#         self.team = team

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

#         self_x, self_y = self_player["x"], self_player["y"]
#         opp_x, opp_y = opp_player["x"], opp_player["y"]

#         dx = opp_x - self_x
#         dy = opp_y - self_y
#         dist = math.hypot(dx, dy) or 1.0
#         angle_to_opp = math.atan2(dy, dx)

#         move_dir = self._get_move_dir(dx, dy, dist)
#         aim_dir = self._get_aim_dir(angle_to_opp)
#         shoot = 1 if dist < 400 and self_player["ammo"] > 0 else 0

#         return np.array([move_dir, aim_dir, shoot], dtype=np.int64)

#     def _get_move_dir(self, dx, dy, dist):
#         if dist > 300:
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
import numpy as np
import math

class ChaserAgent:
    """
    Map1 Agent: Follows opponent and shoots aggressively
    Strategy: Chase down enemy, maintain aim, shoot constantly
    """
    name = "Chaser"
    color = "#ef4444"

    def __init__(self, team=0):
        self.team = team
        self.shoot_cooldown = 0
        print(f"✓ ChaserAgent initialized for team {team}")

    # def get_action(self, obs, env_state):
    #     """
    #     Chase opponent and shoot
    #     """
    #     print(f"DEBUG ChaserAgent: env_state type = {type(env_state)}")
    #     print(f"DEBUG ChaserAgent: env_state keys = {env_state.keys() if isinstance(env_state, dict) else 'NOT A DICT'}")
        
    #     if env_state is None or not self._has_valid_state(env_state):
    #         print(f"DEBUG: State validation FAILED, falling back to random")
    #         return self._random_action()

    #     try:
    #         my_pos = env_state['players'][self.team]
    #         enemy_pos = env_state['players'][1 - self.team]
    #         print(f"DEBUG: Got positions - my: {my_pos}, enemy: {enemy_pos}")
            
    #         # ... rest of code
            
    #         # Calculate direction to enemy
    #         dx = enemy_pos['x'] - my_pos['x']
    #         dy = enemy_pos['y'] - my_pos['y']
    #         distance = math.sqrt(dx**2 + dy**2)
            
    #         if distance < 1:
    #             distance = 1
            
    #         # Normalize direction
    #         dir_x = dx / distance
    #         dir_y = dy / distance
            
    #         # Convert direction to movement action (0-8)
    #         # 0=up, 1=up-right, 2=right, 3=down-right, 4=down, 5=down-left, 6=left, 7=up-left, 8=stay
    #         angle = math.atan2(dir_y, dir_x)
    #         angle_deg = (math.degrees(angle) + 90) % 360
    #         movement = int((angle_deg / 45) % 8)
            
    #         # Aim at enemy
    #         aim_angle = math.atan2(dy, dx)
    #         aim_action = int((aim_angle / (math.pi / 8)) % 16)
            
    #         # Always shoot
    #         shoot = 1
            
    #         return np.array([movement, aim_action, shoot], dtype=np.int64)
            
        # except Exception as e:
        #     print(f"⚠ ChaserAgent error: {e}")
        #     return self._random_action()
    def get_action(self, obs, env_state):
        """
        Chase opponent and shoot
        """
        """
        Chase opponent and shoot
        """
        # print(f"DEBUG: ChaserAgent.get_action called")
        # print(f"DEBUG: env_state is None? {env_state is None}")
        # print(f"DEBUG: env_state type: {type(env_state)}")
        # print(f"DEBUG: env_state keys: {env_state.keys() if isinstance(env_state, dict) else 'N/A'}")
        
        if env_state is None or not self._has_valid_state(env_state):
            # print(f"DEBUG: State validation failed!")
            return self._random_action()


        try:
            my_pos = env_state['players'][self.team]
            enemy_pos = env_state['players'][1 - self.team]
            
            # Calculate direction to enemy
            dx = enemy_pos['x'] - my_pos['x']
            dy = enemy_pos['y'] - my_pos['y']
            distance = math.sqrt(dx**2 + dy**2)
            
            if distance < 1:
                distance = 1
            
            # Normalize direction
            dir_x = dx / distance
            dir_y = dy / distance
            
            # Convert direction to movement action (0-8)
            angle = math.atan2(dir_y, dir_x)
            angle_deg = (math.degrees(angle) + 90) % 360
            movement = int((angle_deg / 45) % 8)
            
            # Aim at enemy
            aim_angle = math.atan2(dy, dx)
            aim_action = int((aim_angle / (math.pi / 8)) % 16)
            
            # Always shoot
            shoot = 1
            
            # print(f"DEBUG ChaserAgent: movement={movement}, aim={aim_action}, shoot={shoot}")
            return np.array([movement, aim_action, shoot], dtype=np.int64)
            
        except Exception as e:
            print(f"❌ ChaserAgent ERROR: {e}")
            import traceback
            traceback.print_exc()
            return self._random_action()
    
    def _has_valid_state(self, env_state):
        """Check if env_state has required fields"""
        # print(f"DEBUG _has_valid_state: checking...")
        # print(f"  env_state is None? {env_state is None}")
        # print(f"  'players' in env_state? {'players' in env_state if isinstance(env_state, dict) else 'NOT A DICT'}")
        
        # if isinstance(env_state, dict) and 'players' in env_state:
        #     print(f"  len(players): {len(env_state['players'])}")
        
        result = (env_state is not None and 
                'players' in env_state and 
                len(env_state['players']) >= 2)
        # print(f"  result: {result}")
        return result

    def _random_action(self):
        """Fallback random action"""
        return np.array([
            np.random.randint(0, 9),
            np.random.randint(0, 16),
            np.random.randint(0, 2),
        ], dtype=np.int64)


class CirclerAgent:
    """
    Map1 Agent: Patrols map in circle pattern
    Strategy: Run around map perimeter, occasionally change direction randomly, shoot rarely
    """
    name = "Circler"
    color = "#3b82f6"

    def __init__(self, team=0):
        self.team = team
        self.step_counter = 0
        self.clockwise = True
        self.direction_change_interval = 300  # Change direction every ~300 steps

    def get_action(self, obs, env_state):
        """
        Chase opponent and shoot
        """
        # print(f"DEBUG: ChaserAgent.get_action called")
        # print(f"DEBUG: env_state is None? {env_state is None}")
        # print(f"DEBUG: env_state type: {type(env_state)}")
        # print(f"DEBUG: env_state keys: {env_state.keys() if isinstance(env_state, dict) else 'N/A'}")
        
        if env_state is None or not self._has_valid_state(env_state):
            # print(f"DEBUG: State validation failed!")
            return self._random_action()


        try:
            my_pos = env_state['players'][self.team]
            enemy_pos = env_state['players'][1 - self.team]
            
            # Get map dimensions from nested arena dict
            map_width = env_state['arena']['w']
            map_height = env_state['arena']['h']
            
            # Define circle patrol points (corners and edges)
            patrol_points = [
                (100, 100),           # top-left
                (map_width - 100, 100),      # top-right
                (map_width - 100, map_height - 100),  # bottom-right
                (100, map_height - 100),     # bottom-left
            ]
            
            # Randomly change direction sometimes
            self.step_counter += 1
            if self.step_counter % self.direction_change_interval == 0:
                if np.random.random() < 0.3:  # 30% chance to flip direction
                    self.clockwise = not self.clockwise
            
            # Determine next patrol point
            patrol_idx = (self.step_counter // 150) % len(patrol_points)
            if not self.clockwise:
                patrol_idx = (len(patrol_points) - 1) - patrol_idx
            
            target_x, target_y = patrol_points[patrol_idx]
            
            # Move towards patrol point
            dx = target_x - my_pos['x']
            dy = target_y - my_pos['y']
            distance = math.sqrt(dx**2 + dy**2)
            
            if distance < 1:
                distance = 1
            
            dir_x = dx / distance
            dir_y = dy / distance
            
            # Convert to movement action
            angle = math.atan2(dir_y, dir_x)
            angle_deg = (math.degrees(angle) + 90) % 360
            movement = int((angle_deg / 45) % 8)
            
            # Aim at enemy but don't shoot often
            enemy_dx = enemy_pos['x'] - my_pos['x']
            enemy_dy = enemy_pos['y'] - my_pos['y']
            aim_angle = math.atan2(enemy_dy, enemy_dx)
            aim_action = int((aim_angle / (math.pi / 8)) % 16)
            
            # Rarely shoot (only 10% of time)
            shoot = 1 if np.random.random() < 0.1 else 0
            
            return np.array([movement, aim_action, shoot], dtype=np.int64)
            
        except Exception as e:
            print(f"⚠ CirclerAgent error: {e}")
            return self._random_action()

    def _has_valid_state(self, env_state):
        """Check if env_state has required fields"""
        valid = (env_state is not None and 
                'players' in env_state and 
                len(env_state['players']) >= 2)
        # print(f"DEBUG _has_valid_state: {valid}")
        if not valid:
            print(f"  env_state is None? {env_state is None}")
            print(f"  'players' in env_state? {'players' in env_state if isinstance(env_state, dict) else 'N/A'}")
            print(f"  len(players) >= 2? {len(env_state.get('players', [])) if isinstance(env_state, dict) else 'N/A'}")
        return valid

    def _random_action(self):
        """Fallback random action"""
        return np.array([
            np.random.randint(0, 9),
            np.random.randint(0, 16),
            np.random.randint(0, 2),
        ], dtype=np.int64)