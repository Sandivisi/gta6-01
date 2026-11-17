// Render — draws the city, cars, people, effects, HUD, minimap and menus.
// Top-down sun-soaked look: warm light, long soft shadows, saturated streets.
import { WORLD, clamp, lerp } from './config.js';
import { districtNameAt } from './city.js';

const SKY_TINT = 'rgba(255, 214, 130, 0.10)';

export function drawWorld(ctx, g, vw, vh) {
  const cam = g.camera;
  const zoom = cam.zoom;
  // The city is a coastal peninsula: beyond its edge is open sea, never void.
  ctx.fillStyle = '#1d7fa8';
  ctx.fillRect(0, 0, vw, vh);
  ctx.save();
  ctx.translate(vw / 2, vh / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-cam.x, -cam.y);

  drawGround(ctx, g);
  drawRoads(ctx, g);
  drawParks(ctx, g);
  drawWater(ctx, g);
  drawBuildings(ctx, g);
  drawTrees(ctx, g);
  drawPackages(ctx, g);
  drawMissionMarker(ctx, g);
  drawCars(ctx, g);
  drawPeds(ctx, g);
  drawPlayer(ctx, g);
  drawBullets(ctx, g);
  drawParticles(ctx, g);
  // warm sun wash over the whole scene
  ctx.fillStyle = SKY_TINT;
  ctx.fillRect(cam.x - vw / 2 / zoom - 50, cam.y - vh / 2 / zoom - 50, vw / zoom + 100, vh / zoom + 100);
  ctx.restore();
}

function drawGround(ctx, g) {
  ctx.fillStyle = '#7fae62';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  // subtle grass mottle
  ctx.fillStyle = 'rgba(0,0,0,0.04)';
  for (let i = 0; i < 260; i++) {
    const x = (i * 977) % WORLD.width, y = (i * 613) % WORLD.height;
    ctx.fillRect(x, y, 60, 26);
  }
}

function drawRoads(ctx, g) {
  const { street } = WORLD;
  ctx.fillStyle = '#3a3f46';
  for (const x of g.city.roadsV) ctx.fillRect(x - street / 2, 0, street, WORLD.height);
  for (const y of g.city.roadsH) ctx.fillRect(0, y - street / 2, WORLD.width, street);
  // sidewalks
  ctx.fillStyle = '#b9bec6';
  for (const x of g.city.roadsV) { ctx.fillRect(x - street / 2, 0, 8, WORLD.height); ctx.fillRect(x + street / 2 - 8, 0, 8, WORLD.height); }
  for (const y of g.city.roadsH) { ctx.fillRect(0, y - street / 2, WORLD.width, 8); ctx.fillRect(0, y + street / 2 - 8, WORLD.width, 8); }
  // centre dashes
  ctx.fillStyle = '#f5d76e';
  ctx.strokeStyle = '#f5d76e';
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  ctx.beginPath();
  for (const x of g.city.roadsV) { ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.height); }
  for (const y of g.city.roadsH) { ctx.moveTo(0, y); ctx.lineTo(WORLD.width, y); }
  ctx.stroke();
  ctx.setLineDash([]);
  // crosswalks at intersections
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const x of g.city.roadsV) for (const y of g.city.roadsH) {
    for (let i = -3; i <= 3; i++) ctx.fillRect(x + i * 12 - 4, y - street / 2 + 6, 8, 14);
  }
}

function drawParks(ctx, g) {
  for (const p of g.city.parks) {
    if (p.kind === 'beach') {
      ctx.fillStyle = '#ecd9a0';
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(p.x, p.y, p.w, 10);
    } else if (p.kind === 'park') {
      ctx.fillStyle = '#5d9b4a';
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = '#7cb968';
      ctx.beginPath(); ctx.arc(p.x + p.w / 2, p.y + p.h / 2, Math.min(p.w, p.h) * 0.28, 0, Math.PI * 2); ctx.fill();
    } else if (p.kind === 'plaza') {
      ctx.fillStyle = '#c9c2ae';
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = '#a89f83'; ctx.lineWidth = 4;
      ctx.strokeRect(p.x + 20, p.y + 20, p.w - 40, p.h - 40);
    } else { // parking lot
      ctx.fillStyle = '#565b62';
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = '#e8e8e8'; ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const sx = p.x + 24 + i * 52;
        ctx.strokeRect(sx, p.y + 30, 40, 80);
      }
    }
  }
}

