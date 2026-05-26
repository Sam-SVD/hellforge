const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

app.use(express.static(PUBLIC_DIR));

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const rooms = new Map();

function send(ws, data) {
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function broadcast(room, data, exceptId = null) {
  for (const [id, player] of room.players.entries()) {
    if (id !== exceptId) send(player.ws, data);
  }
}

function snapshot(room) {
  return Array.from(room.players.entries()).map(([id, p]) => ({
    id,
    name: p.name,
    hp: p.hp,
    score: p.score,
    state: p.state || null,
    alive: p.alive
  }));
}

function cleanupRoom(code) {
  const room = rooms.get(code);
  if (!room) return;
  if (room.players.size === 0) rooms.delete(code);
}

wss.on("connection", (ws) => {
  ws.playerId = Math.random().toString(36).slice(2, 10);
  ws.roomCode = null;

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === "create") {
      let code;
      do { code = makeCode(); } while (rooms.has(code));

      const room = { code, players: new Map(), createdAt: Date.now() };
      rooms.set(code, room);
      ws.roomCode = code;

      room.players.set(ws.playerId, {
        ws,
        name: String(msg.name || "Player").slice(0, 18),
        hp: 100,
        score: 0,
        alive: true,
        state: null
      });

      send(ws, { type: "created", room: code, playerId: ws.playerId, players: snapshot(room) });
      broadcast(room, { type: "players", players: snapshot(room) });
      return;
    }

    if (msg.type === "join") {
      const code = String(msg.room || "").trim().toUpperCase();
      const room = rooms.get(code);

      if (!room) {
        send(ws, { type: "error", message: "Room not found." });
        return;
      }

      if (room.players.size >= 2) {
        send(ws, { type: "error", message: "Room is full. This build supports 1v1." });
        return;
      }

      ws.roomCode = code;
      room.players.set(ws.playerId, {
        ws,
        name: String(msg.name || "Player").slice(0, 18),
        hp: 100,
        score: 0,
        alive: true,
        state: null
      });

      send(ws, { type: "joined", room: code, playerId: ws.playerId, players: snapshot(room) });
      broadcast(room, { type: "players", players: snapshot(room) });
      return;
    }

    const room = rooms.get(ws.roomCode);
    if (!room) return;
    const player = room.players.get(ws.playerId);
    if (!player) return;

    if (msg.type === "state") {
      player.state = msg.state || null;
      broadcast(room, { type: "peer_state", playerId: ws.playerId, state: player.state }, ws.playerId);
      return;
    }

    if (msg.type === "shot") {
      broadcast(room, {
        type: "shot",
        playerId: ws.playerId,
        weapon: msg.weapon,
        x: msg.x,
        y: msg.y,
        a: msg.a
      }, ws.playerId);
      return;
    }

    if (msg.type === "hit") {
      const targetId = String(msg.targetId || "");
      const damage = Math.max(0, Math.min(80, Number(msg.damage || 0)));
      const target = room.players.get(targetId);
      if (!target || !target.alive) return;

      target.hp = Math.max(0, target.hp - damage);

      if (target.hp <= 0) {
        target.alive = false;
        player.score += 1;

        broadcast(room, {
          type: "death",
          victimId: targetId,
          killerId: ws.playerId,
          players: snapshot(room)
        });

        setTimeout(() => {
          const stillRoom = rooms.get(ws.roomCode);
          if (!stillRoom) return;
          const respawnTarget = stillRoom.players.get(targetId);
          if (!respawnTarget) return;
          respawnTarget.hp = 100;
          respawnTarget.alive = true;
          send(respawnTarget.ws, { type: "respawn" });
          broadcast(stillRoom, { type: "players", players: snapshot(stillRoom) });
        }, 2500);
      } else {
        broadcast(room, {
          type: "hurt",
          victimId: targetId,
          attackerId: ws.playerId,
          damage,
          players: snapshot(room)
        });
      }
      return;
    }

    if (msg.type === "reset") {
      for (const p of room.players.values()) {
        p.hp = 100;
        p.score = 0;
        p.alive = true;
      }
      broadcast(room, { type: "reset", players: snapshot(room) });
      return;
    }
  });

  ws.on("close", () => {
    const room = rooms.get(ws.roomCode);
    if (!room) return;
    room.players.delete(ws.playerId);
    broadcast(room, { type: "left", playerId: ws.playerId, players: snapshot(room) });
    cleanupRoom(ws.roomCode);
  });
});

server.listen(PORT, () => {
  console.log(`Hellforge 8 server running on port ${PORT}`);
});
