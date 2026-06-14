import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { mulberry32 } from './src/utils.js';

import { getWallData } from './src/worldGen.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const roomSize = 5;

function canMove(x, z, nx, nz) {
  if (nx > x) return !getWallData(nx, z).westWall; // Moving East means crossing nx's West wall
  if (nx < x) return !getWallData(x, z).westWall;  // Moving West means crossing x's West wall
  if (nz > z) return !getWallData(x, nz).northWall; // Moving South means crossing nz's North wall
  if (nz < z) return !getWallData(x, z).northWall;  // Moving North means crossing z's North wall
  return true;
}

function hasLineOfSight(gridX1, gridZ1, gridX2, gridZ2) {
  if (gridX1 !== gridX2 && gridZ1 !== gridZ2) return false;
  if (gridX1 === gridX2) {
    const minZ = Math.min(gridZ1, gridZ2);
    const maxZ = Math.max(gridZ1, gridZ2);
    for (let z = minZ; z < maxZ; z++) {
      if (!canMove(gridX1, z, gridX1, z + 1)) return false;
    }
    return true;
  } else {
    const minX = Math.min(gridX1, gridX2);
    const maxX = Math.max(gridX1, gridX2);
    for (let x = minX; x < maxX; x++) {
      if (!canMove(x, gridZ1, x + 1, gridZ1)) return false;
    }
    return true;
  }
}

let monster = {
  gridX: 0, gridZ: 0,
  x: 0, z: 0,
  targetX: 0, targetZ: 0,
  lastX: 0, lastZ: 0,
  state: 'WANDER', 
  speed: 2.0, 
  rotY: 0
};

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve the compiled frontend assets from Vite's build folder
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback to serve the game HTML page
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Store connected players
const players = {};

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Create a new player
  players[socket.id] = {
    id: socket.id,
    position: { x: 2.5, y: 1.35, z: 2.5 },
    rotation: { y: 0 }
  };

  // Send the current list of players to the new player
  socket.emit('currentPlayers', players);

  // Broadcast to all OTHER players that a new player has joined
  socket.broadcast.emit('newPlayer', players[socket.id]);

  // Handle player movement
  socket.on('playerMovement', (movementData) => {
    if (players[socket.id]) {
      players[socket.id].position = movementData.position;
      players[socket.id].rotation = movementData.rotation;
      // Broadcast movement to all OTHER players
      socket.broadcast.emit('playerMoved', players[socket.id]);
    }
  });

  // Handle text chat
  socket.on('chatMessage', (msg) => {
    // Broadcast the message to EVERYONE, including the sender
    io.emit('chatMessage', { id: socket.id, message: msg });
  });

  // Handle player disconnect
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

