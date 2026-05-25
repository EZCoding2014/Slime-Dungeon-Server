const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const app = express();

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Render needs this for the free tier
const PORT = process.env.PORT || 10000;

const rooms = new Map();
// Store player data: coins, accessories, stats
const playerData = new Map();

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    
    if (msg.type === 'join') {
      ws.roomId = msg.roomId; 
      ws.playerId = msg.playerId || `player_${Math.random().toString(36).substr(2, 9)}`;
      
      // Load saved data or create new player
      if (!playerData.has(ws.playerId)) {
        playerData.set(ws.playerId, {
          coins: 0,
          accessories: [],
          stats: { hp: 3, dmg: 1, speed: 1 }
        });
      }
      
      if (!rooms.has(msg.roomId)) rooms.set(msg.roomId, new Set());
      rooms.get(msg.roomId).add(ws);
      
      // Send player their saved data
      ws.send(JSON.stringify({
        type: 'playerData',
        data: playerData.get(ws.playerId),
        playerId: ws.playerId
      }));
      
      // Tell room about new player
      broadcastRoom(ws.roomId, {
        type: 'playerJoin',
        playerId: ws.playerId,
        accessories: playerData.get(ws.playerId).accessories
      });
    }
    
    if (msg.type === 'buy') {
      const pData = playerData.get(ws.playerId);
      const shopItems = {
        sunglasses: { cost: 5, effect: { speed: 0.1 } },
        spikehat: { cost: 8, effect: { dmg: 1 } },
        cape: { cost: 10, effect: { hp: 2 } },
        clover: { cost: 12, effect: { coinMult: 0.25 } },
        crown: { cost: 15, effect: { hp: 1, dmg: 1, speed: 0.05 } }
      };
      
      const item = shopItems[msg.item];
      if (item && pData.coins >= item.cost && !pData.accessories.includes(msg.item)) {
        pData.coins -= item.cost;
        pData.accessories.push(msg.item);
        // Apply stat effects
        Object.keys(item.effect).forEach(stat => {
          pData.stats[stat] = (pData.stats[stat] || 0) + item.effect[stat];
        });
        
        ws.send(JSON.stringify({
          type: 'purchaseSuccess',
          data: pData
        }));
        
        // Update all players in room about new accessory
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
    
    // Relay all other messages to room
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

server.listen(PORT, () => console.log(`Server running on ${PORT}`));
