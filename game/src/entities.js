// Entities — traffic cars, pedestrians, police and rival gang members, plus
// bullets and particles. All AI is simple and local: no pathfinding library.
import { WORLD, CAR_TYPES, clamp, angleDiff, dist2, rand } from './config.js';
import { hitBuilding, nearestRoadPoint } from './city.js';

let uid = 1;

export function makeCar(x, y, angle, typeIndex, opts = {}) {
  const t = CAR_TYPES[typeIndex % CAR_TYPES.length];
  return {
    id: uid++, kind: 'car', x, y, angle, speed: 0,
    type: t, color: opts.color || t.color, name: t.name,
    police: !!opts.police, traffic: !!opts.traffic, parked: !!opts.parked,
    health: 100, driver: opts.driver !== false,
    targetAngle: angle, stuck: 0, honk: 0,
    // traffic AI: follow a road line, turn at intersections
    roadVertical: opts.roadVertical ?? true, roadPos: opts.roadPos ?? x,
    wanted: false,
  };
}

export function makePed(x, y, opts = {}) {
  const palette = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1'];
  return {
    id: uid++, kind: 'ped', x, y, angle: Math.random() * Math.PI * 2,
    speed: 30 + Math.random() * 40, color: palette[Math.floor(Math.random() * palette.length)],
    health: 30, state: 'walk', // walk | flee | dead | taxi | fare
    tx: x, ty: y, retarget: 0, gang: !!opts.gang, cop: !!opts.cop,
    taxi: !!opts.taxi, fare: !!opts.fare, panic: 0,
  };
}

export function makeBullet(x, y, angle, fromPlayer) {
  return { x, y, vx: Math.cos(angle) * 620, vy: Math.sin(angle) * 620, life: 0.7, fromPlayer };
}

export function makeParticle(x, y, color, n = 8, speed = 120) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    out.push({ x, y, vx: Math.cos(a) * speed * (0.4 + Math.random()), vy: Math.sin(a) * speed * (0.4 + Math.random()), life: 0.4 + Math.random() * 0.4, max: 0.8, color, size: 2 + Math.random() * 3 });
  }
  return out;
}