// Monster AI Loop
setInterval(() => {
  const delta = 0.05; // 50ms

  // Kill Check (Every tick)
  for (const id in players) {
    const p = players[id];
    const pd = Math.sqrt(Math.pow(p.position.x - monster.x, 2) + Math.pow(p.position.z - monster.z, 2));
    if (pd < 1.2) {
      // Jump scare & reset player
      io.to(id).emit('jumpScare');
      // Reset player on the server safely in the middle of the spawn room
      p.position = { x: 2.5, y: 1.35, z: 2.5 };
      io.to(id).emit('forceTeleport', p.position);
      io.emit('playerMoved', p);
      
      // Teleport the monster far away so it doesn't spawn camp!
      // In an infinite grid, just teleport them 20 rooms away randomly
      const angle = Math.random() * Math.PI * 2;
      const dist = 20; // 20 rooms
      const rx = Math.floor(Math.cos(angle) * dist);
      const rz = Math.floor(Math.sin(angle) * dist);
      
      monster.x = rx * roomSize;
      monster.z = rz * roomSize;
      monster.targetX = monster.x;
      monster.targetZ = monster.z;
      monster.state = 'WANDER';
    }
  }

  const dist = Math.sqrt(Math.pow(monster.targetX - monster.x, 2) + Math.pow(monster.targetZ - monster.z, 2));
  
  if (dist < 0.5) {
    monster.x = monster.targetX;
    monster.z = monster.targetZ;
    monster.gridX = Math.floor((monster.x + 2.5) / roomSize);
    monster.gridZ = Math.floor((monster.z + 2.5) / roomSize);

    let closestDist = Infinity;
    let closestPlayer = null;
    
    for (const id in players) {
      const p = players[id];
      const pd = Math.sqrt(Math.pow(p.position.x - monster.x, 2) + Math.pow(p.position.z - monster.z, 2));
      if (pd < 35 && pd < closestDist) {
        // Monster "hears" the player if they are within 35 meters
        closestDist = pd;
        closestPlayer = p;
      }
    }

    let nextCells = [];
    const neighbors = [ { dx: 1, dz: 0 }, { dx: -1, dz: 0 }, { dx: 0, dz: 1 }, { dx: 0, dz: -1 } ];

    for (const n of neighbors) {
      if (canMove(monster.gridX, monster.gridZ, monster.gridX + n.dx, monster.gridZ + n.dz)) {
        nextCells.push({ gridX: monster.gridX + n.dx, gridZ: monster.gridZ + n.dz });
      }
    }
    
    if (closestPlayer) {
      const pGridX = Math.floor((closestPlayer.position.x + 2.5) / roomSize);
      const pGridZ = Math.floor((closestPlayer.position.z + 2.5) / roomSize);
      const los = hasLineOfSight(monster.gridX, monster.gridZ, pGridX, pGridZ);

      if (closestDist < 12 || los) {
        // Calculate an offset so it doesn't walk perfectly down the middle
        let offsetX = (Math.random() - 0.5) * 2.0;
        let offsetZ = (Math.random() - 0.5) * 2.0;

        if (monster.state === 'CHASE') {
          // In chase mode, it can weave slightly
          offsetX = (Math.random() - 0.5) * 1.5;
          offsetZ = (Math.random() - 0.5) * 1.5;
        } else if (monster.state === 'LURK') {
          // In lurk mode, it explicitly hugs corners (deep in the cell)
          offsetX = (Math.random() > 0.5 ? 1.8 : -1.8);
          offsetZ = (Math.random() > 0.5 ? 1.8 : -1.8);
        }

        // Simple greedy pathfinding towards player
        if (los) {
          // We can see the player! Run straight at them instead of pathfinding to cell centers.
          monster.targetX = closestPlayer.position.x;
          monster.targetZ = closestPlayer.position.z;
        } else if (nextCells.length > 0) {
          nextCells.sort((a, b) => {
            const distA = Math.pow((a.gridX * roomSize) - closestPlayer.position.x, 2) + Math.pow((a.gridZ * roomSize) - closestPlayer.position.z, 2);
            const distB = Math.pow((b.gridX * roomSize) - closestPlayer.position.x, 2) + Math.pow((b.gridZ * roomSize) - closestPlayer.position.z, 2);
            return distA - distB;
          });
          monster.targetX = nextCells[0].gridX * roomSize + offsetX;
          monster.targetZ = nextCells[0].gridZ * roomSize + offsetZ;
        }
      } else {
        monster.state = 'LURK';
        monster.speed = 3.0; // Pacing speed
        
        // Calculate an offset so it doesn't walk perfectly down the middle
        let offsetX = (Math.random() > 0.5 ? 2.0 : -2.0);
        let offsetZ = (Math.random() > 0.5 ? 2.0 : -2.0);

        // Pathfind towards player, but aggressively penalize cells that give LOS to the player
        if (nextCells.length > 0) {
          nextCells.sort((a, b) => {
            const distA = Math.pow((a.gridX * roomSize) - closestPlayer.position.x, 2) + Math.pow((a.gridZ * roomSize) - closestPlayer.position.z, 2);
            const distB = Math.pow((b.gridX * roomSize) - closestPlayer.position.x, 2) + Math.pow((b.gridZ * roomSize) - closestPlayer.position.z, 2);
            
            const losA = hasLineOfSight(a.gridX, a.gridZ, pGridX, pGridZ) ? 10000 : 0;
            const losB = hasLineOfSight(b.gridX, b.gridZ, pGridX, pGridZ) ? 10000 : 0;
            
            return (distA + losA) - (distB + losB);
          });
          
          monster.targetX = nextCells[0].gridX * roomSize + offsetX;
          monster.targetZ = nextCells[0].gridZ * roomSize + offsetZ;
        }
      }
    } else {
      monster.state = 'WANDER';
      monster.speed = 1.5; 
      
      let offsetX = (Math.random() - 0.5) * 3.0; // Meander widely
      let offsetZ = (Math.random() - 0.5) * 3.0;

      if (nextCells.length > 0) {
        const forwardCells = nextCells.filter(c => !(c.gridX === monster.lastX && c.gridZ === monster.lastZ));
        let pick;
        if (forwardCells.length > 0) {
          pick = forwardCells[Math.floor(Math.random() * forwardCells.length)];
        } else {
          pick = nextCells[Math.floor(Math.random() * nextCells.length)];
        }
        monster.lastX = monster.gridX;
        monster.lastZ = monster.gridZ;
        monster.targetX = pick.gridX * roomSize + offsetX;
        monster.targetZ = pick.gridZ * roomSize + offsetZ;
      }
    }
  }

  // Move
  if (dist >= 0.5) {
    const dirX = (monster.targetX - monster.x) / dist;
    const dirZ = (monster.targetZ - monster.z) / dist;
    monster.x += dirX * monster.speed * delta;
    monster.z += dirZ * monster.speed * delta;
    monster.rotY = Math.atan2(dirX, dirZ); 
  }

  io.emit('entityUpdate', {
    x: monster.x,
    y: 0,
    z: monster.z,
    rotY: monster.rotY,
    state: monster.state
  });

}, 50);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
