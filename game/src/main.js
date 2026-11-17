// Main — boots Solmar Bay: input, game loop, menu clicks and screenshot staging.
import { Game } from './game.js';
import { initInput, mouse, wasPressed } from './input.js';
import { applyShotPreset } from './shots.js';

const canvas = document.getElementById('game');
const status = document.getElementById('status');
initInput(canvas);

const game = new Game(canvas);
window.__solmar = game; // exposed for playtesting (state inspection only)

canvas.addEventListener('click', (e) => {
  const r = canvas.getBoundingClientRect();
  game.clickAt(e.clientX - r.left, e.clientY - r.top);
});

// Enter resumes from busted / wasted / complete screens
window.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (game.state === 'busted' || game.state === 'wasted' || game.state === 'complete')) {
    game.respawn();
  }
});

// Screenshot staging: ?shot=cover|street|mission|coast|menu (real game, staged state)
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  applyShotPreset(game, shot);
  status.textContent = 'Solmar Bay screenshot mode: ' + shot;
} else {
  status.textContent = 'Solmar Bay loaded. Press New Game to start.';
}

// Keep the game loop running even before the first user gesture (menu renders the city).
requestAnimationFrame((t) => game.frame(t));
