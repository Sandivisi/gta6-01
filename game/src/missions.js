// Missions — the Solmar Bay story: six jobs for ex-getaway driver Rook Calloway,
// rebuilding his crew after the Harlow job went wrong. Each mission is a list of steps;
// the game engine (game.js) resolves step types: goto, drive, steal, kill, deliver, escape, wait.
import { WORLD } from './config.js';

export const STORY_INTRO =
  'SOLMAR BAY. Rook Calloway came home after three years away — broke, burned, and owed a debt to the Harlow family. One crew, six jobs, and the bay is his again. Or the bay buries him.';

export const MISSIONS = [
  {
    id: 1, title: '1 — HOMECOMING', reward: 500,
    brief: 'Mara is waiting at the pier café. Get there on foot — your old car is long gone.',
    steps: [
      { type: 'goto', text: 'Meet Mara at the pier café', x: 3560, y: 420, radius: 90 },
      { type: 'goto', text: 'Follow Mara to the garage on Palm Row', x: 2950, y: 1750, radius: 90 },
    ],
    outro: 'Mara: "The garage is yours again, Rook. One car, one pistol. Don\'t make me regret it."',
  },
  {
    id: 2, title: '2 — THE FIRST WHEELS', reward: 900,
    brief: 'The Harlows want a Kestrel GT lifted from the Downtown car park. Steal it and bring it to the garage.',
    steps: [
      { type: 'steal', text: 'Steal the yellow Kestrel GT in Downtown', x: 1150, y: 620, radius: 110, carType: 'Kestrel GT' },
      { type: 'deliver', text: 'Deliver the Kestrel to the garage', x: 2950, y: 1750, radius: 120, inCar: true },
    ],
    outro: 'Mara: "Clean lift. The Harlows noticed. That\'s good and bad."',
  },
  {
    id: 3, title: '3 — TAXI FOR TROUBLE', reward: 750,
    brief: 'A fare is waiting at the Marina — a nervous accountant who knows where the Harlow money sleeps. Drive him to Old Town, fast, and lose any tail.',
    steps: [
      { type: 'goto', text: 'Pick up the fare at the Marina', x: 3350, y: 900, radius: 90 },
      { type: 'drive', text: 'Drive the fare to Old Town — keep him calm', x: 500, y: 2300, radius: 120, inCar: true },
    ],
    outro: 'Fare: "The money moves Thursday, through the docks. Tell Mara I was never here."',
  },
  {
    id: 4, title: '4 — DOCKSIDE', reward: 1400,
    brief: 'The Harlow crew is moving cash through the docks tonight. Take the money — and deal with whoever guards it.',
    steps: [
      { type: 'goto', text: 'Reach the docks at the east pier', x: 3300, y: 1500, radius: 110 },
      { type: 'kill', text: 'Deal with the Harlow guards (3)', x: 3300, y: 1500, radius: 260, count: 3 },
      { type: 'goto', text: 'Grab the cash and get to the garage', x: 2950, y: 1750, radius: 110 },
    ],
    outro: 'Mara: "That was their payroll, Rook. They will come for you now."',
  },
  {
    id: 5, title: '5 — HEAT WAVE', reward: 1800,
    brief: 'The whole Solmar police department is on you. Survive the heat: stay alive until the wanted level drops, then reach the safehouse.',
    steps: [
      { type: 'escape', text: 'Survive — lose the police (wanted level to 0)', x: 0, y: 0, radius: 0, seconds: 1 },
      { type: 'goto', text: 'Reach the Palm Heights safehouse', x: 2500, y: 2400, radius: 110 },
    ],
    outro: 'Mara: "You slipped them. One job left, Rook. The big one."',
  },
  {
    id: 6, title: '6 — THE HARLOW JOB', reward: 5000,
    brief: 'Tonight the Harlow money truck crosses the bay bridge. Take the truck, shake the escort, and bring it home. Finish this.',
    steps: [
      { type: 'steal', text: 'Take the Harlow money truck at the bridge', x: 1750, y: 1450, radius: 130, carType: 'Bramble Van' },
      { type: 'escape', text: 'Escape the escort — lose the police', x: 0, y: 0, radius: 0, seconds: 1 },
      { type: 'deliver', text: 'Bring the truck to the garage', x: 2950, y: 1750, radius: 130, inCar: true },
    ],
    outro: 'Mara: "It\'s done. The debt is paid, the crew is yours, and Solmar Bay is open. Drive, Rook."',
  },
];

export function missionByIndex(i) { return MISSIONS[i] || null; }
export function totalMissions() { return MISSIONS.length; }