function drawWater(ctx, g) {
  const t = g.time;
  for (const w of g.city.water) {
    const grad = ctx.createLinearGradient(w.x, w.y, w.x + w.w, w.y + w.h);
    grad.addColorStop(0, '#2fa8c9');
    grad.addColorStop(1, '#1d7fa8');
    ctx.fillStyle = grad;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const yy = w.y + ((i * 97 + t * 12) % w.h);
      ctx.beginPath(); ctx.moveTo(w.x + 10, yy); ctx.lineTo(w.x + w.w - 10, yy); ctx.stroke();
    }
  }
}

function drawBuildings(ctx, g) {
  const cam = g.camera;
  const vw = g.viewW / cam.zoom, vh = g.viewH / cam.zoom;
  for (const b of g.city.buildings) {
    if (b.x > cam.x + vw / 2 + 80 || b.x + b.w < cam.x - vw / 2 - 80) continue;
    if (b.y > cam.y + vh / 2 + 80 || b.y + b.h < cam.y - vh / 2 - 80) continue;
    // soft shadow offset to the south-east (afternoon sun)
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(b.x + 10 + b.height * 2, b.y + 12 + b.height * 2, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    // roof inset
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    // rooftop detail: AC units / skylights
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    const n = 2 + (b.windows % 3);
    for (let i = 0; i < n; i++) {
      const rx = b.x + 16 + ((b.windows + i * 53) % Math.max(20, b.w - 40));
      const ry = b.y + 16 + ((b.windows + i * 91) % Math.max(20, b.h - 40));
      ctx.fillRect(rx, ry, 14, 10);
    }
    // height shading: taller buildings get a darker edge
    if (b.height >= 3) {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x, b.y, b.w, 8);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('▮'.repeat(Math.min(5, b.height)), b.x + 10, b.y + b.h - 10);
    }
  }
}

