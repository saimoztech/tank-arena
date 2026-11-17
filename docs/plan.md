# Tank Arena Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A browser tank battle for up to 6 friends who join one room by a 4-letter code.

**Architecture:** One Node.js process serves a single HTML page and runs every room over WebSocket. The server owns the game state and steps it 30 times a second; clients send controls and draw snapshots.

**Tech Stack:** Node.js, `ws`, plain HTML canvas. No build step.

**Spec:** `tank-game/docs/design.md`

## Global Constraints

- Up to 6 players per room; 4-letter room code.
- Tank 100 health; shell 20 damage; one shot per 0.6 s; shells stop at walls.
- Round 3 minutes. Last tank alive wins; on timeout most health wins; equal health is a draw.
- Health pickup +30, respawns after 20 s.
- Only dependency: `ws`.
- Not a git repository: no commit steps.

## Review Focus

- Malformed or oversized WebSocket message: server ignores it and keeps running.
- Player name containing HTML: shown as text, never as markup.
- Host leaves the lobby: next player becomes host.
- Player disconnects mid-match: tank removed, win rule still resolves.
- Player joins while a match is running: watches, plays next round.

---

### Task 1: Game rules

**Files:** Create `tank-game/game.js`, `tank-game/test.js`, `tank-game/package.json`

**Produces:** `C`, `WALLS`, `PICKUPS`, `newRoom(code)`, `addPlayer(room,id,name) -> boolean`, `removePlayer(room,id)`, `start(room) -> boolean`, `setInput(room,id,{mx,my,aim,fire})`, `step(room,dt)`, `snapshot(room)`.

- [ ] Tests in `test.js`: hit removes 20; wall blocks shell; fire rate; last alive wins; timeout most health wins; timeout equal health draws; bad input ignored; late joiner spectates; host handover.
- [ ] Implement `game.js`.
- [ ] Run `npm test`, expect all pass.

### Task 2: Room server

**Files:** Create `tank-game/server.js`

**Consumes:** Task 1 exports.

**Protocol:** client sends `{t:'create',name}`, `{t:'join',code,name}`, `{t:'start'}`, `{t:'in',mx,my,aim,fire}`. Server sends `{t:'joined',id,code,C,walls,pickups}`, `{t:'err',msg}`, `{t:'s',...snapshot}`.

- [ ] Serve `public/index.html` at `/`; WebSocket on the same port (`PORT` or 3100); `maxPayload` 1024.
- [ ] Only the host may start; empty rooms are deleted.

### Task 3: Browser client

**Files:** Create `tank-game/public/index.html`

- [ ] Menu (name, Create, Join with code), room panel (players, Start / Rematch for host), match canvas, result.
- [ ] Keyboard and mouse controls; two touch sticks.

### Task 4: Play-test

- [ ] Two browser tabs: create, join, start, shoot, round ends, rematch.
