'use strict';
const test = require('node:test');
const assert = require('node:assert');
const G = require('./game');

const DT = 1 / 30;

// Two tanks in a started match, placed by hand. Tank 1 aims along +x.
function duel(a, b) {
  const r = G.newRoom('TEST');
  G.addPlayer(r, 1, 'a');
  G.addPlayer(r, 2, 'b');
  G.start(r);
  Object.assign(r.players.get(1), { x: a[0], y: a[1], aim: 0 });
  Object.assign(r.players.get(2), { x: b[0], y: b[1] });
  return r;
}
function fireOnce(r) {
  G.setInput(r, 1, { mx: 0, my: 0, aim: 0, fire: true });
  G.step(r, DT);
  G.setInput(r, 1, { mx: 0, my: 0, aim: 0, fire: false });
}
function run(r, steps) { for (let i = 0; i < steps; i++) G.step(r, DT); }

test('a shell hit removes 20 health', () => {
  const r = duel([100, 900], [300, 900]);
  fireOnce(r);
  run(r, 20);
  assert.strictEqual(r.players.get(2).hp, 80);
  assert.strictEqual(r.bullets.length, 0);
});

test('walls block shells', () => {
  const r = duel([300, 300], [500, 300]); // wall at x 380-420 between them
  fireOnce(r);
  run(r, 30);
  assert.strictEqual(r.players.get(2).hp, 100);
  assert.strictEqual(r.bullets.length, 0);
});

test('fire rate is one shot per 0.6 s', () => {
  const r = duel([100, 900], [1500, 100]);
  G.setInput(r, 1, { mx: 0, my: 0, aim: 0, fire: true });
  run(r, 30); // 1 s: shots at 0 s and 0.6 s, both still in flight
  assert.strictEqual(r.bullets.length, 2);
});

test('last tank alive wins', () => {
  const r = duel([100, 900], [300, 900]);
  r.players.get(2).hp = 20;
  fireOnce(r);
  run(r, 20);
  assert.strictEqual(r.state, 'ended');
  assert.strictEqual(r.winner.id, 1);
});

test('on timeout the most health wins', () => {
  const r = duel([100, 900], [1500, 100]);
  r.players.get(1).hp = 60;
  r.players.get(2).hp = 40;
  r.time = 0.01;
  G.step(r, DT);
  assert.strictEqual(r.state, 'ended');
  assert.strictEqual(r.winner.id, 1);
});

test('on timeout equal health is a draw', () => {
  const r = duel([100, 900], [1500, 100]);
  r.time = 0.01;
  G.step(r, DT);
  assert.strictEqual(r.state, 'ended');
  assert.strictEqual(r.winner, null);
});

test('bad input is ignored and speed is clamped', () => {
  const r = duel([100, 900], [1500, 100]);
  G.setInput(r, 1, { mx: 'x', my: 0, aim: 0, fire: true });
  G.setInput(r, 1, null);
  assert.deepStrictEqual(r.players.get(1).in, { mx: 0, my: 0, fire: false });
  G.setInput(r, 1, { mx: 50, my: 0, aim: 0, fire: false });
  G.step(r, DT);
  assert.ok(r.players.get(1).x - 100 <= G.C.SPEED * DT + 1e-9);
});

test('a late joiner watches, then plays the next round', () => {
  const r = duel([100, 900], [1500, 100]);
  G.addPlayer(r, 3, 'c');
  assert.strictEqual(r.players.get(3).alive, false);
  r.time = 0.01;
  G.step(r, DT);
  G.start(r);
  assert.strictEqual(r.players.get(3).alive, true);
});

test('room holds 6, needs 2 to start, and the host hands over', () => {
  const r = G.newRoom('TEST');
  G.addPlayer(r, 1, 'a');
  assert.strictEqual(G.start(r), false);
  for (let id = 2; id <= 6; id++) assert.strictEqual(G.addPlayer(r, id, 'p'), true);
  assert.strictEqual(G.addPlayer(r, 7, 'p'), false);
  G.removePlayer(r, 1);
  assert.strictEqual(r.host, 2);
});

test('a player leaving mid-match lets the last one win', () => {
  const r = duel([100, 900], [1500, 100]);
  G.removePlayer(r, 2);
  G.step(r, DT);
  assert.strictEqual(r.winner.id, 1);
});