function drawTrees(ctx, g) {
  for (const t of g.city.trees) {
    if (Math.abs(t.x - g.camera.x) > g.viewW || Math.abs(t.y - g.camera.y) > g.viewH) continue;
    if (t.palm) {
      ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(t.x + 4, t.y - 14); ctx.stroke();
      ctx.fillStyle = '#2f8f4e';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath(); ctx.ellipse(t.x + 4 + Math.cos(a) * 10, t.y - 14 + Math.sin(a) * 8, 12, 4, a, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      ctx.fillStyle = '#3c7a3a';
      ctx.beginPath(); ctx.arc(t.x, t.y, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5da24f';
      ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, 7, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function drawPackages(ctx, g) {
  for (const p of g.city.packages) {
    if (p.taken) continue;
    if (Math.abs(p.x - g.camera.x) > g.viewW || Math.abs(p.y - g.camera.y) > g.viewH) continue;
    const pulse = 1 + Math.sin(g.time * 4 + p.x) * 0.15;
    ctx.save();
    ctx.translate(p.x, p.y); ctx.scale(pulse, pulse);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(-8, -8, 16, 16);
    ctx.fillStyle = '#b8860b';
    ctx.fillRect(-8, -2, 16, 4);
    ctx.restore();
  }
}

function drawMissionMarker(ctx, g) {
  const m = g.missionTarget;
  if (m && g.state === 'playing') drawMarker(ctx, g, m, '#ffd23f');
  // taxi fare destination: separate green marker, never overwrites the mission one
  if (g.taxiTarget && g.state === 'playing') drawMarker(ctx, g, g.taxiTarget, '#2ecc71');
}

function drawMarker(ctx, g, m, color) {
  const bob = Math.sin(g.time * 3) * 6;
  ctx.save();
  ctx.translate(m.x, m.y + bob);
  ctx.fillStyle = 'rgba(255, 210, 63, 0.25)';
  ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(0, -52); ctx.lineTo(12, -30); ctx.lineTo(-12, -30); ctx.closePath(); ctx.fill();
  ctx.restore();
  // off-screen direction arrow at the screen edge
  const dx = m.x - g.player.x, dy = m.y - g.player.y;
  const d = Math.hypot(dx, dy);
  if (d > 700) {
    const a = Math.atan2(dy, dx);
    const ex = g.camera.x + Math.cos(a) * 320, ey = g.camera.y + Math.sin(a) * 200;
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -12); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = color; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(Math.round(d) + 'm', ex, ey + 30);
    ctx.textAlign = 'left';
  }
}

function drawCarShape(ctx, car) {
  const { len, wid } = car.type;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.fillRect(-len / 2 + 4, -wid / 2 + 5, len, wid);
  // body
  ctx.fillStyle = car.color;
  roundRect(ctx, -len / 2, -wid / 2, len, wid, 8);
  ctx.fill();
  // cabin + windshield
  ctx.fillStyle = 'rgba(20,30,40,0.85)';
  roundRect(ctx, -len * 0.18, -wid / 2 + 4, len * 0.36, wid - 8, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.7)';
  ctx.fillRect(len * 0.18, -wid / 2 + 5, 5, wid - 10);
  // headlights / taillights
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(len / 2 - 3, -wid / 2 + 2, 3, 6);
  ctx.fillRect(len / 2 - 3, wid / 2 - 8, 3, 6);
  ctx.fillStyle = '#ff2d2d';
  ctx.fillRect(-len / 2, -wid / 2 + 2, 3, 6);
  ctx.fillRect(-len / 2, wid / 2 - 8, 3, 6);
  if (car.police) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-len * 0.32, -wid / 2, len * 0.2, wid);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 3);
    ctx.textAlign = 'left';
    // light bar flashing
    const phase = Math.floor(Date.now() / 280) % 2 === 0;
    ctx.fillStyle = phase ? '#ff2222' : '#2266ff';
    ctx.fillRect(-8, -wid / 2 - 3, 8, 5);
    ctx.fillStyle = phase ? '#2266ff' : '#ff2222';
    ctx.fillRect(0, -wid / 2 - 3, 8, 5);
  }
  if (car.taxi) {
    ctx.fillStyle = '#111';
    ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCars(ctx, g) {
  for (const car of g.cars) {
    if (Math.abs(car.x - g.camera.x) > g.viewW || Math.abs(car.y - g.camera.y) > g.viewH) continue;
    drawCarShape(ctx, car);
  }
}

function drawPeds(ctx, g) {
  for (const p of g.peds) {
    if (p.state === 'dead') {
      ctx.fillStyle = 'rgba(120,0,0,0.7)';
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 13, 8, p.angle, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    if (Math.abs(p.x - g.camera.x) > g.viewW || Math.abs(p.y - g.camera.y) > g.viewH) continue;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(2, 3, 11, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(p.angle);
    ctx.fillStyle = p.cop ? '#1c2733' : p.gang ? '#7a1f1f' : p.color;
    roundRect(ctx, -9, -7, 18, 14, 6); ctx.fill();
    // head
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath(); ctx.arc(11, 0, 5, 0, Math.PI * 2); ctx.fill();
    if (p.gang) { ctx.fillStyle = '#ffd23f'; ctx.fillRect(4, -6, 4, 12); }
    if (p.cop) { ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 7px sans-serif'; ctx.fillText('PD', -12, 3); }
    ctx.restore();
  }
}

function drawPlayer(ctx, g) {
  const p = g.player;
  if (p.dead) return;
  if (g.car) return; // player is inside the car
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath(); ctx.ellipse(3, 4, 13, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(p.angle);
  // Rook Calloway: teal jacket, dark jeans
  ctx.fillStyle = '#0e7c7b';
  roundRect(ctx, -10, -8, 20, 16, 7); ctx.fill();
  ctx.fillStyle = '#f2c14e';
  ctx.fillRect(-2, -8, 4, 16); // jacket stripe
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath(); ctx.arc(12, 0, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(12, -2, 6, Math.PI, 0); ctx.fill(); // hair
  if (p.weapon === 'pistol') {
    ctx.fillStyle = '#222';
    ctx.fillRect(10, 4, 14, 4);
  }
  ctx.restore();
  // aim line when armed
  if (p.weapon === 'pistol' && g.state === 'playing') {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.angle) * 90, p.y + Math.sin(p.angle) * 90);
    ctx.stroke();
  }
}

function drawBullets(ctx, g) {
  ctx.fillStyle = '#ffe66d';
  for (const b of g.bullets) {
    ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
  }
}

function drawParticles(ctx, g) {
  for (const pt of g.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
}

// ---------------- HUD ----------------
export function drawHUD(ctx, g, vw, vh) {
  if (g.state !== 'playing') return;
  const p = g.player;
  // top-left: money + health + armor
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, 14, 14, 250, 86, 10); ctx.fill();
  ctx.fillStyle = '#7CFC9A';
  ctx.font = 'bold 26px monospace'; ctx.textAlign = 'left';
  ctx.fillText('$' + g.money.toLocaleString('en-US'), 26, 46);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif';
  ctx.fillText(districtNameAt(p.x, p.y) + '  •  ' + g.clockString(), 26, 66);
  // health bar
  ctx.fillStyle = '#222'; ctx.fillRect(26, 74, 150, 10);
  ctx.fillStyle = p.health > 30 ? '#2ecc71' : '#e74c3c';
  ctx.fillRect(26, 74, 150 * clamp(p.health / 100, 0, 1), 10);
  ctx.fillStyle = '#fff'; ctx.font = '10px sans-serif';
  ctx.fillText('HP ' + Math.ceil(p.health), 182, 83);
  if (p.armor > 0) {
    ctx.fillStyle = '#3498db';
    ctx.fillRect(26, 88, 150 * clamp(p.armor / 100, 0, 1), 6);
  }
  // wanted stars (top-right, above minimap)
  const stars = g.wanted;
  ctx.font = '26px sans-serif';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < stars ? '#ffd23f' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', vw - 210 + i * 30, 44);
  }
  if (stars > 0) {
    ctx.fillStyle = '#ff4d4d'; ctx.font = 'bold 13px sans-serif';
    ctx.fillText(stars >= 3 ? 'POLICE PURSUIT' : 'WANTED', vw - 210, 64);
  }
  drawMinimap(ctx, g, vw, vh);
  // mission banner (top-centre)
  const m = g.currentMission();
  if (m) {
    const step = m.steps[g.missionStep];
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const text = step ? step.text : 'Mission complete';
    ctx.font = 'bold 15px sans-serif';
    const w = Math.max(320, ctx.measureText(text).width + 90);
    roundRect(ctx, vw / 2 - w / 2, 14, w, 44, 8); ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.fillText('◆ ' + m.title, vw / 2 - w / 2 + 16, 32);
    ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif';
    ctx.fillText(text, vw / 2 - w / 2 + 16, 50);
    if (g.missionTarget) {
      const d = Math.hypot(g.missionTarget.x - p.x, g.missionTarget.y - p.y);
      ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 13px sans-serif';
      ctx.fillText(Math.round(d) + 'm', vw / 2 + w / 2 - 52, 32);
    }
  }
  // bottom-left: weapon + ammo + controls hint
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, 14, vh - 66, 250, 52, 10); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 15px sans-serif';
  if (g.car) {
    ctx.fillText('🚗  DRIVING', 26, vh - 42);
    ctx.fillStyle = '#ffd23f';
    ctx.fillText('SPACE handbrake  •  E to exit', 26, vh - 24);
  } else {
    ctx.fillText(p.weapon === 'pistol' ? '🔫 PISTOL' : '✊ FISTS', 26, vh - 42);
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(p.weapon === 'pistol' ? 'AMMO ' + p.ammo : 'Press F for pistol', 26, vh - 24);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '11px sans-serif';
  ctx.fillText('WASD move/drive  •  E enter car  •  F shoot  •  P pause  •  M mute', 14, vh - 76);
  // speedometer when driving
  if (g.car) {
    const kmh = Math.round(Math.abs(g.car.speed) * 0.9);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(ctx, vw - 250, vh - 66, 236, 52, 10); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 24px monospace';
    ctx.fillText(kmh + ' km/h', vw - 236, vh - 32);
    ctx.font = '12px sans-serif'; ctx.fillStyle = '#ffd23f';
    ctx.fillText(g.car.name + (g.car.police ? ' — STOLEN PD' : ''), vw - 236, vh - 52);
  }
  // toast messages
  if (g.toast && g.toastTime > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    const tw = ctx.measureText(g.toast).width + 40;
    roundRect(ctx, vw / 2 - tw / 2, vh - 130, tw, 36, 8); ctx.fill();
    ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(g.toast, vw / 2, vh - 107);
    ctx.textAlign = 'left';
  }
  // dialogue / story card
  if (g.dialogue && g.dialogueTime > 0) {
    ctx.fillStyle = 'rgba(10,14,20,0.85)';
    roundRect(ctx, vw / 2 - 340, vh - 210, 680, 64, 10); ctx.fill();
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2;
    ctx.strokeRect(vw / 2 - 340, vh - 210, 680, 64);
    ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 13px sans-serif';
    ctx.fillText(g.dialogue.who, vw / 2 - 322, vh - 186);
    ctx.fillStyle = '#fff'; ctx.font = '15px sans-serif';
    wrapText(ctx, g.dialogue.text, vw / 2 - 322, vh - 166, 644, 18);
  }
  ctx.restore();
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); line = w; yy += lh; }
    else line = test;
  }
  ctx.fillText(line, x, yy);
}

export function drawMinimap(ctx, g, vw, vh) {
  const size = 190, x0 = vw - size - 14, y0 = 84;
  const scale = size / WORLD.width;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, x0 - 6, y0 - 6, size + 12, size + 12, 10); ctx.fill();
  ctx.beginPath(); ctx.rect(x0, y0, size, size); ctx.clip();
  // water + land
  ctx.fillStyle = '#1d7fa8'; ctx.fillRect(x0, y0, size, size);
  ctx.fillStyle = '#7fae62'; ctx.fillRect(x0, y0, size - 12, size);
  // roads
  ctx.strokeStyle = '#3a3f46'; ctx.lineWidth = 2;
  for (const rx of g.city.roadsV) { ctx.beginPath(); ctx.moveTo(x0 + rx * scale, y0); ctx.lineTo(x0 + rx * scale, y0 + size); ctx.stroke(); }
  for (const ry of g.city.roadsH) { ctx.beginPath(); ctx.moveTo(x0, y0 + ry * scale); ctx.lineTo(x0 + size, y0 + ry * scale); ctx.stroke(); }
  // buildings
  ctx.fillStyle = 'rgba(60,70,85,0.8)';
  for (const b of g.city.buildings) ctx.fillRect(x0 + b.x * scale, y0 + b.y * scale, Math.max(1, b.w * scale), Math.max(1, b.h * scale));
  // mission target (yellow diamond)
  if (g.missionTarget) {
    ctx.fillStyle = '#ffd23f';
    const mx = x0 + g.missionTarget.x * scale, my = y0 + g.missionTarget.y * scale;
    ctx.save(); ctx.translate(mx, my); ctx.rotate(Math.PI / 4); ctx.fillRect(-5, -5, 10, 10); ctx.restore();
  }
  // police (blue/red dots)
  for (const c of g.cars) if (c.police) {
    ctx.fillStyle = '#4da3ff';
    ctx.beginPath(); ctx.arc(x0 + c.x * scale, y0 + c.y * scale, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  // player (white arrow)
  ctx.save();
  ctx.translate(x0 + g.player.x * scale, y0 + g.player.y * scale);
  ctx.rotate(g.player.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  // north + label
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif';
  ctx.fillText('N ↑  SOLMAR BAY', x0, y0 + size + 20);
}

// ---------------- Menus ----------------
export function drawMenu(ctx, g, vw, vh) {
  // backdrop: the city rendered behind, dimmed
  ctx.fillStyle = 'rgba(5,10,18,0.72)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('SOLMAR BAY', vw / 2, vh / 2 - 150);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('AN OPEN-WORLD CRIME STORY  •  ORIGINAL CITY, CREW & SOUND', vw / 2, vh / 2 - 116);
  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#cfe3ef';
  ctx.fillText('Rook Calloway came home broke. Six jobs stand between him and freedom.', vw / 2, vh / 2 - 88);
  ctx.fillText('Steal cars. Outrun the Solmar PD. Take the Harlow money — and keep it.', vw / 2, vh / 2 - 64);
  // buttons
  const buttons = g.menuButtons;
  for (const b of buttons) {
    const hover = g.mouse.x > b.x && g.mouse.x < b.x + b.w && g.mouse.y > b.y && g.mouse.y < b.y + b.h;
    ctx.fillStyle = hover ? '#ffd23f' : 'rgba(255,255,255,0.12)';
    roundRect(ctx, b.x, b.y, b.w, b.h, 8); ctx.fill();
    ctx.fillStyle = hover ? '#111' : '#fff';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + 32);
  }
  ctx.fillStyle = '#9fb4c4'; ctx.font = '13px sans-serif';
  ctx.fillText('WASD move / drive   •   SHIFT run   •   E enter & steal car   •   F / click shoot   •   SPACE handbrake / punch', vw / 2, vh / 2 + 150);
  ctx.fillText('P pause   •   M mute   •   Progress saves with the SAVE button or automatically after each mission', vw / 2, vh / 2 + 172);
  if (g.saveInfo) {
    ctx.fillStyle = '#7CFC9A'; ctx.font = 'bold 14px sans-serif';
    ctx.fillText('Saved game found: ' + g.saveInfo, vw / 2, vh / 2 + 198);
  }
  ctx.textAlign = 'left';
}

export function drawPause(ctx, g, vw, vh) {
  ctx.fillStyle = 'rgba(5,10,18,0.7)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff'; ctx.font = 'bold 44px sans-serif';
  ctx.fillText('PAUSED', vw / 2, vh / 2 - 80);
  ctx.font = '16px sans-serif'; ctx.fillStyle = '#cfe3ef';
  ctx.fillText('Missions completed: ' + g.missionIndex + ' / 6    •    Money: $' + g.money.toLocaleString('en-US') + '    •    Cars stolen: ' + g.stats.carsStolen, vw / 2, vh / 2 - 40);
  for (const b of g.pauseButtons) {
    const hover = g.mouse.x > b.x && g.mouse.x < b.x + b.w && g.mouse.y > b.y && g.mouse.y < b.y + b.h;
    ctx.fillStyle = hover ? '#ffd23f' : 'rgba(255,255,255,0.12)';
    roundRect(ctx, b.x, b.y, b.w, b.h, 8); ctx.fill();
    ctx.fillStyle = hover ? '#111' : '#fff';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + 32);
  }
  ctx.textAlign = 'left';
}

export function drawEndCard(ctx, g, vw, vh, title, sub, color) {
  ctx.fillStyle = 'rgba(5,10,18,0.75)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = color; ctx.font = 'bold 56px sans-serif';
  ctx.fillText(title, vw / 2, vh / 2 - 40);
  ctx.fillStyle = '#fff'; ctx.font = '18px sans-serif';
  ctx.fillText(sub, vw / 2, vh / 2);
  ctx.font = '15px sans-serif'; ctx.fillStyle = '#cfe3ef';
  ctx.fillText('Press ENTER to keep playing  •  the city never forgets', vw / 2, vh / 2 + 44);
  ctx.textAlign = 'left';
}
