(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const highScoreEl = document.getElementById('highScore');
  const waveEl = document.getElementById('wave');
  const livesEl = document.getElementById('lives');
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('startBtn');
  const wrap = document.getElementById('wrap');
  const overlayTitle = overlay.querySelector('.title');
  const overlaySub = overlay.querySelector('.sub');
  const splashGraphic = overlay.querySelector('.splash-graphic');
  const HIGH_SCORE_KEY = 'parabreachHighScore';
  const TROOPER_ALERT_INTERVAL = 1.5;
  const TROOPER_TURRET_LANDING_BUFFER = 92;

  const explosionSound = new Audio('assets/sounds/FinalExplosion.wav');
  const chopperExplosionSound = new Audio('assets/sounds/ChopperExplosion.wav');
  const missileExplosionSound = new Audio('assets/sounds/MissileExplosion.wav');
  const missileLaunchSound = new Audio('assets/sounds/MissileLaunch.wav');
  const trooperAlertSound = new Audio('assets/sounds/TrooperAlert.wav');
  const trooperGroundHitSound = new Audio('assets/sounds/TrooperGroundHit.wav');
  const trooperHitSound = new Audio('assets/sounds/TrooperHit.wav');
  const turretExplosionSound = new Audio('assets/sounds/FinalExplosion.wav');

  const initialTitle = overlayTitle.innerHTML;
  const initialSub = overlaySub.innerHTML;

  let w = 0;
  let h = 0;
  let dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  let lastTs = 0;
  let running = false;
  let pointerDown = false;
  let activePointerId = null;
  let pointerX = 0;
  let pointerY = 0;
  let flashTimer = 0;

  const groundHeight = () => Math.max(38, h * 0.07);
  const turret = {
    x: 0,
    y: 0,
    angle: 0,
    barrelLength: 54,
    radius: 18
  };

  const bullets = [];
  const helicopters = [];
  const planes = [];
  const missiles = [];
  const tanks = [];
  const jammers = [];
  const troopers = [];
  const particles = [];
  const groundTroopers = [];
  const endAssault = {
    active: false,
    phase: 'idle',
    timer: 0,
    phaseDuration: 0,
    beat: 0
  };
  const deathFx = {
    active: false,
    timer: 0,
    burstTimer: 0,
    burstsLeft: 0
  };

  let score = 0;
  let highScore = loadHighScore();
  let highScoreBeaten = false;
  let wave = 1;
  let gameOver = false;
  let fireCooldown = 0;
  let spawnCooldown = 0;
  let planeCooldown = 0;
  let jammerCooldown = 0;
  let difficulty = 0;
  let turretDestroyed = false;
  let trooperKills = 0;
  let nextTankAt = 100;
  let jammedTimer = 0;
  let trooperAlertTimer = TROOPER_ALERT_INTERVAL;

  function resize() {
    dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    turret.x = w * 0.5;
    turret.y = h - groundHeight();
  }

  function resetGame() {
    bullets.length = 0;
    helicopters.length = 0;
    planes.length = 0;
    missiles.length = 0;
    tanks.length = 0;
    jammers.length = 0;
    troopers.length = 0;
    particles.length = 0;
    groundTroopers.length = 0;
    score = 0;
    highScoreBeaten = false;
    wave = 1;
    gameOver = false;
    fireCooldown = 0;
    spawnCooldown = 0.7;
    planeCooldown = rand(10.5, 14.0);
    jammerCooldown = rand(12.0, 18.0);
    difficulty = 0;
    trooperKills = 0;
    nextTankAt = 100;
    jammedTimer = 0;
    trooperAlertTimer = TROOPER_ALERT_INTERVAL;
    updateHud();
    flashTimer = 0;
    turretDestroyed = false;
    deathFx.active = false;
    deathFx.timer = 0;
    deathFx.burstTimer = 0;
    deathFx.burstsLeft = 0;
    endAssault.active = false;
    endAssault.phase = 'idle';
    endAssault.timer = 0;
    endAssault.phaseDuration = 0;
    endAssault.beat = 0;
    trooperAlertSound.pause();
    trooperAlertSound.currentTime = 0;
  }

  function updateHud() {
    if (score > highScore) {
      highScore = score;
      highScoreBeaten = true;
      saveHighScore(highScore);
    }
    scoreEl.textContent = 'SCORE ' + String(score).padStart(6, '0');
    highScoreEl.textContent = 'HI ' + String(highScore).padStart(6, '0');
    waveEl.textContent = 'WAVE ' + wave + (jammedTimer > 0 ? '  JAMMED' : '');
    livesEl.textContent = 'TROOPERS ' + groundTroopers.length;
  }

  function loadHighScore() {
    try {
      const stored = window.localStorage.getItem(HIGH_SCORE_KEY);
      const parsed = Number.parseInt(stored || '0', 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch {
      return 0;
    }
  }

  function saveHighScore(value) {
    try {
      window.localStorage.setItem(HIGH_SCORE_KEY, String(value));
    } catch {
      // Ignore storage failures so the game still runs in restricted browsers.
    }
  }

  function clampTrooperLandingX(x) {
    const minX = 30;
    const maxX = w - 30;
    const clampedX = Math.max(minX, Math.min(maxX, x));
    if (Math.abs(clampedX - turret.x) >= TROOPER_TURRET_LANDING_BUFFER) return clampedX;
    return clampedX < turret.x
      ? Math.max(minX, turret.x - TROOPER_TURRET_LANDING_BUFFER)
      : Math.min(maxX, turret.x + TROOPER_TURRET_LANDING_BUFFER);
  }

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function aimAt(x, y) {
    pointerX = x;
    pointerY = y;
    const dx = x - turret.x;
    const dy = y - turret.y;
    // Full atan2 aim is symmetric left/right and fixes wrap issues near PI.
    turret.angle = Math.atan2(dy, dx);
  }

  function fireBullet() {
    const speed = Math.max(w, h) * 0.95;
    const spread = jammedTimer > 0 ? rand(-0.14, 0.14) : 0;
    const a = turret.angle + spread;
    const bx = turret.x + Math.cos(a) * turret.barrelLength;
    const by = turret.y + Math.sin(a) * turret.barrelLength;
    bullets.push({
      x: bx,
      y: by,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      r: 3
    });
  }

  function spawnHelicopter() {
    const fromLeft = Math.random() < 0.5;
    const speed = rand(70, 120) + difficulty * 7;
    const y = rand(h * 0.12, h * 0.45);
    helicopters.push({
      x: fromLeft ? -70 : w + 70,
      y,
      vx: fromLeft ? speed : -speed,
      width: 68,
      height: 28,
      nextDrop: rand(0.8, 1.8),
      dropsLeft: Math.floor(rand(2, 5)),
      fromLeft
    });
  }

  function dropTrooper(heli) {
    troopers.push({
      x: heli.x,
      y: heli.y + 10,
      vx: rand(-10, 10),
      vy: 22,
      parachute: true,
      swing: rand(0, Math.PI * 2),
      landed: false,
      targetX: null,
      isAttacking: false,
      jumpOffset: 0,
      attackPhase: 'idle',
      attackTimer: 0,
      jumpTimer: 0,
      noChuteFall: false
    });
  }

  function spawnAttackPlane() {
    const fromLeft = Math.random() < 0.5;
    const speed = rand(120, 150) + difficulty * 5;
    const y = rand(h * 0.08, h * 0.2);
    const dropOffset = rand(90, 190) * (fromLeft ? 1 : -1);
    planes.push({
      x: fromLeft ? -100 : w + 100,
      y,
      vx: fromLeft ? speed : -speed,
      width: 76,
      height: 22,
      fromLeft,
      dropped: false,
      dropX: turret.x + dropOffset
    });
  }

  function dropMissile(plane) {
    const tx = turret.x;
    const ty = turret.y;
    const dx = tx - plane.x;
    const dy = ty - plane.y;
    const d = Math.max(0.001, Math.hypot(dx, dy));
    const speed = 112;
    missiles.push({
      x: plane.x,
      y: plane.y + 6,
      vx: (dx / d) * speed,
      vy: (dy / d) * speed,
      r: 8
    });
    playSound(missileLaunchSound);
  }

  function spawnParachuteTank() {
    tanks.push({
      x: rand(70, w - 70),
      y: -36,
      vx: rand(-8, 8),
      vy: 22,
      parachute: true,
      swing: rand(0, Math.PI * 2),
      hp: 10,
      maxHp: 10,
      jumpOffset: 0
    });
  }

  function spawnJammerPod() {
    jammers.push({
      x: rand(80, w - 80),
      y: -34,
      vx: rand(-12, 12),
      vy: 24,
      swing: rand(0, Math.PI * 2),
      parachute: true
    });
  }

  function addExplosion(x, y, count = 18, sound = explosionSound) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(40, 220);
      particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: rand(0.25, 0.55),
        maxLife: 0.55,
        size: rand(1.5, 3.5)
      });
    }
    playSound(sound);
  }

  function addChopperExplosion(x, y, count = 18) {
    addExplosion(x, y, count, chopperExplosionSound);
  }

  function addPop(x, y) {
    particles.push({ x, y, vx: 0, vy: 0, life: 0.18, maxLife: 0.18, size: 14, ring: true });
  }

  function addShockwave(x, y, radius = 26, count = 3) {
    for (let i = 0; i < count; i++) {
      const s = radius + i * 16;
      const life = 0.2 + i * 0.06;
      particles.push({ x, y, vx: 0, vy: 0, life, maxLife: life, size: s, ring: true });
    }
  }

  function addVectorFireworks(x, y, bursts = 3) {
    for (let b = 0; b < bursts; b++) {
      const ox = x + rand(-22, 22);
      const oy = y + rand(-16, 16);
      const rays = Math.floor(rand(18, 30));
      for (let i = 0; i < rays; i++) {
        const a = (i / rays) * Math.PI * 2 + rand(-0.08, 0.08);
        const s = rand(160, 320);
        const life = rand(0.28, 0.52);
        particles.push({
          x: ox,
          y: oy,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life,
          maxLife: life,
          spark: true
        });
      }
    }
  }

  function playSound(sound) {
    sound.currentTime = 0;
    sound.play();
  }

  function beginEndAssault() {
    endAssault.active = true;
    endAssault.phase = 'intimidate';
    endAssault.timer = 0.9;
    endAssault.phaseDuration = 0.9;
    endAssault.beat = 0;
    trooperAlertTimer = TROOPER_ALERT_INTERVAL;
    for (let i = 0; i < groundTroopers.length; i++) {
      const t = groundTroopers[i];
      t.attackPhase = 'intimidate';
      t.assaultIndex = i;
      t.runCycle = rand(0, Math.PI * 2);
      t.jumpOffset = 0;
      t.attackDelay = i * 0.045;
    }
  }

  function lineCircleHit(x1, y1, x2, y2, cx, cy, r) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (!lenSq) return false;
    let t = ((cx - x1) * dx + (cy - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const px = x1 + t * dx;
    const py = y1 + t * dy;
    const ddx = cx - px;
    const ddy = cy - py;
    return ddx * ddx + ddy * ddy <= r * r;
  }

  function lineRectHit(x1, y1, x2, y2, rx, ry, rw, rh) {
    let t0 = 0;
    let t1 = 1;
    const dx = x2 - x1;
    const dy = y2 - y1;

    function clip(p, q) {
      if (p === 0) return q >= 0;
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
      return true;
    }

    if (
      clip(-dx, x1 - rx) &&
      clip(dx, rx + rw - x1) &&
      clip(-dy, y1 - ry) &&
      clip(dy, ry + rh - y1)
    ) {
      return t1 >= t0;
    }
    return false;
  }

  function triggerGameOver() {
    gameOver = true;
    running = false;
    overlay.classList.add('show');
    splashGraphic.style.display = 'none';
    overlayTitle.textContent = 'GAME OVER';
    overlaySub.textContent = highScoreBeaten
      ? `New high score ${highScore}. Final score ${score}.`
      : `Final score ${score}. High score ${highScore}.`;
    startBtn.textContent = 'Play Again';
    wrap.style.pointerEvents = 'none';
    playSound(explosionSound);
  }

  function startTurretDestruction() {
    turretDestroyed = true;
    deathFx.active = true;
    deathFx.timer = 0.85;
    deathFx.burstTimer = 0;
    deathFx.burstsLeft = 6;
    addShockwave(turret.x, turret.y, 14, 5);
    addVectorFireworks(turret.x, turret.y, 3);
    playSound(turretExplosionSound);
    flashTimer = 0.22;
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (!p.ring) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.spark) {
          p.vx *= 0.985;
          p.vy = p.vy * 0.985 + 95 * dt;
        } else {
          p.vx *= 0.97;
          p.vy *= 0.97;
        }
      }
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function update(dt) {
    if (gameOver) return;

    difficulty += dt * 0.055;
    wave = 1 + Math.floor(difficulty / 1.2);

    fireCooldown -= dt;
    spawnCooldown -= dt;
    flashTimer = Math.max(0, flashTimer - dt);
    jammedTimer = Math.max(0, jammedTimer - dt);

    if (deathFx.active) {
      deathFx.timer -= dt;
      deathFx.burstTimer -= dt;
      if (deathFx.burstsLeft > 0 && deathFx.burstTimer <= 0) {
        deathFx.burstTimer = 0.11;
        deathFx.burstsLeft--;
        addVectorFireworks(turret.x + rand(-14, 14), turret.y + rand(-12, 12), 1);
        if (Math.random() < 0.45) addExplosion(turret.x + rand(-12, 12), turret.y + rand(-8, 8), 10);
        flashTimer = Math.max(flashTimer, 0.08);
      }
      updateParticles(dt);
      if (deathFx.timer <= 0) {
        deathFx.active = false;
        triggerGameOver();
      }
      return;
    }

    if (pointerDown && fireCooldown <= 0) {
      fireBullet();
      const baseCooldown = Math.max(0.07, 0.15 - difficulty * 0.004);
      fireCooldown = jammedTimer > 0 ? baseCooldown * 1.9 : baseCooldown;
    }

    if (spawnCooldown <= 0) {
      spawnHelicopter();
      spawnCooldown = Math.max(0.55, rand(1.1, 2.0) - difficulty * 0.07);
    }

    while (trooperKills >= nextTankAt) {
      spawnParachuteTank();
      nextTankAt += 100;
    }

    planeCooldown -= dt;
    if (planeCooldown <= 0 && planes.length < 1 && missiles.length < 2) {
      spawnAttackPlane();
      planeCooldown = Math.max(7.5, rand(11.5, 15.5) - difficulty * 0.4);
    }

    jammerCooldown -= dt;
    if (jammerCooldown <= 0 && jammers.length < 2) {
      spawnJammerPod();
      jammerCooldown = Math.max(9.5, rand(14.0, 20.0) - difficulty * 0.45);
    }

    for (let i = helicopters.length - 1; i >= 0; i--) {
      const heli = helicopters[i];
      heli.x += heli.vx * dt;
      heli.nextDrop -= dt;
      if (heli.nextDrop <= 0 && heli.dropsLeft > 0) {
        dropTrooper(heli);
        heli.dropsLeft--;
        heli.nextDrop = rand(0.6, 1.4);
      }
      if (heli.x < -120 || heli.x > w + 120) helicopters.splice(i, 1);
    }

    for (let i = planes.length - 1; i >= 0; i--) {
      const plane = planes[i];
      plane.x += plane.vx * dt;
      if (!plane.dropped) {
        const crossed = plane.vx > 0 ? plane.x >= plane.dropX : plane.x <= plane.dropX;
        if (crossed) {
          dropMissile(plane);
          plane.dropped = true;
        }
      }
      if (plane.x < -160 || plane.x > w + 160) planes.splice(i, 1);
    }

    const gY = h - groundHeight();

    for (let i = missiles.length - 1; i >= 0; i--) {
      const m = missiles[i];
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (Math.hypot(m.x - turret.x, m.y - turret.y) < turret.radius + 8) {
        missiles.splice(i, 1);
        startTurretDestruction();
        return;
      }
      if (m.x < -80 || m.x > w + 80 || m.y < -80 || m.y > h + 80) missiles.splice(i, 1);
    }

    for (let i = jammers.length - 1; i >= 0; i--) {
      const j = jammers[i];
      j.swing += dt * 2.0;
      if (j.parachute) {
        j.vy += 12 * dt;
        j.vx += Math.sin(j.swing) * 8 * dt;
        j.vx *= 0.995;
      } else {
        j.vy += 240 * dt;
      }
      j.x += j.vx * dt;
      j.y += j.vy * dt;

      if (j.y >= gY - 2) {
        addShockwave(j.x, gY - 3, 12, 3);
        addVectorFireworks(j.x, gY - 6, 1);
        jammedTimer = Math.max(jammedTimer, 6.0);
        flashTimer = Math.max(flashTimer, 0.11);
        jammers.splice(i, 1);
        updateHud();
      } else if (j.x < -80 || j.x > w + 80 || j.y > h + 80) {
        jammers.splice(i, 1);
      }
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      const oldX = b.x;
      const oldY = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      let removed = false;

      for (let j = missiles.length - 1; j >= 0; j--) {
        const m = missiles[j];
        if (lineCircleHit(oldX, oldY, b.x, b.y, m.x, m.y, m.r)) {
          addShockwave(m.x, m.y, 10, 2);
          addVectorFireworks(m.x, m.y, 1);
          playSound(missileExplosionSound);
          missiles.splice(j, 1);
          bullets.splice(i, 1);
          score += 20;
          updateHud();
          removed = true;
          flashTimer = 0.06;
          break;
        }
      }
      if (removed) continue;

      for (let j = jammers.length - 1; j >= 0; j--) {
        const pod = jammers[j];
        const hitChute = pod.parachute && lineCircleHit(oldX, oldY, b.x, b.y, pod.x, pod.y - 14, 12);
        const hitBody = lineCircleHit(oldX, oldY, b.x, b.y, pod.x, pod.y + 2, 10);
        if (hitChute || hitBody) {
          addExplosion(pod.x, pod.y, 16);
          jammers.splice(j, 1);
          bullets.splice(i, 1);
          score += 12;
          updateHud();
          removed = true;
          flashTimer = 0.04;
          break;
        }
      }
      if (removed) continue;

      for (let j = planes.length - 1; j >= 0; j--) {
        const p = planes[j];
        const rx = p.x - p.width / 2;
        const ry = p.y - p.height / 2;
        if (lineRectHit(oldX, oldY, b.x, b.y, rx, ry, p.width, p.height)) {
          addExplosion(p.x, p.y, 26);
          planes.splice(j, 1);
          bullets.splice(i, 1);
          score += 15;
          updateHud();
          removed = true;
          flashTimer = 0.07;
          break;
        }
      }
      if (removed) continue;

      for (let j = helicopters.length - 1; j >= 0; j--) {
        const heli = helicopters[j];
        const rx = heli.x - heli.width / 2;
        const ry = heli.y - heli.height / 2;
        if (lineRectHit(oldX, oldY, b.x, b.y, rx, ry, heli.width, heli.height)) {
          addChopperExplosion(heli.x, heli.y, 22);
          helicopters.splice(j, 1);
          bullets.splice(i, 1);
          score += 10;
          updateHud();
          removed = true;
          flashTimer = 0.05;
          break;
        }
      }
      if (removed) continue;

      for (let j = tanks.length - 1; j >= 0; j--) {
        const tk = tanks[j];
        const hitChute = tk.parachute && lineCircleHit(oldX, oldY, b.x, b.y, tk.x, tk.y - 16, 13);
        const hitBody = lineCircleHit(oldX, oldY, b.x, b.y, tk.x, tk.y + 2 - (tk.jumpOffset || 0), 12);
        if (hitChute || hitBody) {
          bullets.splice(i, 1);
          tk.hp--;
          addPop(tk.x, tk.y + 2 - (tk.jumpOffset || 0));
          flashTimer = 0.03;
          removed = true;
          if (tk.hp <= 0) {
            addExplosion(tk.x, tk.y, 34);
            addVectorFireworks(tk.x, tk.y, 1);
            tanks.splice(j, 1);
            score += 40;
            updateHud();
          }
          break;
        }
      }
      if (removed) continue;

      for (let j = troopers.length - 1; j >= 0; j--) {
        const t = troopers[j];
        const hitParachute = t.parachute && lineCircleHit(oldX, oldY, b.x, b.y, t.x, t.y - 10, 11);
        const hitBody = lineCircleHit(oldX, oldY, b.x, b.y, t.x, t.y + 8, 8);
        if (hitParachute || hitBody) {
          bullets.splice(i, 1);
          removed = true;
          if (hitParachute && !hitBody) {
            t.parachute = false;
            t.noChuteFall = true;
            t.vy = Math.max(t.vy, 160);
            t.vx *= 0.6;
            addPop(t.x, t.y - 10);
            score += 2;
          } else {
            addPop(t.x, t.y + 8);
            playSound(trooperHitSound);
            troopers.splice(j, 1);
            score += 5;
            trooperKills++;
          }
          updateHud();
          break;
        }
      }
      if (removed) continue;

      for (let j = groundTroopers.length - 1; j >= 0; j--) {
        const t = groundTroopers[j];
        if (lineCircleHit(oldX, oldY, b.x, b.y, t.x, t.y + 8 - (t.jumpOffset || 0), 9)) {
          addPop(t.x, t.y + 8 - (t.jumpOffset || 0));
          playSound(trooperHitSound);
          groundTroopers.splice(j, 1);
          bullets.splice(i, 1);
          score += 6;
          trooperKills++;
          updateHud();
          removed = true;
          break;
        }
      }
      if (removed) continue;

      if (b.x < -30 || b.x > w + 30 || b.y < -30 || b.y > h + 30) {
        bullets.splice(i, 1);
      }
    }

    for (let i = troopers.length - 1; i >= 0; i--) {
      const t = troopers[i];
      t.swing += dt * 2.2;
      let crushedGroundTrooper = false;

      if (t.parachute) {
        t.vy += 18 * dt;
        t.vx += Math.sin(t.swing) * 7 * dt;
        t.vx *= 0.995;
      } else {
        t.vy += 280 * dt;
      }

      t.x += t.vx * dt;
      t.y += t.vy * dt;

      if (t.noChuteFall) {
        for (const other of troopers) {
          if (t !== other && other.parachute) {
            const dist = Math.hypot(t.x - other.x, t.y - other.y);
            if (dist < 16) {
              other.parachute = false;
              other.noChuteFall = true;
              other.vy = Math.max(other.vy, 160);
              other.vx *= 0.6;
              addPop(other.x, other.y - 10);
              score += 2;
              updateHud();
            }
          }
        }

        for (let j = groundTroopers.length - 1; j >= 0; j--) {
          const groundTrooper = groundTroopers[j];
          const groundY = groundTrooper.y + 8 - (groundTrooper.jumpOffset || 0);
          if (Math.hypot(t.x - groundTrooper.x, (t.y + 8) - groundY) < 14) {
            addExplosion((t.x + groundTrooper.x) * 0.5, (t.y + groundY) * 0.5, 10, trooperGroundHitSound);
            addPop(groundTrooper.x, groundY);
            groundTroopers.splice(j, 1);
            troopers.splice(i, 1);
            score += 9;
            trooperKills += 2;
            updateHud();
            crushedGroundTrooper = true;
            break;
          }
        }
      }

      if (crushedGroundTrooper) {
        continue;
      }

      if (t.y >= gY - 2) {
        t.y = gY - 2;
        if (t.noChuteFall) {
          addExplosion(t.x, t.y + 5, 10, trooperGroundHitSound);
          score += 3;
          trooperKills++;
          updateHud();
        } else {
          t.x = clampTrooperLandingX(t.x);
          t.landed = true;
          t.parachute = false;
          t.runCycle = rand(0, Math.PI * 2);
          t.jumpOffset = 0;
          if (endAssault.active) {
            t.assaultIndex = groundTroopers.length;
            t.attackPhase = endAssault.phase === 'intimidate' ? 'intimidate' : 'rush';
            t.attackDelay = endAssault.phase === 'rush' ? (groundTroopers.length % 7) * 0.03 : 0;
          }
          groundTroopers.push(t);
        }
        troopers.splice(i, 1);
      }
    }

    for (let i = tanks.length - 1; i >= 0; i--) {
      const tk = tanks[i];
      tk.swing += dt * 2.1;
      if (tk.parachute) {
        tk.vy += 14 * dt;
        tk.vx += Math.sin(tk.swing) * 6 * dt;
        tk.vx *= 0.994;
        tk.jumpOffset = 0;
      } else {
        const dir = turret.x > tk.x ? 1 : -1;
        tk.vx = dir * (44 + difficulty * 4);
        tk.vy = 0;
        tk.jumpOffset = Math.abs(Math.sin((tk.swing += dt * 8))) * 1.5;
      }
      tk.x += tk.vx * dt;
      tk.y += tk.vy * dt;

      if (tk.y >= gY - 3) {
        tk.y = gY - 3;
        tk.parachute = false;
      }

      if (!tk.parachute && Math.abs(tk.x - turret.x) < 14) {
        startTurretDestruction();
        return;
      }
    }

    if (endAssault.active && groundTroopers.length === 0) {
      endAssault.active = false;
      endAssault.phase = 'idle';
      endAssault.timer = 0;
      endAssault.phaseDuration = 0;
      endAssault.beat = 0;
      trooperAlertTimer = TROOPER_ALERT_INTERVAL;
      trooperAlertSound.pause();
      trooperAlertSound.currentTime = 0;
    }

    if (!endAssault.active && groundTroopers.length >= 10) {
      beginEndAssault();
    }

    if (endAssault.active) {
      trooperAlertTimer -= dt;
      if (trooperAlertTimer <= 0) {
        playSound(trooperAlertSound);
        trooperAlertTimer = TROOPER_ALERT_INTERVAL;
      }
      endAssault.timer -= dt;
      endAssault.beat += dt * 11;
      if (endAssault.phase === 'intimidate' && endAssault.timer <= 0) {
        endAssault.phase = 'rush';
        endAssault.timer = 999;
        endAssault.phaseDuration = 999;
        for (const t of groundTroopers) {
          t.attackPhase = 'rush';
        }
        flashTimer = 0.08;
      }
    }

    for (const t of groundTroopers) {
      if (t.attackPhase === 'intimidate') {
        const stomp = Math.max(0, Math.sin(endAssault.beat + t.assaultIndex * 0.55));
        t.jumpOffset = stomp * 5;
        t.runCycle += dt * 9;
        if (stomp > 0.98 && Math.random() < 0.12) addPop(t.x, t.y);
      } else if (t.attackPhase === 'rush') {
        if (t.attackDelay > 0) {
          t.attackDelay -= dt;
          t.runCycle += dt * 8;
          t.jumpOffset = Math.abs(Math.sin(t.runCycle)) * 2;
          continue;
        }
        const dir = turret.x > t.x ? 1 : -1;
        const runSpeed = 168;
        t.x += dir * runSpeed * dt;
        t.runCycle += dt * 15;
        t.jumpOffset = Math.abs(Math.sin(t.runCycle)) * 3;
      } else if (t.attackPhase === 'jumping') {
        t.jumpTimer += dt;
        t.jumpOffset = Math.abs(Math.sin(t.jumpTimer * 8.5)) * 16;
        t.attackTimer -= dt;
        if (t.attackTimer <= 0) {
          t.attackPhase = 'grouping';
          t.attackTimer = 1.5;
        }
        let slot = Math.round((t.x - 40) / 26);
        slot = Math.max(0, Math.min(Math.floor((w - 80) / 26), slot));
        t.targetX = 40 + slot * 26;
        t.x += (t.targetX - t.x) * Math.min(1, dt * 3);
      } else if (t.attackPhase === 'grouping') {
        t.jumpOffset = 0;
        t.targetX = turret.x;
        t.attackTimer -= dt;
        t.x += (t.targetX - t.x) * Math.min(1, dt * 6);
        if (t.attackTimer <= 0) {
          t.attackPhase = 'charging';
          t.attackTimer = 1.0;
        }
      } else if (t.attackPhase === 'charging') {
        t.jumpOffset = 0;
        t.targetX = turret.x;
        t.attackTimer -= dt;
        t.x += (t.targetX - t.x) * Math.min(1, dt * 18);
        if (t.attackTimer <= 0) {
          t.attackPhase = 'attacking';
        }
      } else if (t.attackPhase === 'attacking') {
        t.targetX = turret.x;
        t.x += (t.targetX - t.x) * Math.min(1, dt * 25);
      } else {
        let slot = Math.round((t.x - 40) / 26);
        slot = Math.max(0, Math.min(Math.floor((w - 80) / 26), slot));
        t.targetX = 40 + slot * 26;
        t.x += (t.targetX - t.x) * Math.min(1, dt * 8);
        t.runCycle += dt * 4;
        t.jumpOffset = 0;
      }

      if ((t.attackPhase === 'rush' || t.attackPhase === 'charging' || t.attackPhase === 'attacking') && Math.abs(t.x - turret.x) < 8) {
        const index = groundTroopers.indexOf(t);
        if (index > -1) {
          groundTroopers.splice(index, 1);
        }
        startTurretDestruction();
        return;
      }
    }

    updateHud();

    updateParticles(dt);
  }

  function drawScanlines() {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += 4) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawGround() {
    const gy = h - groundHeight();
    ctx.save();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, gy + 0.5);
    ctx.lineTo(w, gy + 0.5);
    ctx.stroke();
    ctx.restore();
  }

  function drawTurret() {
    if (turretDestroyed) {
      ctx.save();
      ctx.translate(turret.x, turret.y);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-16, -6);
      ctx.lineTo(-4, 5);
      ctx.moveTo(4, -5);
      ctx.lineTo(16, 6);
      ctx.moveTo(-10, 10);
      ctx.lineTo(10, 10);
      ctx.stroke();
      ctx.restore();
      return;
    }

    const jitter = pointerDown ? Math.sin(performance.now() * 0.04) * 0.6 : 0;

    ctx.save();
    ctx.translate(turret.x, turret.y);
    ctx.rotate(turret.angle + jitter * 0.01);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;

    // Barrel body
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(turret.barrelLength - 8, -4);
    ctx.lineTo(turret.barrelLength + 4, -2);
    ctx.lineTo(turret.barrelLength + 8, 0);
    ctx.lineTo(turret.barrelLength + 4, 2);
    ctx.lineTo(turret.barrelLength - 8, 4);
    ctx.lineTo(0, 4);
    ctx.stroke();

    // Barrel segment rings
    ctx.beginPath();
    ctx.moveTo(14, -4);
    ctx.lineTo(14, 4);
    ctx.moveTo(30, -4);
    ctx.lineTo(30, 4);
    ctx.moveTo(44, -4);
    ctx.lineTo(44, 4);
    ctx.stroke();

    // Muzzle
    ctx.beginPath();
    ctx.arc(turret.barrelLength + 8, 0, 3, 0, Math.PI * 2);
    ctx.stroke();

    // Breech + trunnion
    ctx.beginPath();
    ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
    ctx.moveTo(-10, 0);
    ctx.lineTo(10, 0);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;

    // Main turret ring
    ctx.beginPath();
    ctx.arc(turret.x, turret.y, turret.radius, 0, Math.PI * 2);
    ctx.stroke();

    // Inner ring
    ctx.beginPath();
    ctx.arc(turret.x, turret.y, turret.radius - 7, 0, Math.PI * 2);
    ctx.stroke();

    // Support struts
    ctx.beginPath();
    ctx.moveTo(turret.x - 9, turret.y - 6);
    ctx.lineTo(turret.x + 9, turret.y - 6);
    ctx.moveTo(turret.x - 12, turret.y + 4);
    ctx.lineTo(turret.x + 12, turret.y + 4);
    ctx.moveTo(turret.x - 8, turret.y + 10);
    ctx.lineTo(turret.x + 8, turret.y + 10);
    ctx.stroke();

    // Base platform
    ctx.beginPath();
    ctx.moveTo(turret.x - 22, turret.y + 16);
    ctx.lineTo(turret.x + 22, turret.y + 16);
    ctx.moveTo(turret.x - 18, turret.y + 20);
    ctx.lineTo(turret.x + 18, turret.y + 20);
    ctx.moveTo(turret.x - 12, turret.y + 24);
    ctx.lineTo(turret.x + 12, turret.y + 24);
    ctx.stroke();

    // Side braces
    ctx.beginPath();
    ctx.moveTo(turret.x - 14, turret.y + 12);
    ctx.lineTo(turret.x - 20, turret.y + 20);
    ctx.moveTo(turret.x + 14, turret.y + 12);
    ctx.lineTo(turret.x + 20, turret.y + 20);
    ctx.stroke();
    ctx.restore();
  }

  function drawHelicopter(heli) {
    ctx.save();
    ctx.translate(heli.x, heli.y);
    ctx.scale(heli.vx >= 0 ? 1 : -1, 1);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    const rotorSweep = 20 + Math.sin(heli.x * 0.06) * 14;

    // Rotor mast + blades
    ctx.beginPath();
    ctx.moveTo(-8, -10);
    ctx.lineTo(-8, -16);
    ctx.moveTo(-8 - rotorSweep, -16);
    ctx.lineTo(-8 + rotorSweep, -16);
    ctx.moveTo(-8, -16 - rotorSweep * 0.2);
    ctx.lineTo(-8, -16 + rotorSweep * 0.2);
    ctx.stroke();

    // Fuselage
    ctx.beginPath();
    ctx.moveTo(-24, -8);
    ctx.lineTo(12, -8);
    ctx.lineTo(20, -2);
    ctx.lineTo(20, 4);
    ctx.lineTo(10, 8);
    ctx.lineTo(-24, 8);
    ctx.lineTo(-30, 2);
    ctx.lineTo(-30, -2);
    ctx.closePath();
    ctx.stroke();

    // Cockpit window
    ctx.beginPath();
    ctx.moveTo(6, -6);
    ctx.lineTo(15, -1);
    ctx.lineTo(6, 4);
    ctx.closePath();
    ctx.stroke();

    // Tail boom and tail rotor
    ctx.beginPath();
    ctx.moveTo(-30, 0);
    ctx.lineTo(-48, 0);
    ctx.moveTo(-48, -5);
    ctx.lineTo(-48, 5);
    ctx.moveTo(-52, 0);
    ctx.lineTo(-44, 0);
    ctx.stroke();

    // Skids
    ctx.beginPath();
    ctx.moveTo(-20, 10);
    ctx.lineTo(15, 10);
    ctx.moveTo(-16, 8);
    ctx.lineTo(-16, 12);
    ctx.moveTo(8, 8);
    ctx.lineTo(8, 12);
    ctx.stroke();

    ctx.restore();
  }

  function drawAttackPlane(plane) {
    ctx.save();
    ctx.translate(plane.x, plane.y);
    ctx.scale(plane.vx >= 0 ? 1 : -1, 1);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(-28, 0);
    ctx.lineTo(18, 0);
    ctx.lineTo(28, 3);
    ctx.lineTo(18, 6);
    ctx.lineTo(-28, 6);
    ctx.lineTo(-36, 3);
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-8, -10);
    ctx.lineTo(10, 0);
    ctx.lineTo(-8, 10);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-30, 3);
    ctx.lineTo(-44, -1);
    ctx.moveTo(-30, 3);
    ctx.lineTo(-44, 7);
    ctx.stroke();

    ctx.restore();
  }

  function drawMissile(m) {
    const a = Math.atan2(m.vy, m.vx);
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(a);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;

    // Missile body
    ctx.beginPath();
    ctx.moveTo(-13, -2.5);
    ctx.lineTo(7, -2.5);
    ctx.lineTo(11, 0);
    ctx.lineTo(7, 2.5);
    ctx.lineTo(-13, 2.5);
    ctx.closePath();
    ctx.stroke();

    // Nose cone seam
    ctx.beginPath();
    ctx.moveTo(6, -2.5);
    ctx.lineTo(6, 2.5);
    ctx.stroke();

    // Stabilizer fins
    ctx.beginPath();
    ctx.moveTo(-10, -2.5);
    ctx.lineTo(-15, -6);
    ctx.moveTo(-10, 2.5);
    ctx.lineTo(-15, 6);
    ctx.moveTo(-4, -2.5);
    ctx.lineTo(-7, -5);
    ctx.moveTo(-4, 2.5);
    ctx.lineTo(-7, 5);
    ctx.stroke();

    // Exhaust
    ctx.beginPath();
    ctx.moveTo(-13, 0);
    ctx.lineTo(-18, 0);
    ctx.moveTo(-18, -1.5);
    ctx.lineTo(-20, 0);
    ctx.lineTo(-18, 1.5);
    ctx.stroke();

    ctx.restore();
  }

  function drawTrooper(t) {
    ctx.save();
    ctx.translate(t.x, t.y - (t.jumpOffset || 0));
    ctx.strokeStyle = '#fff';
    ctx.fillStyle = '#fff';
    ctx.lineWidth = 2;

    if (t.parachute) {
      ctx.beginPath();
      ctx.arc(0, -10, 11, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-10, -10);
      ctx.lineTo(0, 0);
      ctx.moveTo(10, -10);
      ctx.lineTo(0, 0);
      ctx.stroke();
    }

    // Head
    ctx.beginPath();
    ctx.arc(0, 2, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Body
    ctx.beginPath();
    ctx.moveTo(0, 5);
    ctx.lineTo(0, 13);
    ctx.stroke();

    const cycle = t.runCycle || 0;
    const aggressive = t.attackPhase === 'rush' || t.attackPhase === 'charging' || t.attackPhase === 'attacking' || t.attackPhase === 'intimidate';
    const armSwing = aggressive ? Math.sin(cycle) * 5 : 0;
    const legSwing = aggressive ? Math.sin(cycle + Math.PI * 0.5) * 3 : 0;

    // Arms
    ctx.beginPath();
    ctx.moveTo(-5, 8 + armSwing * 0.45);
    ctx.lineTo(5, 8 - armSwing * 0.45);
    ctx.stroke();

    // Legs
    ctx.beginPath();
    ctx.moveTo(0, 13);
    ctx.lineTo(-4 - legSwing, 18);
    ctx.moveTo(0, 13);
    ctx.lineTo(4 + legSwing, 18);
    ctx.stroke();
    
    ctx.restore();
  }

  function drawTank(tk) {
    ctx.save();
    ctx.translate(tk.x, tk.y - (tk.jumpOffset || 0));
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;

    if (tk.parachute) {
      ctx.beginPath();
      ctx.arc(0, -16, 13, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-12, -16);
      ctx.lineTo(-6, -2);
      ctx.moveTo(12, -16);
      ctx.lineTo(6, -2);
      ctx.moveTo(0, -16);
      ctx.lineTo(0, -2);
      ctx.stroke();
    }

    // Lower hull + glacis
    ctx.beginPath();
    ctx.moveTo(-15, 4);
    ctx.lineTo(-11, -1);
    ctx.lineTo(11, -1);
    ctx.lineTo(15, 4);
    ctx.lineTo(12, 9);
    ctx.lineTo(-12, 9);
    ctx.closePath();
    ctx.stroke();

    // Track units
    ctx.beginPath();
    ctx.moveTo(-17, 10);
    ctx.lineTo(17, 10);
    ctx.lineTo(17, 14);
    ctx.lineTo(-17, 14);
    ctx.closePath();
    ctx.stroke();

    // Road wheels
    ctx.beginPath();
    ctx.arc(-11, 12, 1.6, 0, Math.PI * 2);
    ctx.arc(-5, 12, 1.6, 0, Math.PI * 2);
    ctx.arc(1, 12, 1.6, 0, Math.PI * 2);
    ctx.arc(7, 12, 1.6, 0, Math.PI * 2);
    ctx.arc(13, 12, 1.6, 0, Math.PI * 2);
    ctx.stroke();

    // Turret and gun
    ctx.beginPath();
    ctx.moveTo(-6, -7);
    ctx.lineTo(4, -7);
    ctx.lineTo(8, -4);
    ctx.lineTo(4, -1);
    ctx.lineTo(-6, -1);
    ctx.lineTo(-8, -4);
    ctx.closePath();
    ctx.moveTo(8, -4);
    ctx.lineTo(19, -6);
    ctx.moveTo(12, -5);
    ctx.lineTo(19, -5);
    ctx.moveTo(-2, -7);
    ctx.lineTo(-2, -1);
    ctx.stroke();

    const pipStep = 2.1;
    const startX = -10;
    const y = -7;
    for (let i = 0; i < tk.maxHp; i++) {
      if (i >= tk.hp) break;
      const x = startX + i * pipStep;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 1.2, y);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawJammerPod(j) {
    ctx.save();
    ctx.translate(j.x, j.y);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;

    if (j.parachute) {
      ctx.beginPath();
      ctx.arc(0, -14, 12, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-11, -14);
      ctx.lineTo(-5, -2);
      ctx.moveTo(11, -14);
      ctx.lineTo(5, -2);
      ctx.moveTo(0, -14);
      ctx.lineTo(0, -2);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(-8, -2);
    ctx.lineTo(8, -2);
    ctx.lineTo(10, 4);
    ctx.lineTo(0, 10);
    ctx.lineTo(-10, 4);
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.lineTo(0, 7);
    ctx.moveTo(-4, 2);
    ctx.lineTo(4, 2);
    ctx.moveTo(-3, 5);
    ctx.lineTo(3, 5);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(0, -8);
    ctx.moveTo(-2.5, -8);
    ctx.lineTo(2.5, -8);
    ctx.stroke();

    ctx.restore();
  }

  function drawBullets() {
    ctx.fillStyle = '#fff';
    for (const b of bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawParticles() {
    for (const p of particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#fff';
      ctx.fillStyle = '#fff';
      if (p.ring) {
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 + (1 - alpha) * 1.2), 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.spark) {
        const trail = 0.045;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * trail, p.y - p.vy * trail);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawVignette() {
    const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.75);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  function render() {
    ctx.clearRect(0, 0, w, h);

    if (flashTimer > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(0, 0, w, h);
    }

    drawGround();
    for (const plane of planes) drawAttackPlane(plane);
    for (const heli of helicopters) drawHelicopter(heli);
    for (const t of troopers) drawTrooper(t);
    for (const t of groundTroopers) drawTrooper(t);
    for (const tk of tanks) drawTank(tk);
    for (const j of jammers) drawJammerPod(j);
    for (const m of missiles) drawMissile(m);
    drawBullets();
    drawTurret();
    drawParticles();
    if (jammedTimer > 0) {
      const a = Math.min(0.12, 0.03 + (jammedTimer / 6) * 0.09);
      ctx.save();
      ctx.strokeStyle = `rgba(255,255,255,${a})`;
      ctx.lineWidth = 1;
      const phase = performance.now() * 0.03;
      for (let y = 0; y < h; y += 11) {
        ctx.beginPath();
        ctx.moveTo(0, y + Math.sin((y + phase) * 0.2) * 2);
        ctx.lineTo(w, y + Math.cos((y + phase) * 0.2) * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
    drawScanlines();
    drawVignette();
  }

  function loop(ts) {
    if (!lastTs) lastTs = ts;
    const dt = Math.min(0.033, (ts - lastTs) / 1000);
    lastTs = ts;
    if (running) update(dt);
    render();
    requestAnimationFrame(loop);
  }

  function getPoint(e) {
    return { x: e.clientX, y: e.clientY };
  }

  function onPointerStart(e) {
    e.preventDefault();
    if (activePointerId !== null && e.pointerId !== activePointerId) return;
    activePointerId = e.pointerId;
    canvas.setPointerCapture(e.pointerId);
    const p = getPoint(e);
    pointerDown = true;
    aimAt(p.x, p.y);
    if (running && fireCooldown <= 0) {
      fireBullet();
      fireCooldown = 0.12;
    }
  }

  function onPointerMove(e) {
    if (activePointerId !== null && e.pointerId !== activePointerId) return;
    e.preventDefault();
    const p = getPoint(e);
    aimAt(p.x, p.y);
  }

  function onPointerEnd(e) {
    if (activePointerId !== null && e.pointerId !== activePointerId) return;
    e.preventDefault();
    if (activePointerId !== null && canvas.hasPointerCapture(activePointerId)) {
      canvas.releasePointerCapture(activePointerId);
    }
    activePointerId = null;
    pointerDown = false;
  }

  startBtn.addEventListener('click', () => {
    if (gameOver) {
      splashGraphic.style.display = 'block';
      overlayTitle.innerHTML = initialTitle;
      overlaySub.innerHTML = initialSub;
      startBtn.textContent = 'Press Start';
    }
    overlay.classList.remove('show');
    resetGame();
    running = true;
    pointerDown = false;
    activePointerId = null;
    wrap.style.pointerEvents = 'auto';
  });

  window.addEventListener('resize', resize);
  canvas.addEventListener('pointerdown', onPointerStart, { passive: false });
  canvas.addEventListener('pointermove', onPointerMove, { passive: false });
  canvas.addEventListener('pointerup', onPointerEnd, { passive: false });
  canvas.addEventListener('pointercancel', onPointerEnd, { passive: false });

  resize();
  aimAt(w * 0.5, h * 0.35);
  render();
  requestAnimationFrame(loop);
})();
