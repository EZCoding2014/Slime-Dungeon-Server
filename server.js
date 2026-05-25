const WebSocket = require('ws');

const PORT = process.env.PORT || 10000;
const wss = new WebSocket.Server({ port: PORT });

const rooms = new Map();
const playerData = new Map();

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    
    if (msg.type === 'join') {
      ws.roomId = msg.roomId; 
      ws.playerId = msg.playerId || `player_${Math.random().toString(36).substr(2, 9)}`;
      
      if (!playerData.has(ws.playerId)) {
        playerData.set(ws.playerId, {
          coins: 0,
          accessories: [],
          stats: { hp: 3, dmg: 1, speed: 1 }
        });
      }
      
      if (!rooms.has(msg.roomId)) rooms.set(msg.roomId, new Set());
      rooms.get(msg.roomId).add(ws);
      
      ws.send(JSON.stringify({
        type: 'playerData',
        data: playerData.get(ws.playerId),
        playerId: ws.playerId
      }));
      
      broadcastRoom(ws.roomId, {
        type: 'playerJoin',
        playerId: ws.playerId,
        accessories: playerData.get(ws.playerId).accessories
      });
    }
    
    if (msg.type === 'buy') {
      const pData = playerData.get(ws.playerId);
      const shopItems = {
        sunglasses: { cost: 5 },
        spikehat: { cost: 8 },
        cape: { cost: 10 },
        clover: { cost: 12 },
        crown: { cost: 15 }
      };
      
      const item = shopItems[msg.item];
      if (item && pData.coins >= item.cost && !pData.accessories.includes(msg.item)) {
        pData.coins -= item.cost;
        pData.accessories.push(msg.item);
        
        ws.send(JSON.stringify({
          type: 'purchaseSuccess',
          data: pData
        }));
        
        broadcastRoom(ws.roomId, {
          type: 'playerUpdate',
          playerId: ws.playerId,
          accessories: pData.accessories
        });
      } else {
        ws.send(JSON.stringify({ type: 'purchaseFail' }));
      }
    }
    
    if (msg.type === 'updateCoins') {
      const pData = playerData.get(ws.playerId);
      pData.coins = msg.coins;
      ws.send(JSON.stringify({ type: 'playerData', data: pData }));
    }
    
    if (ws.roomId && rooms.has(ws.roomId)) {
      rooms.get(ws.roomId).forEach(c => {
        if (c !== ws && c.readyState === WebSocket.OPEN) {
          c.send(data);
        }
      });
    }
  });

  ws.on('close', () => {
    if (ws.roomId && rooms.has(ws.roomId)) {
      rooms.get(ws.roomId).delete(ws);
      if (rooms.get(ws.roomId).size === 0) rooms.delete(ws.roomId);
      else {
        broadcastRoom(ws.roomId, {
          type: 'playerLeave',
          playerId: ws.playerId
        });
      }
    }
  });
});

function broadcastRoom(roomId, data) {
  if (rooms.has(roomId)) {
    rooms.get(roomId).forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }
}

console.log(`Server running on ${PORT}`);
