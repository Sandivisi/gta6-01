// Audio — all sound and music is synthesised with WebAudio. No audio files.
let ctx = null;
let master = null;
let muted = false;
let engineOsc = null, engineGain = null, engineFilter = null;
let sirenOsc = null, sirenGain = null, sirenLfo = null;
let musicTimer = null;
let musicStep = 0;

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    startEngineHum();
    startMusic();
  } catch { ctx = null; }
}

export function resumeAudio() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}
export function isMuted() { return muted; }

function startEngineHum() {
  engineOsc = ctx.createOscillator();
  engineOsc.type = 'sawtooth';
  engineOsc.frequency.value = 40;
  engineFilter = ctx.createBiquadFilter();
  engineFilter.type = 'lowpass';
  engineFilter.frequency.value = 300;
  engineGain = ctx.createGain();
  engineGain.gain.value = 0;
  engineOsc.connect(engineFilter).connect(engineGain).connect(master);
  engineOsc.start();
}

export function setEngine(speedNorm, driving) {
  if (!ctx || !engineOsc) return;
  const t = ctx.currentTime;
  engineOsc.frequency.setTargetAtTime(42 + speedNorm * 130, t, 0.08);
  engineGain.gain.setTargetAtTime(driving ? 0.05 + speedNorm * 0.06 : 0.0, t, 0.1);
}

function startSiren() {
  if (sirenOsc || !ctx) return;
  sirenOsc = ctx.createOscillator();
  sirenOsc.type = 'triangle';
  sirenOsc.frequency.value = 750;
  sirenLfo = ctx.createOscillator();
  sirenLfo.type = 'square';
  sirenLfo.frequency.value = 0.55;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 180;
  sirenLfo.connect(lfoGain).connect(sirenOsc.frequency);
  sirenGain = ctx.createGain();
  sirenGain.gain.value = 0.035;
  sirenOsc.connect(sirenGain).connect(master);
  sirenOsc.start(); sirenLfo.start();
}
function stopSiren() {
  if (!sirenOsc) return;
  try { sirenOsc.stop(); sirenLfo.stop(); } catch { /* already stopped */ }
  sirenOsc = null; sirenLfo = null; sirenGain = null;
}
export function setSiren(on) { if (on) startSiren(); else stopSiren(); }

function blip(freq, dur, type = 'sine', vol = 0.2, slideTo = 0) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function noiseBurst(dur, vol, lowpass = 1200) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = lowpass;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

export const sfx = {
  gunshot() { noiseBurst(0.14, 0.5, 900); blip(160, 0.1, 'square', 0.18, 50); },
  punch() { noiseBurst(0.08, 0.3, 500); },
  pickup() { blip(660, 0.09); setTimeout(() => blip(990, 0.12), 70); },
  cash() { blip(880, 0.08); setTimeout(() => blip(1174, 0.1), 80); setTimeout(() => blip(1568, 0.16), 160); },
  mission() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.14, 'triangle', 0.22), i * 90)); },
  fail() { [400, 320, 240].forEach((f, i) => setTimeout(() => blip(f, 0.18, 'sawtooth', 0.14), i * 120)); },
  horn() { blip(370, 0.22, 'square', 0.12); blip(466, 0.22, 'square', 0.1); },
  crash() { noiseBurst(0.25, 0.45, 700); },
  door() { blip(220, 0.07, 'square', 0.12, 140); },
  click() { blip(700, 0.05, 'sine', 0.12); },
  busted() { [330, 262, 196, 131].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.2), i * 140)); },
};

// Simple sun-soaked synth loop: bassline + hats, original 8-bar pattern.
const BASS = [55, 0, 55, 65.4, 55, 0, 82.4, 73.4, 55, 0, 55, 65.4, 98, 82.4, 73.4, 65.4];
function startMusic() {
  if (musicTimer || !ctx) return;
  musicTimer = setInterval(() => {
    if (muted || !ctx) return;
    const step = musicStep++ % 16;
    const bass = BASS[step];
    if (bass) blip(bass, 0.22, 'triangle', 0.16);
    if (step % 4 === 2) blip(220, 0.1, 'sine', 0.05);
    if (step % 2 === 0) noiseBurst(0.03, 0.03, 6000);
    if (step === 0 && Math.floor(musicStep / 16) % 4 === 3) {
      [440, 554, 659].forEach((f, i) => setTimeout(() => blip(f, 0.3, 'sine', 0.05), i * 110));
    }
  }, 150);
}
