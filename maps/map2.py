# from .base import MapConfig, Spawn, Obstacle

# MAP2 = MapConfig(
#     name="Warzone Rubble",
#     width=800,
#     height=500,
#     player_spawn=Spawn(x=120, y=250),
#     enemy_spawn=Spawn(x=680, y=250),
#     obstacles=[
#         Obstacle(x=350, y=180, w=80, h=50, type="boulder"),
#         Obstacle(x=320, y=250, w=40, h=30, type="rubble"),
#         Obstacle(x=420, y=280, w=36, h=24, type="rubble"),
#         Obstacle(x=150, y=120, w=70, h=40, type="boulder"),
#         Obstacle(x=180, y=160, w=32, h=20, type="rubble"),
#         Obstacle(x=620, y=320, w=72, h=44, type="boulder"),
#         Obstacle(x=650, y=370, w=36, h=22, type="rubble"),
#         Obstacle(x=550, y=100, w=100, h=30, type="wall_chunk"),
#         Obstacle(x=280, y=400, w=100, h=28, type="wall_chunk"),
#         Obstacle(x=400, y=50, w=40, h=20, type="rubble"),
#         Obstacle(x=300, y=420, w=36, h=18, type="rubble"),
#     ]
# )
from .base import MapConfig, Spawn, Obstacle

MAP2 = MapConfig(
    name="Symmetric Arena",
    width=1200,
    height=1200,
    player_spawn=Spawn(x=100, y=600),
    enemy_spawn=Spawn(x=1100, y=600),
    obstacles=[
        # Central square: center (600,600), size 200x200
        Obstacle(x=500, y=500, w=200, h=200, type="wall_chunk"),
        # Corner square top-left: top-left at (200,200), size 100x100
        Obstacle(x=200, y=200, w=100, h=100, type="boulder"),
        # Corner square bottom-right: top-left at (1000,1000), size 100x100
        Obstacle(x=1000, y=1000, w=100, h=100, type="boulder"),
        # Vertical rectangle left side: center (200,850), corners (150,700)-(250,1000)
        Obstacle(x=150, y=700, w=100, h=300, type="wall_chunk"),
        # Vertical rectangle right side: center (1000,350), corners (950,200)-(1050,500)
        Obstacle(x=950, y=200, w=100, h=300, type="wall_chunk"),
    ],
    max_speed=15.0,
    accel=3,
)