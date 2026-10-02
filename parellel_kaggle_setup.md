
# Kaggle Parallel Training Setup (4 Concurrent Jobs)

## Overview

Run all 4 training jobs **simultaneously** on Kaggle using 4 separate kernels:

```
Kernel 1: map1_v1  ─┐
Kernel 2: map1_v2  ├─→ ALL RUN IN PARALLEL (no dependencies!)
Kernel 3: map2_v1  ├─→ Start all 4 at the same time
Kernel 4: map2_v2  ─┘
```

**Total Training Time: ~2 hours** (all running at once!)
**No dependencies - all 4 jobs are completely independent**

---

## Setup Steps

### 1. Create Your Kaggle Dataset

```bash
# Create kaggle dataset directory
mkdir kaggle_dataset

# Copy all the files (using correct names)
cp agents/*.py kaggle_dataset/
cp env.py kaggle_dataset/
cp observations.py kaggle_dataset/
cp physics.py kaggle_dataset/
cp server.py kaggle_dataset/
cp train.py kaggle_dataset/
cp -r maps kaggle_dataset/
cp -r rewards kaggle_dataset/
cp parellel_train.py kaggle_dataset/  # Note: it's "parellel" not "parallel"

# Create zip
cd kaggle_dataset
zip -r ../kaggle_dataset.zip .
cd ..

# Verify
ls -lh kaggle_dataset.zip
```

Upload to Kaggle as a **private dataset**: `username/tank-arena-training`

### 2. Create 4 Kaggle Kernels

Go to https://www.kaggle.com/kernels and create 4 **NEW** notebooks:

- Kernel 1: Map1_v1_Baseline
- Kernel 2: Map1_v2_WarmStart
- Kernel 3: Map2_v1_Baseline
- Kernel 4: Map2_v2_WarmStart

---

## Kernel Code Templates

### **Kernel 1: map1_v1 (RUN FIRST)**

```python
# Cell 1: Setup
import os, sys, subprocess
subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "stable-baselines3[extra]"])
sys.path.insert(0, '/kaggle/input/tank-arena-training')

# Cell 2: Run training
os.chdir('/kaggle/working')
os.system('python /kaggle/input/tank-arena-training/parallel_train.py --job map1_v1')

# Cell 3: Show results
import json
meta = json.load(open('/kaggle/working/models/map1/metadata_v1.json'))
print(json.dumps(meta, indent=2))
```

### **Kernel 2: map1_v2 (RUN AFTER Kernel 1 or PARALLEL with Kernel 3)**

```python
# Cell 1: Setup
import os, sys, subprocess
subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "stable-baselines3[extra]"])
sys.path.insert(0, '/kaggle/input/tank-arena-training')

# Cell 2: Run training
# This will automatically wait for map1_v1 to finish
os.chdir('/kaggle/working')
os.system('python /kaggle/input/tank-arena-training/parallel_train.py --job map1_v2')

# Cell 3: Show results
import json
meta = json.load(open('/kaggle/working/models/map1/metadata_v2.json'))
print(json.dumps(meta, indent=2))
```

### **Kernel 3: map2_v1 (RUN PARALLEL with Kernel 1)**

```python
# Cell 1: Setup
import os, sys, subprocess
subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "stable-baselines3[extra]"])
sys.path.insert(0, '/kaggle/input/tank-arena-training')

# Cell 2: Run training
os.chdir('/kaggle/working')
os.system('python /kaggle/input/tank-arena-training/parallel_train.py --job map2_v1')

# Cell 3: Show results
import json
meta = json.load(open('/kaggle/working/models/map2/metadata_v1.json'))
print(json.dumps(meta, indent=2))
```

### **Kernel 4: map2_v2 (RUN PARALLEL with Kernel 2)**

```python
# Cell 1: Setup
import os, sys, subprocess
subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "stable-baselines3[extra]"])
sys.path.insert(0, '/kaggle/input/tank-arena-training')

# Cell 2: Run training
# This will automatically wait for map2_v1 to finish
os.chdir('/kaggle/working')
os.system('python /kaggle/input/tank-arena-training/parallel_train.py --job map2_v2')

# Cell 3: Show results
import json
meta = json.load(open('/kaggle/working/models/map2/metadata_v2.json'))
print(json.dumps(meta, indent=2))
```

---

## Execution Timeline

### Simple Parallel Schedule

```
Time    Kernel1        Kernel2         Kernel3         Kernel4
────────────────────────────────────────────────────────────────
00:00   START ▶        START ▶         START ▶         START ▶
        map1_v1        map1_v2         map2_v1         map2_v2

00:40   RUNNING...     RUNNING...      RUNNING...      RUNNING...
        (150k steps)   (150k steps)    (150k steps)    (150k steps)

01:40   RUNNING...     RUNNING...      RUNNING...      RUNNING...

02:00   DONE ✓         DONE ✓          DONE ✓          DONE ✓
        (map1_v1)      (map1_v2)       (map2_v1)       (map2_v2)
```

