const GameRoom = require('../logic/GameRoom');
const CommanderSystem = require('../logic/CommanderSystem');

// Lưu trữ các phòng game đang hoạt động
const rooms = {};

/**
 * Gửi trạng thái game cho từng người chơi (Fog of War)
 */
function syncRoom(io, room) {
    if (!room) return;
    
    Object.keys(room.players).forEach(pid => {
        io.to(pid).emit('game_state', room.getStateFor(pid, false));
    });
}

/**
 * Gửi thông tin lobby cho từng người chơi (ẩn inventory/commander của đối thủ)
 */
function syncLobby(io, room) {
    if (!room) return;
    
    // Gửi riêng cho từng player để ẩn thông tin chiến lược
    Object.keys(room.players).forEach(pid => {
        const playersData = {};
        
        for (const [playerId, player] of Object.entries(room.players)) {
            if (playerId === pid) {
                // Player của chính mình - hiển thị đầy đủ
                playersData[playerId] = player.toPublicData();
            } else {
                // Đối thủ - chỉ hiển thị tên và trạng thái ready
                playersData[playerId] = {
                    id: player.id,
                    name: player.name,
                    ready: player.ready,
                    // Ẩn các thông tin chiến lược
                    commander: null,
                    inventory: {},
                    inventoryArray: [],
                    points: '???',
                    usedSlots: 0,
                    maxSlots: 10,
                };
            }
        }
        
        const lobbyData = {
            roomId: room.id,
            status: room.status,
            hostId: room.hostId,
            config: room.config,
            players: playersData,
            mapData: room.mapData,
        };
        
        io.to(pid).emit('lobby_update', lobbyData);
    });
}

