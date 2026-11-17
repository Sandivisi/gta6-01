// Game — the Solmar Bay loop: state machine, driving, wanted level, police,
// combat, missions, taxi fares, collectibles, camera and saving.
import { WORLD, PLAYER, CAR_TYPES, clamp, lerp, dist2, angleDiff, WANTED_DECAY_SECONDS } from './config.js';
import { buildCity, hitBuilding, nearestRoadPoint, districtNameAt } from './city.js';
import { keys, mouse, wasPressed, isDown, moveVector, endFrame } from './input.js';
import { initAudio, resumeAudio, toggleMute, setEngine, setSiren, sfx } from './audio.js';
import { makeCar, makePed, makeBullet, makeParticle, updateTrafficCar, updatePed, updatePoliceCar, updateCopPed, updateGangPed } from './entities.js';
import { missionByIndex, totalMissions, STORY_INTRO } from './missions.js';
import { saveGame, loadSave, hasSave } from './save.js';
import { drawWorld, drawHUD, drawMenu, drawPause, drawEndCard } from './render.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.viewW = 1280; this.viewH = 720;
    this.city = buildCity(20261117);
    this.state = 'menu'; // menu | playing | paused | busted | wasted | complete
    this.time = 0;
    this.clockMinutes = 9 * 60 + 12; // game clock starts 09:12
    this.money = 250;
    this.wanted = 0;
    this.wantedTimer = 0;
    this.missionIndex = 0;
    this.missionStep = 0;
    this.missionTarget = null;
    this.missionKills = 0;
    this.missionActive = false;
    this.player = {
      x: 3560, y: 480, angle: -Math.PI / 2, speed: 0,
      health: PLAYER.health, armor: 0, ammo: 24, weapon: 'fists',
      dead: false, inCar: false, shootCooldown: 0, punchCooldown: 0,
    };
    this.car = null; // car the player is driving
    this.cars = [];
    this.peds = [];
    this.bullets = [];
    this.particles = [];
    this.camera = { x: this.player.x, y: this.player.y, zoom: 1 };
    this.stats = { kills: 0, carsStolen: 0, fares: 0, playSeconds: 0 };
    this.toast = ''; this.toastTime = 0;
    this.dialogue = null; this.dialogueTime = 0;
    this.policeSpawnTimer = 0;
    this.trafficTimer = 0;
    this.pedTimer = 0;
    this.gangShootTimer = 0;
    this.taxi = null; // active taxi fare {ped, tx, ty, paid}
    this.escapeTimer = 0;
    this.mouse = mouse;
    this.saveInfo = null;
    this.menuButtons = [];
    this.pauseButtons = [];
    this.mutedForShot = false;
    this.last = performance.now();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.seedWorld();
    const sv = loadSave();
    if (sv) this.saveInfo = 'Mission ' + (sv.missionIndex + 1) + ' • $' + sv.money.toLocaleString('en-US') + ' • ' + new Date(sv.savedAt).toLocaleDateString();
    this.layoutButtons();
    this.updateMissionTarget();
  }

  resize() {
    this.viewW = window.innerWidth; this.viewH = window.innerHeight;
    this.canvas.width = this.viewW; this.canvas.height = this.viewH;
    this.layoutButtons();
  }

  layoutButtons() {
    const vw = this.viewW, vh = this.viewH;
    const bw = 320, bh = 48;
    this.menuButtons = [
      { id: 'new', label: '▶  NEW GAME', x: vw / 2 - bw / 2, y: vh / 2 - 30, w: bw, h: bh },
      { id: 'continue', label: '↻  CONTINUE  (saved game)', x: vw / 2 - bw / 2, y: vh / 2 + 30, w: bw, h: bh },
      { id: 'how', label: '?  HOW TO PLAY', x: vw / 2 - bw / 2, y: vh / 2 + 90, w: bw, h: bh },
    ];
    this.pauseButtons = [
      { id: 'resume', label: '▶  RESUME', x: vw / 2 - bw / 2, y: vh / 2 + 10, w: bw, h: bh },
      { id: 'save', label: '💾  SAVE GAME', x: vw / 2 - bw / 2, y: vh / 2 + 70, w: bw, h: bh },
      { id: 'quit', label: '🏠  QUIT TO MENU', x: vw / 2 - bw / 2, y: vh / 2 + 130, w: bw, h: bh },
    ];
  }

  seedWorld() {
    // parked cars around the city (stealable), a starter car near the pier
    const spots = [
      [3560, 560, 2], [1150, 620, 2], [1750, 1450, 3], [2950, 1680, 0],
      [800, 1000, 1], [2100, 800, 5], [3300, 1500, 3], [2500, 2400, 4],
      [600, 2100, 0], [1500, 2600, 1], [3700, 2400, 5], [2600, 400, 4],
    ];
    for (const [x, y, ti] of spots) {
      this.cars.push(makeCar(x, y, (Math.random() - 0.5) * Math.PI, ti, { parked: true }));
    }
    this.spawnTrafficNear(2000, 1400, 10);
    this.spawnPedsNear(2000, 1400, 14);
  }

  spawnTrafficNear(x, y, n) {
    for (let i = 0; i < n; i++) {
      const rp = nearestRoadPoint(this.city, x + (Math.random() - 0.5) * 900, y + (Math.random() - 0.5) * 700);
      const vertical = rp.vertical;
      const angle = vertical ? (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (Math.random() < 0.5 ? 0 : Math.PI);
      const car = makeCar(rp.x + (vertical ? (Math.random() < 0.5 ? 22 : -22) : 0), rp.y + (vertical ? 0 : (Math.random() < 0.5 ? 22 : -22)), angle, Math.floor(Math.random() * CAR_TYPES.length), { traffic: true, roadVertical: vertical });
      car.speed = 90;
      this.cars.push(car);
    }
  }

  spawnPedsNear(x, y, n) {
    for (let i = 0; i < n; i++) {
      this.peds.push(makePed(
        clamp(x + (Math.random() - 0.5) * 800, 40, WORLD.width - 40),
        clamp(y + (Math.random() - 0.5) * 600, 40, WORLD.height - 40),
      ));
    }
  }

  spawnParkedNear(x, y, n) {
    for (let i = 0; i < n; i++) {
      const c = makeCar(x + (Math.random() - 0.5) * 500, y + (Math.random() - 0.5) * 400, Math.random() * Math.PI, Math.floor(Math.random() * CAR_TYPES.length), { parked: true });
      this.cars.push(c);
    }
  }

  spawnPoliceCar(x, y) {
    const car = makeCar(x, y, 0, 0, { police: true, color: '#1c2733' });
    car.speed = 120;
    this.cars.push(car);
    return car;
  }

  spawnGang(x, y, n) {
    for (let i = 0; i < n; i++) {
      const g = makePed(x + (Math.random() - 0.5) * 160, y + (Math.random() - 0.5) * 160, { gang: true });
      g.health = 50;
      this.peds.push(g);
    }
  }

  spawnCopPed(x, y) {
    const c = makePed(x, y, { cop: true });
    c.health = 60;
    this.peds.push(c);
    return c;
  }

  // ---------- wanted level ----------
  setWanted(n) {
    const before = this.wanted;
    this.wanted = clamp(n, 0, 5);
    if (this.wanted > before) this.wantedTimer = 0;
    setSiren(this.wanted > 0);
  }
  addWanted(n) { this.setWanted(this.wanted + n); }

  currentMission() { return missionByIndex(this.missionIndex); }

  updateMissionTarget() {
    const m = this.currentMission();
    if (!m) { this.missionTarget = null; return; }
    const step = m.steps[this.missionStep];
    if (!step) { this.missionTarget = null; return; }
    this.missionTarget = { x: step.x, y: step.y };
  }

  startMission(i) {
    this.missionIndex = i; this.missionStep = 0; this.missionKills = 0;
    const m = this.currentMission();
    if (!m) return;
    this.showDialogue('MARA', m.brief);
    this.toast = m.title + ' — ' + m.steps[0].text;
    this.toastTime = 5;
    this.updateMissionTarget();
    sfx.mission();
    // Mission 5 opens with the whole department on the player.
    if (m.id === 5) this.setWanted(3);
  }

  completeMissionStep() {
    const m = this.currentMission();
    if (!m) return;
    this.missionStep++;
    sfx.cash();
    if (this.missionStep >= m.steps.length) {
      this.money += m.reward;
      this.showDialogue('MARA', m.outro);
      this.toast = 'MISSION COMPLETE  •  +$' + m.reward.toLocaleString('en-US');
      this.toastTime = 6;
      this.missionIndex++;
      this.missionStep = 0;
      saveGame(this); // autosave after every mission
      if (this.missionIndex >= totalMissions()) {
        this.state = 'complete';
        return;
      }
      this.startMission(this.missionIndex);
    } else {
      const step = m.steps[this.missionStep];
      this.toast = step.text;
      this.toastTime = 5;
      this.updateMissionTarget();
      // Mission 6: taking the truck triggers the police escort.
      if (m.id === 6 && step.type === 'escape') this.setWanted(4);
    }
  }

  showDialogue(who, text) { this.dialogue = { who, text }; this.dialogueTime = 7; }
  showToast(text, seconds = 4) { this.toast = text; this.toastTime = seconds; }

  // ---------- entering / stealing cars ----------
  nearestCar(maxDist = 70) {
    let best = null, bestD = maxDist * maxDist;
    for (const c of this.cars) {
      const d = dist2(this.player.x, this.player.y, c.x, c.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  enterCar(car) {
    this.car = car;
    car.parked = false; car.traffic = false;
    this.player.inCar = true;
    this.player.x = car.x; this.player.y = car.y;
    sfx.door();
    if (car.police) { this.addWanted(1); this.showToast('You stole a police cruiser! The PD is coming.', 4); }
  }

  exitCar() {
    if (!this.car) return;
    const car = this.car;
    const side = this.player.angle + Math.PI / 2;
    this.player.x = car.x + Math.cos(side) * 40;
    this.player.y = car.y + Math.sin(side) * 40;
    if (hitBuilding(this.city, this.player.x, this.player.y, 10)) {
      this.player.x = car.x - Math.cos(side) * 40;
      this.player.y = car.y - Math.sin(side) * 40;
    }
    car.speed *= 0.2;
    this.car = null;
    this.player.inCar = false;
    sfx.door();
  }

  stealCar(car) {
    const wasParked = car.parked;
    this.stats.carsStolen++;
    this.enterCar(car);
    if (wasParked || car.traffic) {
      this.addWanted(1);
      this.showToast('Car stolen! +1 ★ wanted', 3);
    }
    // mission 2 / 6 steal steps resolve when the right car type is taken
    const m = this.currentMission();
    const step = m && m.steps[this.missionStep];
    if (step && step.type === 'steal' && car.name === step.carType) this.completeMissionStep();
  }

  // ---------- combat ----------
  shoot() {
    const p = this.player;
    if (p.shootCooldown > 0 || p.weapon !== 'pistol' || p.ammo <= 0) return;
    p.ammo--;
    p.shootCooldown = 0.28;
    const a = p.angle + (Math.random() - 0.5) * 0.05;
    this.bullets.push(makeBullet(p.x + Math.cos(a) * 24, p.y + Math.sin(a) * 24, a, true));
    sfx.gunshot();
    this.addWanted(0); // shooting in public draws attention only when it hits
    this.peds.forEach((ped) => { if (ped.state !== 'dead' && dist2(ped.x, ped.y, p.x, p.y) < 500 * 500) { ped.state = 'flee'; ped.panic = 3; } });
  }

  punch() {
    const p = this.player;
    if (p.punchCooldown > 0) return;
    p.punchCooldown = 0.4;
    sfx.punch();
    for (const ped of this.peds) {
      if (ped.state === 'dead') continue;
      if (dist2(ped.x, ped.y, p.x, p.y) < 46 * 46) {
        ped.health -= 20;
        this.particles.push(...makeParticle(ped.x, ped.y, '#ffdd55', 6, 90));
        if (ped.health <= 0) this.killPed(ped, true);
        else { ped.state = 'flee'; ped.panic = 2; }
      }
    }
  }

  killPed(ped, byPlayer) {
    ped.state = 'dead';
    this.particles.push(...makeParticle(ped.x, ped.y, '#c0392b', 12, 140));
    if (byPlayer) {
      this.stats.kills++;
      if (!ped.gang && !ped.cop) this.addWanted(1);
      if (ped.cop) this.addWanted(2);
      const m = this.currentMission();
      const step = m && m.steps[this.missionStep];
      if (step && step.type === 'kill') {
        this.missionKills++;
        this.showToast('Guards down: ' + this.missionKills + ' / ' + step.count, 3);
        if (this.missionKills >= step.count) this.completeMissionStep();
      }
    }
  }

  damagePlayer(amount, source) {
    const p = this.player;
    if (p.dead || this.state !== 'playing') return;
    let rest = amount;
    if (p.armor > 0) { const absorbed = Math.min(p.armor, rest); p.armor -= absorbed; rest -= absorbed; }
    p.health -= rest;
    this.particles.push(...makeParticle(p.x, p.y, '#ff5555', 6, 100));
    if (p.health <= 0) {
      p.health = 0;
      this.wasted();
    }
  }

  wasted() {
    this.player.dead = true;
    this.state = 'wasted';
    setSiren(false);
    sfx.fail();
    this.money = Math.max(0, this.money - 200);
  }

  busted() {
    this.state = 'busted';
    setSiren(false);
    sfx.busted();
    this.money = Math.max(0, this.money - 150);
    this.setWanted(0);
  }

  respawn() {
    const was = this.state;
    const p = this.player;
    p.health = 100; p.armor = 25; p.ammo = Math.max(p.ammo, 12);
    p.dead = false;
    p.x = 2950; p.y = 1680; p.angle = -Math.PI / 2;
    this.car = null; p.inCar = false;
    this.setWanted(0);
    this.state = 'playing';
    this.showToast('You wake up at the garage. -$' + (was === 'wasted' ? 200 : 150) + ' hospital / bail fee.', 5);
    this.camera.x = p.x; this.camera.y = p.y;
  }

  // ---------- taxi side activity ----------
  maybeStartTaxi() {
    if (this.taxi || this.mutedForShot || this.missionIndex >= totalMissions()) return;
    // a waiting fare waves near the player sometimes
    for (const ped of this.peds) {
      if (ped.taxi) return;
    }
    const fare = makePed(this.player.x + (Math.random() - 0.5) * 300, this.player.y + (Math.random() - 0.5) * 300, { fare: true });
    fare.state = 'walk';
    this.peds.push(fare);
    this.taxi = { ped: fare, phase: 'pickup', paid: 120 + Math.floor(Math.random() * 180) };
    this.showToast('🚕 A fare is waving nearby — drive to them and press E', 5);
  }

  // ---------- main loop ----------
  frame(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000 || 0.016);
    this.last = now;
    if (this.state === 'playing') this.update(dt);
    this.render();
    endFrame();
    requestAnimationFrame((t) => this.frame(t));
  }

  update(dt) {
    this.time += dt;
    this.stats.playSeconds += dt;
    this.clockMinutes += dt * 0.9; // ~1 game hour per 66 real seconds
    if (this.clockMinutes >= 1440) this.clockMinutes -= 1440;
    const p = this.player;
    p.shootCooldown = Math.max(0, p.shootCooldown - dt);
    p.punchCooldown = Math.max(0, p.punchCooldown - dt);
    if (this.toastTime > 0) this.toastTime -= dt;
    if (this.dialogueTime > 0) this.dialogueTime -= dt;

    // mouse aim (on foot)
    if (!this.car) {
      const wx = this.camera.x + (mouse.x - this.viewW / 2) / this.camera.zoom;
      const wy = this.camera.y + (mouse.y - this.viewH / 2) / this.camera.zoom;
      mouse.worldX = wx; mouse.worldY = wy;
      p.angle = Math.atan2(wy - p.y, wx - p.x);
    }

    // global keys
    if (wasPressed('p') || wasPressed('escape')) { this.state = 'paused'; return; }
    if (wasPressed('m')) { const m = toggleMute(); this.showToast(m ? 'Sound muted' : 'Sound on', 2); }
    if (wasPressed('e')) this.handleEnterExit();
    if (wasPressed('h') && this.car) sfx.horn();

    if (this.car) this.updateDriving(dt);
    else this.updateOnFoot(dt);

    // shooting / punching (weapon switch first, so a same-frame 2+F works)
    if (!this.car) {
      if (wasPressed('1')) { p.weapon = 'fists'; this.showToast('Fists', 1.5); }
      if (wasPressed('2')) { p.weapon = 'pistol'; this.showToast('Pistol — ' + p.ammo + ' rounds', 1.5); }
      if (wasPressed('f') || mouse.clicked) this.shoot();
      if (wasPressed(' ') || wasPressed('space')) this.punch();
    }

    this.updateWorld(dt);
    this.updateWanted(dt);
    this.updateMission(dt);
    this.updateCamera(dt);
    setEngine(this.car ? Math.abs(this.car.speed) / this.car.type.top : 0, !!this.car);
  }

  handleEnterExit() {
    if (this.car) { this.exitCar(); return; }
    // A car next to the player takes priority over a waving taxi fare.
    const car = this.nearestCar(72);
    if (car) { this.stealCar(car); return; }
    // taxi fare pickup
    if (this.taxi && this.taxi.phase === 'pickup' && dist2(this.player.x, this.player.y, this.taxi.ped.x, this.taxi.ped.y) < 90 * 90) {
      this.taxi.phase = 'riding';
      this.taxi.tx = 600 + Math.random() * 2600; this.taxi.ty = 400 + Math.random() * 2000;
      this.showToast('Fare aboard! Drive to the green marker — $' + this.taxi.paid, 4);
      this.taxiTarget = { x: this.taxi.tx, y: this.taxi.ty };
      this.peds = this.peds.filter((q) => q !== this.taxi.ped);
      return;
    }
  }

  updateOnFoot(dt) {
    const p = this.player;
    const mv = moveVector();
    const running = isDown('shift');
    const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
    let nx = p.x + mv.x * speed * dt;
    let ny = p.y + mv.y * speed * dt;
    if (mv.active) {
      // keep facing the mouse when armed, else face movement
      if (p.weapon !== 'pistol') p.angle = Math.atan2(mv.y, mv.x);
    }
    if (!hitBuilding(this.city, nx, p.y, 12)) p.x = nx;
    if (!hitBuilding(this.city, p.x, ny, 12)) p.y = ny;
    p.x = clamp(p.x, 20, WORLD.width - 20);
    p.y = clamp(p.y, 20, WORLD.height - 20);
    // walk over a smuggler package
    for (const pkg of this.city.packages) {
      if (!pkg.taken && dist2(p.x, p.y, pkg.x, pkg.y) < 30 * 30) {
        pkg.taken = true;
        this.money += 150;
        sfx.pickup();
        const left = this.city.packages.filter((q) => !q.taken).length;
        this.showToast('Smuggler package found! +$150  •  ' + left + ' left in the city', 4);
      }
    }
    // taxi fare completes on arrival
    if (this.taxi && this.taxi.phase === 'riding' && this.car) {
      const d = Math.hypot(this.taxi.tx - p.x, this.taxi.ty - p.y);
      if (d < 110) {
        this.money += this.taxi.paid;
        this.stats.fares++;
        sfx.cash();
        this.showToast('Fare delivered! +$' + this.taxi.paid, 4);
        this.taxi = null;
        this.taxiTarget = null;
        this.updateMissionTarget();
      }
    }
  }

  updateDriving(dt) {
    const car = this.car;
    const p = this.player;
    const fwd = isDown('w') || isDown('arrowup');
    const back = isDown('s') || isDown('arrowdown');
    const steerL = isDown('a') || isDown('arrowleft');
    const steerR = isDown('d') || isDown('arrowright');
    const handbrake = isDown(' ');
    const dir = car.speed >= 0 ? 1 : -1;
    if (fwd) car.speed += car.type.accel * dt;
    if (back) car.speed -= car.type.accel * 0.75 * dt;
    if (!fwd && !back) car.speed -= car.speed * 0.9 * dt;
    if (handbrake) car.speed -= car.speed * 2.4 * dt;
    car.speed = clamp(car.speed, -car.type.top * 0.45, car.type.top);
    const steer = (steerL ? -1 : 0) + (steerR ? 1 : 0);
    const grip = handbrake ? car.type.grip * 0.45 : car.type.grip;
    car.angle += steer * grip * (Math.abs(car.speed) / car.type.top) * dir * dt * 1.9;
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const b = hitBuilding(this.city, nx, ny, 16);
    if (b) {
      if (Math.abs(car.speed) > 120) {
        sfx.crash();
        this.particles.push(...makeParticle(nx, ny, '#ffcc00', 10, 160));
        this.damagePlayer(Math.abs(car.speed) * 0.04, 'crash');
        this.addWanted(0);
      }
      car.speed *= -0.25;
    } else {
      car.x = nx; car.y = ny;
    }
    car.x = clamp(car.x, 30, WORLD.width - 30);
    car.y = clamp(car.y, 30, WORLD.height - 30);
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    // run over pedestrians (a crime)
    for (const ped of this.peds) {
      if (ped.state === 'dead') continue;
      if (dist2(ped.x, ped.y, car.x, car.y) < 34 * 34 && Math.abs(car.speed) > 60) {
        this.killPed(ped, true);
        sfx.crash();
      }
    }
    // bump traffic cars
    for (const other of this.cars) {
      if (other === car) continue;
      const d2 = dist2(other.x, other.y, car.x, car.y);
      if (d2 < 52 * 52) {
        const push = Math.atan2(other.y - car.y, other.x - car.x);
        other.x += Math.cos(push) * 60 * dt * 10;
        other.y += Math.sin(push) * 60 * dt * 10;
        if (Math.abs(car.speed) > 150) { other.health -= 20; car.speed *= 0.7; sfx.crash(); this.particles.push(...makeParticle(other.x, other.y, '#aaaaaa', 8, 120)); }
        if (other.health <= 0 && !other.police) { other.parked = true; other.traffic = false; }
      }
    }
    // mission drive/deliver steps
    const m = this.currentMission();
    const step = m && m.steps[this.missionStep];
    if (step && (step.type === 'deliver' || step.type === 'drive')) {
      const d = Math.hypot(step.x - p.x, step.y - p.y);
      if (d < step.radius) this.completeMissionStep();
    }
    // taxi fare completes while driving too
    if (this.taxi && this.taxi.phase === 'riding') {
      const d = Math.hypot(this.taxi.tx - p.x, this.taxi.ty - p.y);
      if (d < 110) {
        this.money += this.taxi.paid;
        this.stats.fares++;
        sfx.cash();
        this.showToast('Fare delivered! +$' + this.taxi.paid, 4);
        this.taxi = null;
        this.taxiTarget = null;
        this.updateMissionTarget();
      }
    }
  }

  updateWorld(dt) {
    const p = this.player;
    // traffic + police cars
    for (const car of this.cars) {
      if (car === this.car) continue;
      if (car.police) updatePoliceCar(car, dt, { x: p.x, y: p.y }, this.city);
      else updateTrafficCar(car, dt, this.city, this);
    }
    // police ramming the player car
    for (const car of this.cars) {
      if (!car.police) continue;
      if (dist2(car.x, car.y, p.x, p.y) < 46 * 46) {
        if (this.car) { this.car.speed *= 0.85; this.damagePlayer(2, 'ram'); }
        else this.damagePlayer(14 * dt, 'cop');
      }
    }
    // pedestrians
    const danger = { x: p.x, y: p.y };
    for (const ped of this.peds) {
      if (ped.gang) {
        this.gangShootTimer = updateGangPed(ped, dt, { x: p.x, y: p.y }, this.city, this.bullets, Math.max(0, this.gangShootTimer - dt));
      } else if (ped.cop) {
        const res = updateCopPed(ped, dt, { x: p.x, y: p.y }, this.city);
        if (res === 'attack') this.damagePlayer(14 * dt, 'cop');
      } else {
        updatePed(ped, dt, this.city, danger);
      }
    }
    // bullets
    for (const b of this.bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (hitBuilding(this.city, b.x, b.y, 2)) { b.life = 0; this.particles.push(...makeParticle(b.x, b.y, '#cccccc', 4, 80)); continue; }
      if (b.fromPlayer) {
        for (const ped of this.peds) {
          if (ped.state === 'dead') continue;
          if (dist2(b.x, b.y, ped.x, ped.y) < 20 * 20) {
            ped.health -= 34;
            b.life = 0;
            this.particles.push(...makeParticle(b.x, b.y, '#c0392b', 8, 120));
            if (ped.health <= 0) this.killPed(ped, true);
            break;
          }
        }
        for (const car of this.cars) {
          if (car === this.car || b.life <= 0) continue;
          if (dist2(b.x, b.y, car.x, car.y) < 30 * 30) {
            car.health -= 12; b.life = 0;
            this.particles.push(...makeParticle(b.x, b.y, '#ffcc00', 5, 100));
            if (car.health <= 0) { car.traffic = false; car.parked = true; }
            break;
          }
        }
      } else {
        if (dist2(b.x, b.y, p.x, p.y) < 18 * 18) {
          b.life = 0;
          this.damagePlayer(9, 'bullet');
        }
        if (this.car && dist2(b.x, b.y, this.car.x, this.car.y) < 30 * 30) {
          b.life = 0; this.car.health -= 6;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0 && b.x > 0 && b.x < WORLD.width && b.y > 0 && b.y < WORLD.height);
    // particles
    for (const pt of this.particles) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt; }
    this.particles = this.particles.filter((pt) => pt.life > 0);
    // keep traffic + peds topped up near the player
    this.trafficTimer -= dt;
    if (this.trafficTimer <= 0) {
      this.trafficTimer = 4;
      const near = this.cars.filter((c) => c.traffic && dist2(c.x, c.y, p.x, p.y) < 900 * 900).length;
      if (near < 6) this.spawnTrafficNear(p.x, p.y, 3);
      const nearPeds = this.peds.filter((q) => q.state !== 'dead' && dist2(q.x, q.y, p.x, p.y) < 800 * 800).length;
      if (nearPeds < 8) this.spawnPedsNear(p.x, p.y, 4);
      // occasionally a taxi fare waves
      if (!this.taxi && Math.random() < 0.35) this.maybeStartTaxi();
    }
    // cull far-away traffic/peds (keep arrays bounded)
    if (this.cars.length > 60) this.cars = this.cars.filter((c) => c === this.car || c.police || dist2(c.x, c.y, p.x, p.y) < 1600 * 1600 || c.parked);
    if (this.peds.length > 70) this.peds = this.peds.filter((q) => q.state === 'dead' ? false : dist2(q.x, q.y, p.x, p.y) < 1400 * 1400 || q.gang || q.cop);
  }

  updateWanted(dt) {
    const p = this.player;
    // police presence scales with wanted level
    const wantPoliceCars = this.wanted >= 1 ? Math.min(1 + this.wanted, 5) : 0;
    const policeCars = this.cars.filter((c) => c.police).length;
    this.policeSpawnTimer -= dt;
    if (this.wanted > 0 && policeCars < wantPoliceCars && this.policeSpawnTimer <= 0) {
      this.policeSpawnTimer = 2.5;
      const a = Math.random() * Math.PI * 2;
      this.spawnPoliceCar(clamp(p.x + Math.cos(a) * 700, 60, WORLD.width - 60), clamp(p.y + Math.sin(a) * 700, 60, WORLD.height - 60));
    }
    if (this.wanted > 0 && this.wanted <= 2) {
      const cops = this.peds.filter((q) => q.cop).length;
      if (cops < this.wanted && Math.random() < dt * 0.5) {
        const a = Math.random() * Math.PI * 2;
        this.spawnCopPed(clamp(p.x + Math.cos(a) * 420, 60, WORLD.width - 60), clamp(p.y + Math.sin(a) * 420, 60, WORLD.height - 60));
      }
    }
    // wanted decays when no fresh crime and police cannot see the player
    if (this.wanted > 0) {
      const nearestCop = Math.min(
        ...this.cars.filter((c) => c.police).map((c) => Math.hypot(c.x - p.x, c.y - p.y)),
        ...this.peds.filter((q) => q.cop).map((q) => Math.hypot(q.x - p.x, q.y - p.y)),
        Infinity,
      );
      if (nearestCop > 520) {
        this.wantedTimer += dt;
        if (this.wantedTimer > WANTED_DECAY_SECONDS) {
          this.setWanted(this.wanted - 1);
          this.wantedTimer = 0;
          if (this.wanted === 0) this.showToast('You lost them. The heat is off — for now.', 4);
        }
      } else this.wantedTimer = 0;
    }
    // busted: a cop ped touches the player on foot at wanted >= 2 while player is slow/unarmed
    if (this.wanted >= 2 && !this.car) {
      for (const q of this.peds) {
        if (q.cop && dist2(q.x, q.y, p.x, p.y) < 24 * 24) {
          // only busted if the player is not actively fighting back
          if (p.weapon !== 'pistol' || p.ammo <= 0) { this.busted(); return; }
        }
      }
    }
  }

  updateMission(dt) {
    const m = this.currentMission();
    if (!m) return;
    const step = m.steps[this.missionStep];
    if (!step) return;
    const p = this.player;
    if (step.type === 'goto') {
      if (Math.hypot(step.x - p.x, step.y - p.y) < step.radius) this.completeMissionStep();
    } else if (step.type === 'escape') {
      if (this.wanted === 0) {
        this.escapeTimer += dt;
        if (this.escapeTimer > 2) { this.escapeTimer = 0; this.completeMissionStep(); }
      } else this.escapeTimer = 0;
    }
  }

  updateCamera(dt) {
    const p = this.player;
    const targetZoom = this.car ? 0.82 : 1.0;
    this.camera.zoom = lerp(this.camera.zoom, targetZoom, dt * 2);
    // look ahead in the direction of travel
    let lx = p.x, ly = p.y;
    if (this.car) { lx += Math.cos(this.car.angle) * this.car.speed * 0.35; ly += Math.sin(this.car.angle) * this.car.speed * 0.35; }
    this.camera.x = lerp(this.camera.x, lx, dt * 5);
    this.camera.y = lerp(this.camera.y, ly, dt * 5);
  }

  clockString() {
    const h = Math.floor(this.clockMinutes / 60);
    const m = Math.floor(this.clockMinutes % 60);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

  // ---------- rendering ----------
  render() {
    const ctx = this.ctx;
    const vw = this.viewW, vh = this.viewH;
    ctx.clearRect(0, 0, vw, vh);
    if (this.state === 'menu') {
      drawWorld(ctx, this, vw, vh);
      drawMenu(ctx, this, vw, vh);
      return;
    }
    drawWorld(ctx, this, vw, vh);
    drawHUD(ctx, this, vw, vh);
    if (this.state === 'paused') drawPause(ctx, this, vw, vh);
    if (this.state === 'busted') drawEndCard(ctx, this, vw, vh, 'BUSTED', 'The Solmar PD caught you. Bail: $150. Your crew is waiting at the garage.', '#4da3ff');
    if (this.state === 'wasted') drawEndCard(ctx, this, vw, vh, 'WASTED', 'You blacked out on the streets of Solmar Bay. Hospital bill: $200.', '#ff4d4d');
    if (this.state === 'complete') drawEndCard(ctx, this, vw, vh, 'SOLMAR BAY IS YOURS', 'All six jobs done. The Harlow debt is paid — free roam continues. Press ENTER to keep driving.', '#ffd23f');
  }

  // ---------- menu / pause interaction ----------
  clickAt(x, y) {
    if (this.state === 'menu') {
      for (const b of this.menuButtons) {
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          sfx.click();
          if (b.id === 'new') this.newGame();
          else if (b.id === 'continue') this.continueGame();
          else if (b.id === 'how') { this.showDialogue('HOW TO PLAY', 'WASD move & drive • SHIFT run • E steal/enter car • F or click to shoot • SPACE handbrake/punch • P pause • M mute. Follow the yellow marker. Lose the stars to lose the heat.'); this.dialogueTime = 10; }
          return;
        }
      }
    } else if (this.state === 'paused') {
      for (const b of this.pauseButtons) {
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          sfx.click();
          if (b.id === 'resume') this.state = 'playing';
          else if (b.id === 'save') { if (saveGame(this)) this.showToast('Game saved ✓', 3); else this.showToast('Save failed', 3); }
          else if (b.id === 'quit') { this.state = 'menu'; setSiren(false); }
          return;
        }
      }
    }
  }

  newGame() {
    this.money = 250; this.wanted = 0;
    this.player.health = 100; this.player.armor = 0; this.player.ammo = 24;
    this.player.x = 3560; this.player.y = 480; this.player.dead = false; this.player.inCar = false;
    this.car = null;
    this.stats = { kills: 0, carsStolen: 0, fares: 0, playSeconds: 0 };
    this.missionIndex = 0; this.missionStep = 0; this._m5started = false; this._m6heat = false;
    this.camera.x = this.player.x; this.camera.y = this.player.y;
    this.state = 'playing';
    initAudio(); resumeAudio();
    this.showDialogue('ROOK', STORY_INTRO);
    this.startMission(0);
  }

  continueGame() {
    const sv = loadSave();
    if (!sv) { this.showToast('No saved game yet — start a new game.', 3); return; }
    this.newGame();
    this.money = sv.money;
    this.missionIndex = Math.min(sv.missionIndex, totalMissions() - 1);
    this.missionStep = sv.missionStep || 0;
    this.player.health = sv.health || 100;
    this.player.armor = sv.armor || 0;
    this.player.ammo = sv.ammo || 24;
    this.player.x = sv.x || 3560; this.player.y = sv.y || 480;
    this.stats.kills = sv.kills || 0; this.stats.carsStolen = sv.carsStolen || 0; this.stats.fares = sv.fares || 0;
    this.city.packages.forEach((p, i) => { p.taken = !!(sv.packageTaken && sv.packageTaken[i]); });
    this.camera.x = this.player.x; this.camera.y = this.player.y;
    this.updateMissionTarget();
    this.showToast('Save loaded — ' + this.saveInfo, 4);
  }
}
