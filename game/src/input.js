// Input — keyboard + mouse state, with edge-triggered "pressed" helpers.
export const keys = {};
export const pressed = {}; // consumed each frame by the game loop
export const mouse = { x: 0, y: 0, down: false, clicked: false, worldX: 0, worldY: 0 };

export function initInput(canvas) {
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    if (!keys[e.key.toLowerCase()]) pressed[e.key.toLowerCase()] = true;
    keys[e.key.toLowerCase()] = true;
  });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => { mouse.down = true; mouse.clicked = true; if (e.button === 0) e.preventDefault(); });
  window.addEventListener('mouseup', () => { mouse.down = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function endFrame() {
  for (const k in pressed) pressed[k] = false;
  mouse.clicked = false;
}

export function wasPressed(code) { return !!pressed[code.toLowerCase()]; }
export function isDown(code) { return !!keys[code.toLowerCase()]; }

// WASD / arrows as a normalised movement vector
export function moveVector() {
  let x = 0, y = 0;
  if (isDown('a') || isDown('arrowleft')) x -= 1;
  if (isDown('d') || isDown('arrowright')) x += 1;
  if (isDown('w') || isDown('arrowup')) y -= 1;
  if (isDown('s') || isDown('arrowdown')) y += 1;
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len, active: x !== 0 || y !== 0 };
}