### What to Do

1. **T+0:00** - Start ALL 4 kernels at the same time
2. **T+0:05** - All training running in parallel
3. **T+2:00** - All 4 jobs complete! ✅

That's it! No waiting, no dependencies, no coordination needed.

---

## Monitoring Training

### In Kaggle Kernels

Each kernel will print progress every 10k timesteps:

```
[STAGE 0] random (2.0%)
[ 10000] Avg R:   2.34 | Win%: 35.2%
  Opponent Stats (this stage):
    random:random    : 35.2% (18/51)

[STAGE 1] chaser (40.0%)
[ 50000] Avg R:  15.67 | Win%: 72.5%
  Opponent Stats (this stage):
    chaser:chaser    : 72.5% (37/51)

[STAGE 2] circler (40.0%)
[100000] Avg R:  18.92 | Win%: 78.3%

[STAGE 3] selfplay (18.0%)
[150000] Avg R:  21.45 | Win%: 82.1%
  ★ Best (82.1%) → /kaggle/working/models/map1/best.zip
```

### Check Shared Models

From Kernel 2 or 4, check if dependency is available:

```python
from pathlib import Path
model_file = Path('/kaggle/working/models/map1/final_v1.zip')
print(f"Model exists: {model_file.exists()}")
print(f"Model size: {model_file.stat().st_size / (1024**2):.1f} MB")
```

---

## After Training Complete

### Download All Models

```bash
kaggle kernels output USERNAME/Map1_v1_Baseline -p ./kaggle_models
kaggle kernels output USERNAME/Map1_v2_WarmStart -p ./kaggle_models
kaggle kernels output USERNAME/Map2_v1_Baseline -p ./kaggle_models
kaggle kernels output USERNAME/Map2_v2_WarmStart -p ./kaggle_models

# Consolidate
mkdir -p local_models
cp -r kaggle_models/*/models/* local_models/
```

### Verify All Models

```bash
ls -lh local_models/map1/
ls -lh local_models/map2/

# Should have:
# final_v1.zip, final_v2.zip
# stage_0_checkpoint.zip, stage_1_checkpoint.zip, stage_2_checkpoint.zip
# best.zip, metadata_v1.json, metadata_v2.json
```

### Test Locally

```bash
python eval_models.py --model local_models/map1/final_v2 --opponent chaser --episodes 50
python eval_models.py --model local_models/map2/final_v2 --opponent mobile --episodes 50
```

---

## Troubleshooting

### "Timeout waiting for dependency"

- Check if Kernel 1 (or 3) actually finished successfully
- Extend wait timeout: edit `max_wait=600` in parallel_train.py

### "CUDA out of memory" in one kernel

- Other kernels also use GPU: reduce batch_size
- In affected kernel: `--batch_size 32 --n_steps 1024`

### Models not appearing in shared folder

- Kaggle kernels don't automatically share `/kaggle/working/` between kernels
- **Solution**: Both kernels write to same path, but filesystem isn't shared
- **Use Kaggle Datasets API** to share models between kernels (advanced)

### Kernel interrupted

- Kaggle has 9-hour limit per kernel
- Each training is ~1.5-2 hours, so you're safe
- If interrupted: restart the kernel, it will resume from checkpoint

---

## GPU Quotas

Kaggle gives **30 GPU hours/week**:

- 4 trainings × 2 hours = 8 hours
- Well within limits! ✅

---

## Performance Expectations

After parallel training completes, you'll have:

```
models/
├── map1/
│   ├── final_v1.zip         ← 80-85% win rate (random)
│   ├── final_v2.zip         ← 85-90% win rate (random)
│   ├── best.zip             ← best v1 or v2
│   ├── metadata_v1.json
│   ├── metadata_v2.json
│   └── stage_*.checkpoint   ← intermediate checkpoints
│
└── map2/
    ├── final_v1.zip         ← 75-80% vs random
    ├── final_v2.zip         ← 80-85% vs random
    ├── best.zip
    ├── metadata_v1.json
    ├── metadata_v2.json
    └── stage_*.checkpoint
```

Use `final_v2` models locally - they're the most trained and best generalized! 🏆

---

## FAQ

**Q: Can I run all 4 in the same kernel?**
A: Not recommended - sharing GPU will slow everything down. 4 kernels is ideal.

**Q: Which variation is better, v1 or v2?**
A: Usually v2 (more selfplay, less random) generalizes better. Evaluate both!

**Q: Can I modify hyperparameters?**
A: Yes! In each kernel:

```python
os.system('python ... --job map1_v1 --lr 5e-4 --batch_size 128')
```

**Q: What if a kernel times out?**
A: Kaggle saves checkpoints. Restart the kernel and training resumes.
