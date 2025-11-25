const GameRoom = require('../logic/GameRoom');
const CommanderSystem = require('../logic/CommanderSystem');

// Lưu trữ các phòng game đang hoạt động
const rooms = {};

/**
 * Hàm gửi trạng thái game (đã lọc Fog of War) riêng biệt cho từng người chơi.
 * @param {object} io Socket.IO Server instance
 * @param {GameRoom} room Instance của phòng game
 */
function syncRoom(io, room) {
    if (!room) return;
    
    // Duyệt qua từng player trong phòng để gửi state riêng (Che giấu vị trí địch)
    Object.keys(room.players).forEach(pid => {
        // getStateFor(pid, false) -> false nghĩa là không "revealAll"
        io.to(pid).emit('game_state', room.getStateFor(pid, false));
    });
}

module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log(`Client connected: ${socket.id}`);

        // =========================================================
        // M1: ROOM & JOIN LOGIC (Merge V1 Logic + V2 Map Data)
        // =========================================================

        // 1. Tạo Room
        socket.on('create_room', ({ roomId, name, config = {} }) => {
            if (rooms[roomId]) return socket.emit('error', 'Room already exists');
            
            try {
                // Config mặc định nếu thiếu
                const finalConfig = { 
                    mapSize: config.mapSize || 20, 
                    points: config.points || 1000, 
                    maxPlayers: 2 
                };

                const room = new GameRoom(roomId, finalConfig);
                room.addPlayer(socket.id, name);
                
                rooms[roomId] = room;
                socket.join(roomId);

                // [FIX V2]: Gửi mapData ngay khi tạo phòng để client vẽ bản đồ
                socket.emit('room_created', { 
                    roomId, 
                    config: room.config, 
                    mapData: room.mapData // Quan trọng: Gửi địa hình
                });

                io.to(roomId).emit('room_log', `${name} created and joined the room.`);
                syncRoom(io, room);

            } catch (e) {
                console.error(e);
                socket.emit('error', `Failed to create room: ${e.message}`);
            }
        });

        // 2. Tham gia Room
        socket.on('join_room', ({ roomId, name }) => {
            const room = rooms[roomId];
            if (!room) return socket.emit('error', 'Room not found');
            
            // Check full hoặc đang chơi
            if (room.status !== 'LOBBY' && room.status !== 'SETUP') {
                 return socket.emit('error', 'Game already started or room closed.');
            }

            if (room.addPlayer(socket.id, name)) {
                socket.join(roomId);
                
                io.to(roomId).emit('player_joined', { id: socket.id, name });
                io.to(roomId).emit('room_log', `${name} joined.`);

                // [FIX V2]: Gửi mapData cho người mới vào
                socket.emit('room_info', { 
                    roomId,
                    config: room.config, 
                    mapData: room.mapData 
                });

                syncRoom(io, room);
            } else {
                socket.emit('error', 'Room is full.');
            }
        });

        // =========================================================
        // M2: SETUP & DEPLOYMENT
        // =========================================================

        socket.on('select_commander', ({ roomId, commanderId }) => {
            const room = rooms[roomId];
            if (!room) return;
            const player = room.players[socket.id];

            if (player && room.status === 'LOBBY') {
                try {
                    // Cần đảm bảo Player model có hàm setCommander hoặc gán trực tiếp
                    player.commander = commanderId; 
                    // Nếu dùng CommanderSystem để init stats:
                    // CommanderSystem.applyPassive(player); 
                    
                    io.to(roomId).emit('room_log', `${player.name} selected commander ${commanderId}.`);
                    syncRoom(io, room);
                } catch (e) {
                    socket.emit('error', e.message);
                }
            }
        });

        socket.on('buy_item', ({ roomId, itemId }) => {
            const room = rooms[roomId];
            if (!room) return;
            const player = room.players[socket.id];

            if (player && room.status === 'LOBBY') {
                try {
                    // Logic mua đồ nằm trong Player Model hoặc GameRoom helper
                    const success = player.buyItem(itemId); 
                    if (success) {
                        io.to(roomId).emit('room_log', `${player.name} bought item ${itemId}.`);
                        syncRoom(io, room);
                    } else {
                        socket.emit('error', 'Not enough points or item invalid');
                    }
                } catch (e) {
                    socket.emit('error', e.message);
                }
            }
        });

        socket.on('deploy_fleet', ({ roomId, ships }) => {
            const room = rooms[roomId];
            if (!room) return;

            try {
                // Hàm deployFleet trong GameRoom mới đã handle check địa hình
                const success = room.deployFleet(socket.id, ships);
                
                if (success) {
                    io.to(roomId).emit('room_log', `${room.players[socket.id].name} deployed fleet.`);
                    
                    // Nếu deploy xong mà game bắt đầu (cả 2 đã ready)
                    if (room.status === 'BATTLE') {
                        io.to(roomId).emit('game_started', { turnQueue: room.turnQueue });
                    }
                    
                    syncRoom(io, room);
                } else {
                    socket.emit('error', 'Deployment failed: Invalid position or collision.');
                }
            } catch (e) {
                socket.emit('error', `Deployment error: ${e.message}`);
            }
        });

        // =========================================================
        // M3: BATTLE ACTIONS
        // =========================================================

        // 1. Fire Shot (Cập nhật params mới)
        socket.on('fire_shot', ({ roomId, x, y, preferredUnitId }) => {
            const room = rooms[roomId];
            if (!room) return;

            try {
                // Gọi hàm fireShot mới (có hỗ trợ preferredUnitId)
                const result = room.fireShot(socket.id, x, y, preferredUnitId);
                
                if (result.error) return socket.emit('error', result.error);

                // Gửi hiệu ứng Visual (Nổ, Đạn bay)
                io.to(roomId).emit('effect_trigger', { 
                    type: 'SHOT', 
                    attackerId: socket.id,
                    x, y, 
                    ...result 
                });

                // Kiểm tra Game Over ngay lập tức
                if (result.gameEnded) {
                    io.to(roomId).emit('game_over', { 
                        winner: result.winner,
                        reason: 'All ships sunk'
                    });
                    // Có thể clean up room sau 1 khoảng thời gian
                }

                syncRoom(io, room);
            } catch (e) {
                console.error(e);
                socket.emit('error', e.message);
            }
        });

        // 2. Move Unit
        socket.on('move_unit', ({ roomId, unitId, x, y }) => {
            const room = rooms[roomId];
            if (!room) return;

            try {
                // GameRoom mới đã check địa hình (Island/Reef)
                room.moveUnit(socket.id, unitId, x, y);
                
                io.to(roomId).emit('room_log', `${room.players[socket.id].name} moved a unit.`);
                syncRoom(io, room);
            } catch (e) {
                socket.emit('error', e.message);
            }
        });

        // 3. Use Item
        socket.on('use_item', ({ roomId, itemId, params }) => {
            const room = rooms[roomId];
            if (!room) return;

            try {
                const res = room.useItem(socket.id, itemId, params);
                
                // Gửi hiệu ứng item
                io.to(roomId).emit('effect_trigger', { 
                    type: 'ITEM_USE', 
                    playerId: socket.id,
                    itemId, 
                    ...res 
                });

                if (res.gameEnded) {
                    io.to(roomId).emit('game_over', { winner: res.winner, reason: 'Item fatal blow' });
                }

                syncRoom(io, room); 
            } catch (e) {
                socket.emit('error', e.message);
            }
        });

        // 4. Commander Skill (Logic Spy Reveal từ V1)
        socket.on('activate_skill', ({ roomId }) => {
            const room = rooms[roomId];
            if (!room) return;
            const player = room.players[socket.id];
            
            try {
                const result = CommanderSystem.activateSkill(room, player);
                
                if (result.type === 'SKILL_SPY') {
                    // A. Gửi bản đồ FULL (Lộ diện toàn bộ) cho người dùng Spy
                    socket.emit('game_state', room.getStateFor(socket.id, true)); 
                    
                    // Thông báo Visual Effect cho cả phòng biết là có thằng dùng Spy
                    io.to(roomId).emit('effect_trigger', { type: 'SPY_REVEAL', playerId: socket.id });

                    // B. Tự động tắt sau 3 giây (Timeout)
                    setTimeout(() => {
                        // Check an toàn: Room còn tồn tại và Player còn trong đó không
                        if (rooms[roomId] && rooms[roomId].players[socket.id]) {
                            // Gửi lại bản đồ FOG (Che đi)
                            socket.emit('game_state', rooms[roomId].getStateFor(socket.id, false));
                        }
                    }, 3000);

                } else {
                    // Skill khác (VD: Engineer repair, Admiral buff...)
                    io.to(roomId).emit('effect_trigger', { ...result, playerId: socket.id });
                    syncRoom(io, room);
                }
            } catch (e) {
                socket.emit('error', e.message);
            }
        });

        // =========================================================
        // M4: DISCONNECT & CLEANUP
        // =========================================================

        socket.on('disconnect', () => {
            const socketId = socket.id;
            console.log(`Client disconnected: ${socketId}`);

            // Tìm room user đang chơi
            for (const rid in rooms) {
                const room = rooms[rid];
                if (room.players[socketId]) {
                    const playerName = room.players[socketId].name;

                    // Nếu đang trong trận mà thoát -> Xử thua luôn
                    if (room.status === 'BATTLE') {
                        room.status = 'ENDED'; 
                        const winner = Object.values(room.players).find(p => p.id !== socketId);
                        
                        io.to(rid).emit('game_over', { 
                            reason: `${playerName} disconnected.`, 
                            winnerId: winner?.id,
                            winnerName: winner?.name || 'Opponent'
                        });
                        
                        // Xóa room sau khi thông báo xong
                        delete rooms[rid];
                        console.log(`Room ${rid} closed due to disconnect.`);
                    } else {
                        // Nếu đang ở Lobby -> Chỉ cần remove player hoặc báo hủy phòng
                        io.to(rid).emit('room_log', `${playerName} left the room.`);
                        delete room.players[socketId];
                        
                        // Nếu phòng trống thì xóa
                        if (Object.keys(room.players).length === 0) {
                            delete rooms[rid];
                        } else {
                            // Sync lại cho người còn lại
                            syncRoom(io, room);
                        }
                    }
                    break;
                }
            }
        });
    });
};