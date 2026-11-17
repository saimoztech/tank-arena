# Tank Arena: design

## Why
A game to play with a group of about 5 friends: everyone joins one room and fights in tanks. It should run on a laptop or an iPad from a link, with nothing to install.

## Goals
- One player creates a room and gets a 4-letter code. Friends join with the code. Up to 6 players.
- Each player drives one tank and shoots the others.
- Last tank alive wins. If the 3-minute timer runs out, the tank with the most health wins (a tie is a draw).
- Works on laptop (keyboard and mouse) and iPad (touch) in the browser.
- Rematch in the same room without re-entering the code.

## Not in this version
- 3D view, planes, tank upgrades, accounts, matchmaking with strangers, voice chat, bots.
- Rejoining a match after a disconnect (a dropped player's tank is removed).

## Would make it a failure
- Laggy or unfair hits between friends on ordinary home internet.
- Touch controls that are hard to aim with on iPad.

## Approaches considered
1. **Top-down 2D arena (chosen).** Camera above the map. Smooth on iPad, easy touch aiming, fastest to a playable game.
2. **3D behind-the-tank view.** Closer to a tank sim feel, but 3 to 4 times the work, heavier on iPad, harder to aim on touch. Can be added later on the same room system.
3. **No server, players connect directly to the host's device.** Nothing to host, but the match dies if the host drops and it depends on a third-party connection service. Rejected for reliability.

## How it works (builder's calls, not yet agreed in detail)
- **Server:** one Node.js program using the `ws` library. It serves the game page and runs every room. The server owns the truth: it moves tanks and bullets and decides hits 30 times a second, then sends the state to every player. Players only send their controls. This stops one player's lag or a tampered browser from deciding hits.
- **Client:** one `index.html` drawing on a canvas. No framework, no build step.
- **Screens:** name + Create room / Join with code, then lobby with player list and a Start button for the room creator, then match, then result with Rematch.
- **Controls:** laptop: WASD to drive, mouse to aim, click to fire. iPad: left stick drives, right stick aims and fires while held.
- **Tank:** 100 health, a shell does 20, one shot every 0.6 s. Shells stop at walls.
- **Map:** one fixed arena with walls for cover and health pickups (+30) that respawn every 20 s. Each player has their own colour and a name tag with a health bar.
- **Dead players** watch the rest of the round.
- **Input checks:** the server ignores malformed messages, clamps movement to tank speed and enforces the fire rate.
- **Self-check:** one small Node test for the rules that matter: a shell hit removes 20 health, walls block shells, and the win rule (last alive, else most health, else draw).

## Playing together
- **Same Wi-Fi:** start the server on the laptop; friends open `http://<laptop-ip>:3100`.
- **Different homes:** the same folder is deployed to a free Node host so there is a public link. That needs a hosting account, which the owner creates. Done as a separate step after the game works locally.

## Left to the builder
Exact map layout, colours, tank speed and shell speed, sound (none in this version unless asked).
