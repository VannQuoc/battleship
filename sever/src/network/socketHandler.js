const GameRoom = require('../logic/GameRoom');
// Giả định CommanderSystem được sử dụng để kích hoạt skill
const CommanderSystem = require('../logic/CommanderSystem'); 

// Lưu trữ các phòng game đang hoạt động
const rooms = {}; 

/**
 * Hàm gửi trạng thái game (đã lọc Fog of War) riêng biệt cho từng người chơi trong phòng.
 * Mặc định luôn che giấu tàu địch.
 * @param {object} io Socket.IO Server instance
 * @param {GameRoom} room Instance của phòng game
 */
function syncRoom(io, room) {
    if (!room) return;
    // Gửi state đã lọc FoW riêng cho từng người chơi
    Object.keys(room.players).forEach(pid => {
        // Mặc định gọi state chuẩn (Che giấu tàu địch)
        io.to(pid).emit('game_state', room.getStateFor(pid)); 
    });
}

module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log(`Client connected: ${socket.id}`);

        // --- M1: Room & Join Logic ---

        // 1. Tạo Room với Config
        socket.on('create_room', ({ roomId, name, config = {} }) => {
            if (rooms[roomId]) return socket.emit('error', 'Room already exists');
            try {
                // Config: { mapSize: 30, points: 3000, maxPlayers: 2 }
                const room = new GameRoom(roomId, config);
                room.addPlayer(socket.id, name);
                rooms[roomId] = room;
                socket.join(roomId);
                socket.emit('room_created', { roomId, config: room.config });
                io.to(roomId).emit('room_log', `${name} created and joined the room.`);
                syncRoom(io, room);
            } catch (e) {
                socket.emit('error', `Failed to create room: ${e.message}`);
            }
        });

        // 2. Tham gia Room
        socket.on('join_room', ({ roomId, name }) => {
            const room = rooms[roomId];
            if (!room) return socket.emit('error', 'Room not found');
            
            if (room.addPlayer(socket.id, name)) {
                socket.join(roomId);
                io.to(roomId).emit('player_joined', { id: socket.id, name });
                io.to(roomId).emit('room_log', `${name} joined.`);
                syncRoom(io, room);
            } else {
                socket.emit('error', 'Room is full or game has started.');
            }
        });

        // --- M2: Setup & Deployment ---

        socket.on('select_commander', ({ roomId, commanderId }) => {
            const room = rooms[roomId];
            const player = room?.players[socket.id];
            if (player && room.status === 'LOBBY') {
                try {
                    player.setCommander(commanderId); // Giả định Player class có method setCommander
                    io.to(roomId).emit('room_log', `${player.name} selected commander.`);
                    syncRoom(io, room);
                } catch (e) {
                    socket.emit('error', e.message);
                }
            } else if (!room) {
                 socket.emit('error', 'Room not found');
            }
        });

        socket.on('buy_item', ({ roomId, itemId }) => {
            const room = rooms[roomId];
            const player = room?.players[socket.id];
            if (player && room.status === 'LOBBY') {
                try {
                    player.buyItem(itemId); // Giả định Player class có method buyItem
                    io.to(roomId).emit('room_log', `${player.name} bought item ${itemId}.`);
                    syncRoom(io, room);
                } catch (e) {
                    socket.emit('error', e.message);
                }
            } else if (!room) {
                 socket.emit('error', 'Room not found');
            }
        });

        socket.on('deploy_fleet', ({ roomId, ships }) => {
            const room = rooms[roomId];
            if (room) {
                try {
                    room.deployFleet(socket.id, ships);
                    io.to(roomId).emit('room_log', `${room.players[socket.id].name} deployed fleet.`);
                    syncRoom(io, room);
                } catch (e) {
                    socket.emit('error', `Deployment failed: ${e.message}`);
                }
            }
        });

        // --- M3: Battle Actions ---

        // 1. Fire Shot
        socket.on('fire_shot', ({ roomId, x, y }) => {
            const room = rooms[roomId];
            if (room) {
                try {
                    const result = room.fireShot(socket.id, x, y);
                    // Gửi hiệu ứng cho tất cả client
                    io.to(roomId).emit('effect_trigger', { type: 'SHOT', x, y, ...result }); 
                    syncRoom(io, room);
                } catch (e) {
                    socket.emit('error', e.message);
                }
            }
        });

        // 2. Move Unit
        socket.on('move_unit', ({ roomId, unitId, x, y }) => {
            const room = rooms[roomId];
            if (room) {
                try {
                    room.moveUnit(socket.id, unitId, x, y);
                    io.to(roomId).emit('room_log', `${room.players[socket.id].name} moved a unit.`);
                    syncRoom(io, room);
                } catch (e) {
                    socket.emit('error', e.message);
                }
            }
        });

        // 3. Use Item
        socket.on('use_item', ({ roomId, itemId, params }) => {
            const room = rooms[roomId];
            if(room) {
                try {
                    const res = room.useItem(socket.id, itemId, params);
                    // Gửi hiệu ứng (ví dụ: NUKE nổ, RADAR quét)
                    io.to(roomId).emit('effect_trigger', { type: 'ITEM_USE', itemId, ...res });
                    syncRoom(io, room); 
                } catch (e) {
                    socket.emit('error', e.message);
                }
            }
        });

        // 4. Activate Skill (Cập nhật logic Spy Skill từ v3)
        socket.on('activate_skill', ({ roomId }) => {
            const room = rooms[roomId];
            const player = room?.players[socket.id];
            if (!room || !player) return socket.emit('error', 'Room or player not found');

            try {
                // Giả định CommanderSystem.activateSkill xử lý logic skill và gọi nextTurn nếu cần
                const result = CommanderSystem.activateSkill(room, player);
                
                // Xử lý trường hợp đặc biệt: SPY Skill cần tiết lộ bản đồ tạm thời
                if (result.type === 'SKILL_SPY') {
                    // Lấy state cơ bản (chỉ người chơi Spy cần)
                    const secretState = room.getStateFor(socket.id);
                    const opponent = room.getOpponent(socket.id);

                    if (opponent) {
                        // FIX 5 (từ v3): Gán toàn bộ fleet của địch vào state của người chơi Spy
                        secretState.opponent.fleet = opponent.fleet;
                        secretState.isTempReveal = true; // Flag cho Client biết đây là reveal tạm thời
                        
                        // Gửi state đặc biệt chỉ cho người chơi Spy
                        socket.emit('game_state', secretState);
                        
                        // Thông báo cho địch biết (Quan trọng cho gameplay)
                        io.to(opponent.id).emit('effect_trigger', { 
                            type: 'ENEMY_USED_SPY',
                            message: `${player.name} activated a Spy Skill. Your fleet is exposed!`
                        });
                        io.to(roomId).emit('room_log', `${player.name} activated a hidden skill.`);
                    }
                    
                } else {
                    // Skill thường (Admiral, Engineer, v.v.)
                    io.to(roomId).emit('effect_trigger', { ...result, playerId: socket.id });
                    syncRoom(io, room);
                }
            } catch (e) {
                socket.emit('error', e.message);
            }
        });


        // --- M4: Disconnect (Giữ nguyên logic kết thúc game khi có người thoát) ---

        socket.on('disconnect', () => {
            const socketId = socket.id;
            console.log(`Client disconnected: ${socketId}`);

            // Tìm room user đang chơi
            for (const rid in rooms) {
                const room = rooms[rid];
                if (room.players[socketId]) {
                    const playerName = room.players[socketId].name;

                    // Xử lý thua/dừng game
                    room.status = 'ENDED'; 
                    // Tìm đối thủ còn lại
                    const winner = Object.values(room.players).find(p => p.id !== socketId);
                    
                    io.to(rid).emit('game_over', { 
                        reason: `${playerName} disconnected.`, 
                        winnerId: winner?.id,
                        winnerName: winner?.name || 'Unknown'
                    });

                    // Xóa room khỏi bộ nhớ
                    delete rooms[rid]; 
                    console.log(`Room ${rid} deleted.`);
                    break;
                }
            }
        });
    });
};