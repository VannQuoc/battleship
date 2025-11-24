const GameRoom = require('../logic/GameRoom');

const rooms = {}; // In-memory storage

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // M1: Join
    socket.on('join_room', ({ roomId, name }) => {
      let room = rooms[roomId];
      if (!room) {
        room = new GameRoom(roomId, socket.id);
        rooms[roomId] = room;
      }
      
      if (room.addPlayer(socket.id, name)) {
        socket.join(roomId);
        io.to(roomId).emit('room_log', `${name} joined.`);
        syncRoom(io, room);
      } else {
        socket.emit('error', 'Room full');
      }
    });

    // M2: Setup & Buy
    socket.on('select_commander', ({ roomId, commanderId }) => {
        const room = rooms[roomId];
        if(room && room.players[socket.id]) {
            room.players[socket.id].setCommander(commanderId);
        }
    });

    socket.on('buy_item', ({ roomId, itemId }) => {
        const room = rooms[roomId];
        if (room) {
            const success = room.players[socket.id].buyItem(itemId);
            if(success) syncRoom(io, room);
        }
    });

    socket.on('deploy_fleet', ({ roomId, ships }) => {
      const room = rooms[roomId];
      if (room) {
        room.deployFleet(socket.id, ships);
        syncRoom(io, room);
      }
    });

    // M3: Battle
    socket.on('fire_shot', ({ roomId, x, y }) => {
      const room = rooms[roomId];
      if (room) {
        const result = room.fireShot(socket.id, x, y);
        io.to(roomId).emit('effect_trigger', { type: 'SHOT', x, y, result }); // Visual effect
        syncRoom(io, room);
      }
    });

    // M4: Item
    socket.on('use_item', ({ roomId, itemId, params }) => {
        const room = rooms[roomId];
        if(room) {
            try {
                const res = room.useItem(socket.id, itemId, params);
                io.to(roomId).emit('effect_trigger', res);
                syncRoom(io, room);
            } catch (e) {
                socket.emit('error', e.message);
            }
        }
    });
  });
};

function syncRoom(io, room) {
    // Gửi state riêng biệt cho từng người (Secure)
    Object.keys(room.players).forEach(pid => {
        io.to(pid).emit('game_state', room.getStateFor(pid));
    });
}