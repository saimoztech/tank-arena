'use strict';
// Game rules only: no network, no timers. The server calls step(); test.js checks the rules.

const C = {
  W: 1600, H: 1000, MAX: 6,
  R: 22, SPEED: 180, HP: 100,
  BR: 5, BSPEED: 520, DMG: 20, CD: 0.6,
  HEAL: 30, PICKUP_R: 14, PICKUP_T: 20,
  ROUND: 180,
};
const WALLS = [
  { x: 380, y: 180, w: 40, h: 240 }, { x: 380, y: 580, w: 40, h: 240 },
  { x: 1180, y: 180, w: 40, h: 240 }, { x: 1180, y: 580, w: 40, h: 240 },
  { x: 640, y: 300, w: 320, h: 40 }, { x: 640, y: 660, w: 320, h: 40 },
  { x: 780, y: 440, w: 40, h: 120 },
];
const SPAWNS = [[120, 120], [1480, 880], [1480, 120], [120, 880], [800, 120], [800, 880]];
const PICKUPS = [[800, 220], [800, 780], [200, 500], [1400, 500]];
const COLORS = ['#e5484d', '#3e9bff', '#46c66b', '#f5b83d', '#b072f0', '#f078b4'];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function hitsWall(x, y, r) {
  return WALLS.some(w => {
    const dx = x - clamp(x, w.x, w.x + w.w), dy = y - clamp(y, w.y, w.y + w.h);
    return dx * dx + dy * dy < r * r;
  });
}

function newRoom(code) {
  return {
    code, state: 'lobby', players: new Map(), bullets: [],
    pickups: PICKUPS.map(([x, y]) => ({ x, y, t: 0 })),
    time: C.ROUND, host: null, winner: null,
  };
}

function addPlayer(room, id, name) {
  if (room.players.size >= C.MAX) return false;
  const used = new Set([...room.players.values()].map(p => p.color));
  // Joining mid-match: alive stays false, so they watch until the next start().
  room.players.set(id, {
    id, name, color: COLORS.find(c => !used.has(c)),
    x: 0, y: 0, hp: 0, aim: 0, body: 0, cd: 0, alive: false,
    in: { mx: 0, my: 0, fire: false },
  });
  if (room.host === null) room.host = id;
  return true;
}

function removePlayer(room, id) {
  room.players.delete(id);
  if (room.host === id) room.host = room.players.keys().next().value ?? null;
}

function start(room) {
  if (room.state === 'playing' || room.players.size < 2) return false;
  let i = 0;
  for (const p of room.players.values()) {
    const [x, y] = SPAWNS[i++];
    const aim = Math.atan2(C.H / 2 - y, C.W / 2 - x);
    Object.assign(p, { x, y, hp: C.HP, cd: 0, alive: true, aim, body: aim, in: { mx: 0, my: 0, fire: false } });
  }
  room.bullets = [];
  room.pickups.forEach(k => { k.t = 0; });
  room.time = C.ROUND;
  room.winner = null;
  room.state = 'playing';
  return true;
}

// Trust boundary: m comes straight from a browser.
function setInput(room, id, m) {
  const p = room.players.get(id);
  if (!p || !m) return;
  let { mx, my, aim, fire } = m;
  if (![mx, my, aim].every(Number.isFinite)) return;
  const len = Math.hypot(mx, my);
  if (len > 1) { mx /= len; my /= len; }
  p.in = { mx, my, fire: fire === true };
  p.aim = aim;
}

function end(room, p) {
  room.state = 'ended';
  room.winner = p ? { id: p.id, name: p.name } : null; // null = draw
}

function step(room, dt) {
  if (room.state !== 'playing') return;
  const players = [...room.players.values()];

  for (const p of players) {
    if (!p.alive) continue;
    p.cd -= dt;
    const { mx, my, fire } = p.in;
    if (mx || my) {
      p.body = Math.atan2(my, mx);
      const nx = clamp(p.x + mx * C.SPEED * dt, C.R, C.W - C.R);
      if (!hitsWall(nx, p.y, C.R)) p.x = nx;
      const ny = clamp(p.y + my * C.SPEED * dt, C.R, C.H - C.R);
      if (!hitsWall(p.x, ny, C.R)) p.y = ny;
    }
    if (fire && p.cd <= 0) {
      p.cd = C.CD;
      const c = Math.cos(p.aim), s = Math.sin(p.aim), d = C.R + C.BR + 1;
      room.bullets.push({ x: p.x + c * d, y: p.y + s * d, vx: c * C.BSPEED, vy: s * C.BSPEED, o: p.id });
    }
  }

  // shortcut: shells are point-checked once per step (17 px at 30 Hz); fine while walls are >= 40 px
  // thick and tanks 22 px radius. Sweep the segment if shells get faster or walls thinner.
  room.bullets = room.bullets.filter(b => {
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.x < 0 || b.x > C.W || b.y < 0 || b.y > C.H || hitsWall(b.x, b.y, C.BR)) return false;
    for (const p of players) {
      if (p.alive && p.id !== b.o && Math.hypot(p.x - b.x, p.y - b.y) < C.R + C.BR) {
        p.hp = Math.max(0, p.hp - C.DMG);
        if (p.hp === 0) p.alive = false;
        return false;
      }
    }
    return true;
  });

  for (const k of room.pickups) {
    if (k.t > 0) { k.t = Math.max(0, k.t - dt); continue; }
    const p = players.find(p => p.alive && p.hp < C.HP && Math.hypot(p.x - k.x, p.y - k.y) < C.R + C.PICKUP_R);
    if (p) { p.hp = Math.min(C.HP, p.hp + C.HEAL); k.t = C.PICKUP_T; }
  }

  room.time -= dt;
  const alive = players.filter(p => p.alive);
  if (alive.length <= 1) end(room, alive[0]);
  else if (room.time <= 0) {
    const top = Math.max(...alive.map(p => p.hp));
    const best = alive.filter(p => p.hp === top);
    end(room, best.length === 1 ? best[0] : null);
  }
}

function snapshot(room) {
  return {
    t: 's', state: room.state, host: room.host, time: Math.max(0, Math.ceil(room.time)),
    winner: room.winner && room.winner.name,
    players: [...room.players.values()].map(p => ({
      id: p.id, name: p.name, color: p.color, x: Math.round(p.x), y: Math.round(p.y),
      hp: p.hp, aim: +p.aim.toFixed(2), body: +p.body.toFixed(2), alive: p.alive,
    })),
    bullets: room.bullets.map(b => [Math.round(b.x), Math.round(b.y)]),
    pickups: room.pickups.map(k => (k.t === 0 ? 1 : 0)),
  };
}

module.exports = { C, WALLS, PICKUPS, newRoom, addPlayer, removePlayer, start, setInput, step, snapshot };
