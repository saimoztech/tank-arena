'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer } = require('ws');
const G = require('./game');

const PORT = process.env.PORT || 3100;
const MAX_ROOMS = 200;
const PAGE = path.join(__dirname, 'public', 'index.html');

const server = http.createServer((req, res) => {
  if (req.url !== '/' && !req.url.startsWith('/?')) { res.writeHead(404); return res.end(); }
  fs.readFile(PAGE, (err, data) => {
    res.writeHead(err ? 500 : 200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(err ? 'error' : data);
  });
});

const wss = new WebSocketServer({ server, maxPayload: 1024 });
const rooms = new Map(); // code -> { g: game room, socks: Map<playerId, ws> }
let nextId = 1;

const send = (ws, m) => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };

function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let c;
  do { c = Array.from({ length: 4 }, () => A[Math.random() * A.length | 0]).join(''); } while (rooms.has(c));
  return c;
}

wss.on('connection', ws => {
  const id = nextId++;
  let room = null;

  // Without this listener an oversized or broken frame would crash the process.
  ws.on('error', () => {});

  ws.on('message', raw => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;

    if (!room) {
      if (m.t !== 'create' && m.t !== 'join') return;
      const name = (typeof m.name === 'string' ? m.name.trim().slice(0, 12) : '') || 'Tank';
      let r;
      if (m.t === 'create') {
        if (rooms.size >= MAX_ROOMS) return send(ws, { t: 'err', msg: 'Server is busy' });
        r = { g: G.newRoom(newCode()), socks: new Map() };
      } else {
        r = rooms.get(String(m.code).trim().toUpperCase());
        if (!r) return send(ws, { t: 'err', msg: 'Room not found' });
      }
      if (!G.addPlayer(r.g, id, name)) return send(ws, { t: 'err', msg: 'Room is full' });
      rooms.set(r.g.code, r);
      r.socks.set(id, ws);
      room = r;
      send(ws, { t: 'joined', id, code: r.g.code, C: G.C, walls: G.WALLS, pickups: G.PICKUPS });
    } else if (m.t === 'start') {
      if (room.g.host === id) G.start(room.g);
    } else if (m.t === 'in') {
      G.setInput(room.g, id, m);
    }
  });

  ws.on('close', () => {
    if (!room) return;
    G.removePlayer(room.g, id);
    room.socks.delete(id);
    if (!room.socks.size) rooms.delete(room.g.code);
  });
});

let last = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  for (const r of rooms.values()) {
    G.step(r.g, dt);
    const s = JSON.stringify(G.snapshot(r.g));
    for (const ws of r.socks.values()) if (ws.readyState === 1) ws.send(s);
  }
}, 1000 / 30);

server.listen(PORT, () => {
  console.log(`Tank Arena on http://localhost:${PORT}`);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list) if (a.family === 'IPv4' && !a.internal) console.log(`Same Wi-Fi: http://${a.address}:${PORT}`);
  }
});