// --- Traffic ---
export function updateTrafficCar(car, dt, city, player) {
  if (car.parked || car.police) return;
  // drive along its road line; at an intersection pick a new direction sometimes
  const lane = car.roadVertical ? 26 : -26;
  const speedTarget = 95 + (car.id % 5) * 12;
  car.speed += (speedTarget - car.speed) * dt * 0.8;
  let nx = car.x + Math.cos(car.angle) * car.speed * dt;
  let ny = car.y + Math.sin(car.angle) * car.speed * dt;
  // stay on the road: steer back toward the lane centre
  const rp = nearestRoadPoint(city, car.x, car.y);
  if (car.roadVertical) {
    const wantX = rp.x + (Math.cos(car.angle) > 0 ? lane : -lane) * 0 + (car.id % 2 === 0 ? 22 : -22);
    car.angle += clamp(angleDiff(car.angle, Math.atan2(Math.sin(car.angle), Math.cos(car.angle))), -1, 1) * 0;
    // snap gently toward lane
    car.x += clamp(wantX - car.x, -1, 1) * car.speed * dt * 0.25;
    const targetAngle = Math.sin(car.angle) >= 0 ? Math.PI / 2 : -Math.PI / 2;
    car.angle += angleDiff(car.angle, targetAngle) * dt * 1.2;
    nx = car.x; ny = car.y + Math.sin(car.angle) * car.speed * dt;
  } else {
    const wantY = rp.y + (car.id % 2 === 0 ? 22 : -22);
    car.y += clamp(wantY - car.y, -1, 1) * car.speed * dt * 0.25;
    const targetAngle = Math.cos(car.angle) >= 0 ? 0 : Math.PI;
    car.angle += angleDiff(car.angle, targetAngle) * dt * 1.2;
    nx = car.x + Math.cos(car.angle) * car.speed * dt; ny = car.y;
  }
  // turn at intersections: when close to a cross street, sometimes turn
  const nearV = city.roadsV.some((rx) => Math.abs(car.x - rx) < 30);
  const nearH = city.roadsH.some((ry) => Math.abs(car.y - ry) < 30);
  if ((nearV || nearH) && Math.random() < dt * 0.25) {
    car.roadVertical = !car.roadVertical;
    car.angle = car.roadVertical ? (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (Math.random() < 0.5 ? 0 : Math.PI);
  }
  // keep inside the world; bounce back at the edge
  if (nx < 60 || nx > WORLD.width - 60 || ny < 60 || ny > WORLD.height - 60) {
    car.angle += Math.PI;
    return;
  }
  // avoid buildings: if the next step hits one, turn around
  if (hitBuilding(city, nx, ny, 20)) { car.angle += Math.PI * 0.9; return; }
  car.x = nx; car.y = ny;
  // slow for the player car ahead (crude: if very close, brake)
  if (player && player.car) {
    const d = dist2(car.x, car.y, player.car.x, player.car.y);
    if (d < 70 * 70) car.speed *= (1 - dt * 3);
  }
}

// --- Pedestrians ---
export function updatePed(ped, dt, city, danger) {
  if (ped.state === 'dead') return;
  ped.retarget -= dt;
  if (ped.state === 'flee' || ped.panic > 0) {
    ped.panic = Math.max(0, ped.panic - dt);
    if (ped.retarget <= 0) {
      const a = Math.atan2(ped.y - danger.y, ped.x - danger.x) + (Math.random() - 0.5);
      ped.tx = ped.x + Math.cos(a) * 220; ped.ty = ped.y + Math.sin(a) * 220;
      ped.retarget = 0.8 + Math.random();
    }
    movePedToward(ped, dt, city, 190);
    if (ped.panic <= 0) ped.state = 'walk';
    return;
  }
  if (ped.retarget <= 0) {
    // wander along sidewalks: pick a nearby road point and walk beside it
    const rp = nearestRoadPoint(city, ped.x, ped.y);
    const along = (Math.random() - 0.5) * 500;
    if (rp.vertical) { ped.tx = rp.x + (Math.random() < 0.5 ? 62 : -62); ped.ty = ped.y + along; }
    else { ped.tx = ped.x + along; ped.ty = rp.y + (Math.random() < 0.5 ? 62 : -62); }
    ped.retarget = 3 + Math.random() * 4;
  }
  movePedToward(ped, dt, city, ped.speed);
}

function movePedToward(ped, dt, city, speed) {
  const dx = ped.tx - ped.x, dy = ped.ty - ped.y;
  const d = Math.hypot(dx, dy);
  if (d < 8) return;
  const a = Math.atan2(dy, dx);
  ped.angle = a;
  const nx = ped.x + Math.cos(a) * speed * dt;
  const ny = ped.y + Math.sin(a) * speed * dt;
  if (!hitBuilding(city, nx, ny, 6)) { ped.x = nx; ped.y = ny; }
  ped.x = clamp(ped.x, 20, WORLD.width - 20);
  ped.y = clamp(ped.y, 20, WORLD.height - 20);
}

// --- Police ---
export function updatePoliceCar(car, dt, target, city) {
  // chase: steer toward the target, faster than traffic, rams on contact
  const want = Math.atan2(target.y - car.y, target.x - car.x);
  const diff = angleDiff(car.angle, want);
  car.angle += clamp(diff, -2.6 * dt, 2.6 * dt);
  const top = 265;
  car.speed += ((Math.abs(diff) > 1.2 ? 140 : top) - car.speed) * dt * 1.1;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (!hitBuilding(city, nx, ny, 18)) { car.x = nx; car.y = ny; }
  else { car.angle += Math.PI * 0.5; car.speed *= 0.5; }
  car.x = clamp(car.x, 30, WORLD.width - 30);
  car.y = clamp(car.y, 30, WORLD.height - 30);
}

export function updateCopPed(cop, dt, target, city) {
  const d = Math.hypot(target.x - cop.x, target.y - cop.y);
  if (d < 26) { cop.state = 'attack'; return 'attack'; }
  cop.tx = target.x; cop.ty = target.y;
  movePedToward(cop, dt, city, 205);
  return 'chase';
}

// --- Gang enemies ---
export function updateGangPed(gang, dt, target, city, bullets, shootCooldown) {
  const d = Math.hypot(target.x - gang.x, target.y - gang.y);
  gang.angle = Math.atan2(target.y - gang.y, target.x - gang.x);
  if (d > 320) {
    gang.tx = target.x; gang.ty = target.y;
    movePedToward(gang, dt, city, 150);
  } else if (d < 140) {
    gang.tx = gang.x - Math.cos(gang.angle) * 100; gang.ty = gang.y - Math.sin(gang.angle) * 100;
    movePedToward(gang, dt, city, 120);
  }
  if (d < 380 && shootCooldown <= 0) {
    const spread = (Math.random() - 0.5) * 0.25;
    bullets.push(makeBullet(gang.x, gang.y, gang.angle + spread, false));
    return 0.9 + Math.random() * 0.7;
  }
  return shootCooldown;
}
