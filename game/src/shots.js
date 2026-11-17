// Shots — deterministic staging for screenshots (?shot=cover|street|mission|menu).
// Each preset arranges the live game (real code, real render) so the screenshot
// shows a different system: chase, combat, cruising, and the start screen.
// Normal play (no ?shot=) is untouched.
import { CAR_TYPES } from './config.js';
import { makeCar, makePed } from './entities.js';

export function applyShotPreset(game, name) {
  const g = game;
  if (name === 'menu') { g.state = 'menu'; return; }
  g.state = 'playing';
  g.mutedForShot = true;
  g.taxi = null; g.taxiTarget = null; g.toast = ''; g.toastTime = 0; g.dialogue = null; g.dialogueTime = 0;
  if (name === 'cover') {
    // Wanted-3 police chase downtown, mission 2 active, player in a Kestrel GT
    g.player.x = 1150; g.player.y = 620;
    const car = makeCar(1150, 660, -Math.PI / 2, 2, { parked: false });
    g.cars.push(car);
    g.enterCar(car);
    g.car.speed = 140;
    g.setWanted(3);
    g.missionIndex = 1; g.missionStep = 1;
    g.spawnPoliceCar(950, 500); g.spawnPoliceCar(1350, 820);
    g.spawnTrafficNear(1150, 620, 6);
    g.spawnPedsNear(1150, 620, 8);
    g.camera.x = 1150; g.camera.y = 620;
  } else if (name === 'street') {
    // On foot at the Marina, traffic + pedestrians, mission 1 active
    g.player.x = 3300; g.player.y = 900;
    g.missionIndex = 0; g.missionStep = 0;
    g.spawnTrafficNear(3300, 900, 7);
    g.spawnPedsNear(3300, 900, 12);
    g.spawnParkedNear(3300, 900, 3);
    g.camera.x = 3300; g.camera.y = 900;
  } else if (name === 'mission') {
    // Dockside shootout: mission 4, gang guards, player armed on foot
    g.player.x = 3180; g.player.y = 1420;
    g.player.ammo = 48; g.player.health = 82;
    g.missionIndex = 3; g.missionStep = 1;
    g.spawnGang(3300, 1500, 3);
    g.spawnPedsNear(3180, 1420, 4);
    g.setWanted(2);
    g.spawnPoliceCar(3050, 1300);
    g.camera.x = 3240; g.camera.y = 1460;
  } else if (name === 'coast') {
    // Coastal cruise along the bay at speed (on the eastern avenue, sea to the right)
    g.player.x = 3216; g.player.y = 2000;
    const car = makeCar(3216, 2000, -Math.PI / 2, 5, { parked: false });
    g.cars.push(car);
    g.enterCar(car);
    g.car.speed = 170;
    g.missionIndex = 2; g.missionStep = 1;
    g.spawnTrafficNear(3216, 2000, 5);
    g.camera.x = 3216; g.camera.y = 2000;
  }
  g.updateMissionTarget();
}
