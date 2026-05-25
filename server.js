const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: process.env.PORT || 3000 });
const rooms = new Map();
wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.type === 'join') {
      ws.roomId = msg.roomId; ws.playerId = msg.playerId;
      if (!rooms.has(msg.roomId)) rooms.set(msg.roomId, new Set());
      rooms.get(msg.roomId).add(ws);
    }
    if (ws.roomId && rooms.has(ws.roomId)) {
      rooms.get(ws.roomId).forEach(c => {
        if (c !== ws && c.readyState === WebSocket.OPEN) c.send(data);
      });
    }
  });
  ws.on('close', () => { if (ws.roomId && rooms.has(ws.roomId)) rooms.get(ws.roomId).delete(ws); });
});
console.log('Server running');