module.exports = (io) => {
    // Map persistent player IDs to socket IDs for reconnection
    const playerIdMap = {}; // persistentId -> socketId
    const socketToPlayerId = {}; // socketId -> persistentId
    
    io.on('connection', (socket) => {
        console.log(`Client connected: ${socket.id}`);
        
        // Handle reconnection attempt
        socket.on('reconnect_player', ({ persistentPlayerId, roomId, playerName }) => {
            console.log(`[RECONNECT] Attempting reconnect: persistentId=${persistentPlayerId}, roomId=${roomId}, socketId=${socket.id}`);
            
            const room = rooms[roomId];
            if (!room) {
                console.log(`[RECONNECT] Room ${roomId} not found`);
                return socket.emit('reconnect_failed', { error: 'Room not found' });
            }
            
            // Find player by persistent ID in room
            let foundPlayer = null;
            let oldSocketId = null;
            
            for (const [pid, player] of Object.entries(room.players)) {
                // Check if this player's persistent ID matches
                // We'll store persistentId in player object
                if (player.persistentId === persistentPlayerId) {
                    foundPlayer = player;
                    oldSocketId = pid;
                    break;
                }
            }
            
            if (!foundPlayer) {
                console.log(`[RECONNECT] Player ${persistentPlayerId} not found in room ${roomId}`);
                return socket.emit('reconnect_failed', { error: 'Player not found in room' });
            }
            
            // Update mappings
            const oldSocketIdInMap = playerIdMap[persistentPlayerId];
            if (oldSocketIdInMap) {
                delete socketToPlayerId[oldSocketIdInMap];
            }
            
            playerIdMap[persistentPlayerId] = socket.id;
            socketToPlayerId[socket.id] = persistentPlayerId;
            
            // Update player's socket ID in room
            delete room.players[oldSocketId];
            room.players[socket.id] = foundPlayer;
            foundPlayer.id = socket.id; // Update player's ID
            
            // Update turn queue if needed
            const turnIndex = room.turnQueue.indexOf(oldSocketId);
            if (turnIndex !== -1) {
                room.turnQueue[turnIndex] = socket.id;
            }
            
            // Update host if needed
            if (room.hostId === oldSocketId) {
                room.hostId = socket.id;
            }
            
            socket.join(roomId);
            
            console.log(`[RECONNECT] Successfully reconnected player ${persistentPlayerId} (old: ${oldSocketId}, new: ${socket.id})`);
            
            // Send current game state
            if (room.status === 'BATTLE' || room.status === 'SETUP') {
                socket.emit('game_state', room.getStateFor(socket.id, false));
            } else {
                syncLobby(io, room);
            }
            
            socket.emit('reconnect_success', {
                roomId,
                playerId: socket.id,
                status: room.status
            });
            
            io.to(roomId).emit('room_log', `${foundPlayer.name} reconnected.`);
        });

        // =========================================================
        // M1: ROOM & JOIN LOGIC
        // =========================================================

        // 1. Tạo Room
        socket.on('create_room', ({ roomId, name, config = {}, persistentPlayerId }) => {
            if (rooms[roomId]) return socket.emit('error', 'Room already exists');
            
            try {
                console.log('[CREATE ROOM] Config received:', config);
                
                const finalConfig = { 
                    mapSize: config.mapSize || 30, 
                    points: config.points || 3000, 
                    maxPlayers: config.maxPlayers || 2
                };
                
                console.log('[CREATE ROOM] Final config:', finalConfig);

                const room = new GameRoom(roomId, finalConfig);
                room.addPlayer(socket.id, name, persistentPlayerId);
                
                // Store mapping for reconnection
                if (persistentPlayerId) {
                    playerIdMap[persistentPlayerId] = socket.id;
                    socketToPlayerId[socket.id] = persistentPlayerId;
                }
                
                rooms[roomId] = room;
                socket.join(roomId);

                // Gửi room_created với players data
                const playersData = room.getAllPlayersPublicData();
                console.log('[CREATE ROOM] Players data:', playersData);
                
                socket.emit('room_created', { 
                    roomId, 
                    config: room.config, 
                    mapData: room.mapData,
                    hostId: room.hostId,
                    players: playersData, // Include players!
                });

                io.to(roomId).emit('room_log', `${name} created and joined the room.`);

            } catch (e) {
                console.error(e);
                socket.emit('error', `Failed to create room: ${e.message}`);
            }
        });

        // 2. Tham gia Room
        socket.on('join_room', ({ roomId, name, persistentPlayerId }) => {
            const room = rooms[roomId];
            if (!room) return socket.emit('error', 'Room not found');
            
            if (room.status !== 'LOBBY') {
                return socket.emit('error', 'Game already started or room closed.');
            }
            
            if (room.addPlayer(socket.id, name, persistentPlayerId)) {
                socket.join(roomId);
                
                // Store mapping for reconnection
                if (persistentPlayerId) {
                    playerIdMap[persistentPlayerId] = socket.id;
                    socketToPlayerId[socket.id] = persistentPlayerId;
                }
                
                io.to(roomId).emit('player_joined', { id: socket.id, name });
                io.to(roomId).emit('room_log', `${name} joined.`);

                // Gửi room_info với players data
                const playersData = room.getAllPlayersPublicData();
                
                socket.emit('room_info', { 
                    roomId,
                    config: room.config, 
                    mapData: room.mapData,
                    hostId: room.hostId,
                    players: playersData, // Include players!
                });

                // Sync để cập nhật cho TẤT CẢ người chơi trong phòng
                syncLobby(io, room);
            } else {
                socket.emit('error', 'Room is full.');
            }
        });

        // =========================================================
        // M2: LOBBY - COMMANDER & SHOP
        // =========================================================

        socket.on('select_commander', ({ roomId, commanderId }) => {
            const room = rooms[roomId];
            if (!room) return;
            const player = room.players[socket.id];

            if (player && room.status === 'LOBBY') {
                try {
                    player.setCommander(commanderId);
                    // Không thông báo cho đối thủ biết mình chọn tướng gì
                    syncLobby(io, room);
                } catch (e) {
                    socket.emit('error', e.message);
                }
            }
        });

        socket.on('buy_item', ({ roomId, itemId }) => {
            const room = rooms[roomId];
            if (!room) return;
            const player = room.players[socket.id];

            // Allow buying in LOBBY and BATTLE phases
            if (player && (room.status === 'LOBBY' || room.status === 'BATTLE')) {
                try {
                    const success = player.buyItem(itemId); 
                    if (success) {
                        // Chỉ thông báo cho chính người mua (không leak cho đối thủ)
                        socket.emit('purchase_success', { itemId, points: player.points });
                        
                        if (room.status === 'BATTLE') {
                            // Không log mua hàng để đối thủ không biết
                            syncRoom(io, room);
                        } else {
                            // Trong lobby chỉ sync data, không log
                            syncLobby(io, room);
                        }
                    } else {
                        socket.emit('error', 'Not enough points, slot full, or invalid item');
                    }
                } catch (e) {
                    socket.emit('error', e.message);
                }
            }
        });

        // Sell/Refund item (80% refund)
        socket.on('sell_item', ({ roomId, itemId }) => {
            const room = rooms[roomId];
            if (!room) return;
            const player = room.players[socket.id];

            if (player && room.status === 'LOBBY') {
                try {
                    const result = player.sellItem(itemId);
                    if (result.success) {
                        // Chỉ thông báo cho người bán
                        socket.emit('sell_success', { itemId, refund: result.refund, points: player.points });
                        syncLobby(io, room);
                    } else {
                        socket.emit('error', result.error || 'Cannot sell item');
                    }
                } catch (e) {
                    socket.emit('error', e.message);
                }
            }
        });

        // 3. Player Ready Toggle
        socket.on('player_ready', ({ roomId, ready }) => {
            const room = rooms[roomId];
            if (!room) return;
            
            if (room.status !== 'LOBBY') {
                return socket.emit('error', 'Cannot change ready state now');
            }

            const success = room.setPlayerReady(socket.id, ready);
            if (success) {
                const player = room.players[socket.id];
                io.to(roomId).emit('room_log', `${player.name} is ${ready ? 'READY' : 'NOT READY'}.`);
                syncLobby(io, room);
            }
        });

        // 4. Host Start Game (Lobby -> Setup)
        socket.on('start_game', ({ roomId }) => {
            const room = rooms[roomId];
            if (!room) return;
            
            const result = room.startGame(socket.id);
            
            if (result.error) {
                return socket.emit('error', result.error);
            }
            
            io.to(roomId).emit('game_phase_change', { 
                phase: 'SETUP',
                message: 'Game starting! Deploy your fleet!'
            });
            io.to(roomId).emit('room_log', 'Game started! Deploy your fleet.');
            syncRoom(io, room);
        });

        // =========================================================
        // M3: SETUP & DEPLOYMENT
        // =========================================================

        socket.on('deploy_fleet', ({ roomId, ships }) => {
            const room = rooms[roomId];
            if (!room) return;

            try {
                console.log(`[DEPLOY] Player ${socket.id} attempting to deploy ${ships.length} units`);
                const result = room.deployFleet(socket.id, ships);
                
                if (result.success) {
                    io.to(roomId).emit('room_log', `${room.players[socket.id].name} deployed fleet.`);
                    
                    // Check if battle started
                    if (room.status === 'BATTLE') {
                        io.to(roomId).emit('game_phase_change', { 
                            phase: 'BATTLE',
                            message: 'All players deployed! Battle begins!'
                        });
                        io.to(roomId).emit('game_started', { turnQueue: room.turnQueue });
                    }
                    
                    syncRoom(io, room);
                } else {
                    const errorMsg = result.error || 'Unknown error';
                    console.error(`[DEPLOY FAILED] ${errorMsg}`);
                    socket.emit('error', `Deployment failed: ${errorMsg}`);
                }
            } catch (e) {
                console.error(`[DEPLOY EXCEPTION]`, e);
                socket.emit('error', `Deployment error: ${e.message}`);
            }
        });

        // Deploy structure during battle
        socket.on('deploy_structure', ({ roomId, structureCode, x, y, vertical = false }) => {
            const room = rooms[roomId];
            if (!room) return;
            
            if (room.status !== 'BATTLE') {
                return socket.emit('error', 'Can only deploy structures during battle');
            }
            
            try {
                const result = room.deployStructureInBattle(socket.id, structureCode, x, y, vertical);
                if (result.success) {
                    syncRoom(io, room);
                } else {
                    socket.emit('error', result.error || 'Deploy failed');
                }
            } catch (e) {
                socket.emit('error', e.message);
            }
        });

        // =========================================================
        // M4: BATTLE ACTIONS
        // =========================================================

        socket.on('fire_shot', ({ roomId, x, y, preferredUnitId }) => {
            console.log(`[SocketHandler] fire_shot received: roomId=${roomId}, x=${x}, y=${y}, preferredUnitId=${preferredUnitId || 'none'}`);
            
            const room = rooms[roomId];
            if (!room) {
                console.error(`[SocketHandler] Room ${roomId} not found`);
                return;
            }

            try {
                const result = room.fireShot(socket.id, x, y, preferredUnitId);
                
                if (result.error) {
                    console.log(`[SocketHandler] fire_shot error: ${result.error}`);
                    return socket.emit('error', result.error);
                }

                console.log(`[SocketHandler] fire_shot result:`, result);
                
                io.to(roomId).emit('effect_trigger', { 
                    type: 'SHOT', 
                    attackerId: socket.id,
                    x, y, 
                    ...result 
                });

                if (result.gameEnded) {
                    const winner = room.players[result.winner];
                    console.log(`[SocketHandler] Game ended, winner: ${winner?.name || 'Unknown'}`);
                    io.to(roomId).emit('game_over', { 
                        winnerId: result.winner,
                        winnerName: winner?.name || 'Unknown',
                        reason: 'All ships sunk'
                    });
                }

                syncRoom(io, room);
            } catch (e) {
                console.error(`[SocketHandler] fire_shot exception:`, e);
                socket.emit('error', e.message);
            }
        });

        socket.on('move_unit', ({ roomId, unitId, x, y }) => {
            const room = rooms[roomId];
            if (!room) return;

            try {
                room.moveUnit(socket.id, unitId, x, y);
                io.to(roomId).emit('room_log', `${room.players[socket.id].name} moved a unit.`);
                syncRoom(io, room);
            } catch (e) {
                socket.emit('error', e.message);
            }
        });

        socket.on('use_item', ({ roomId, itemId, params }) => {
            const room = rooms[roomId];
            if (!room) return;

            try {
                const res = room.useItem(socket.id, itemId, params);
                
                io.to(roomId).emit('effect_trigger', { 
                    type: 'ITEM_USE', 
                    playerId: socket.id,
                    itemId, 
                    ...res 
                });

                if (res.gameEnded) {
                    const winner = room.players[res.winner];
                    io.to(roomId).emit('game_over', { 
                        winnerId: res.winner, 
                        winnerName: winner?.name || 'Unknown',
                        reason: 'Item fatal blow' 
                    });
                }

                syncRoom(io, room); 
            } catch (e) {
                socket.emit('error', e.message);
            }
        });

        socket.on('activate_skill', ({ roomId }) => {
            const room = rooms[roomId];
            if (!room) return;
            const player = room.players[socket.id];
            
            try {
                const result = CommanderSystem.activateSkill(room, player);
                
                if (result.type === 'SKILL_SPY') {
                    socket.emit('game_state', room.getStateFor(socket.id, true)); 
                    io.to(roomId).emit('effect_trigger', { type: 'SPY_REVEAL', playerId: socket.id });

                    setTimeout(() => {
                        if (rooms[roomId] && rooms[roomId].players[socket.id]) {
                            socket.emit('game_state', rooms[roomId].getStateFor(socket.id, false));
                        }
                    }, 3000);

                } else {
                    io.to(roomId).emit('effect_trigger', { ...result, playerId: socket.id });
                    syncRoom(io, room);
                }
            } catch (e) {
                socket.emit('error', e.message);
            }
        });

        // =========================================================
        // M5: DISCONNECT & CLEANUP
        // =========================================================

        socket.on('disconnect', () => {
            const socketId = socket.id;
            console.log(`Client disconnected: ${socketId}`);

            for (const rid in rooms) {
                const room = rooms[rid];
                if (room.players[socketId]) {
                    const playerName = room.players[socketId].name;

                    if (room.status === 'BATTLE' || room.status === 'SETUP') {
                        room.status = 'ENDED'; 
                        
                        // Find remaining players
                        const remainingPlayers = Object.values(room.players).filter(p => p.id !== socketId);
                        const winner = remainingPlayers.length === 1 ? remainingPlayers[0] : null;
                        
                        io.to(rid).emit('game_over', { 
                            reason: `${playerName} disconnected.`, 
                            winnerId: winner?.id,
                            winnerName: winner?.name || 'Draw'
                        });
                        
                        delete rooms[rid];
                        console.log(`Room ${rid} closed due to disconnect.`);
                    } else {
                        io.to(rid).emit('room_log', `${playerName} left the room.`);
                        delete room.players[socketId];
                        
                        // Transfer host if needed
                        if (room.hostId === socketId) {
                            const remainingIds = Object.keys(room.players);
                            room.hostId = remainingIds.length > 0 ? remainingIds[0] : null;
                            if (room.hostId) {
                                io.to(rid).emit('room_log', `${room.players[room.hostId].name} is now the host.`);
                            }
                        }
                        
                        if (Object.keys(room.players).length === 0) {
                            delete rooms[rid];
                        } else {
                            syncLobby(io, room);
                        }
                    }
                    break;
                }
            }
        });
    });
};
