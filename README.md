# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Sandivisi/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Sandivisi/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

SOLMAR BAY: an original open-world crime game. Explore a sun-soaked coastal city on foot and by car, steal cars, outrun the police, and run a six-job story.

## Run it

```sh
node serve.ts        # serves game/ at http://localhost:8080
```

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>

---

# SOLMAR BAY — open-world crime game

You play Rook Calloway, an ex-getaway driver rebuilding his crew in
Solmar Bay, a coastal city with Downtown, Marina, Old Town, Palm Heights,
a beach and a bay. All art, sound, names and code are original.

## What is in the game

- A 3,840×2,880 deterministic city: 55 buildings, parks, beach, marina,
  traffic AI following roads, wandering and fleeing pedestrians
- Steal and drive 6 original car models (E to enter/steal), handbrake,
  collisions; stealing and running over pedestrians raise your wanted level
- Wanted 0–5 stars: police cars chase and ram, foot cops chase and arrest
  (BUSTED); wanted decays when you stay out of sight
- Missions and story: a 6-job chain with briefings, dialogue, objective
  markers and rewards, autosaving after each mission
- Combat: fists and pistol with mouse aim, gang shootouts, health/armor/ammo
- Side activities: taxi fares and 20 hidden smuggler packages
- HUD with money, health/armor, clock, district name, wanted stars,
  mission banner, minimap, speedometer; start screen, pause menu,
  localStorage save/load, WASTED/BUSTED end cards

## Controls

WASD/arrows move · mouse aims · E enter/steal car · Space handbrake ·
left-click shoot · P/Esc pause · M mute.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and
writes `dossier.json` with the vendored `vendor/makefun-game.ts` library.

## License

MIT — see `LICENSE`.
