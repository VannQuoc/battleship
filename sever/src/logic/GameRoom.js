// server/src/logic/GameRoom.js

const Player = require('../models/Player');
const Unit = require('../models/Unit');
const ItemSystem = require('./ItemSystem');
const CommanderSystem = require('./CommanderSystem'); 
const { CONSTANTS, UNITS, ITEMS, TERRAIN } = require('../config/definitions');

/**
 * Lớp quản lý logic của một phòng game - Support up to 10 players
 */
class GameRoom {
    constructor(id, config = {}) {
        this.id = id;
        this.hostId = null; // ID của chủ phòng
        
        // Calculate map size based on player count
        const maxPlayers = Math.min(
            config.maxPlayers || 2, 
            CONSTANTS.MAX_PLAYERS || 10
        );
        const baseMapSize = config.mapSize || this.calculateMapSize(maxPlayers);
        
        this.config = {
            mapSize: baseMapSize,
            startingPoints: config.points || CONSTANTS.DEFAULT_POINTS || 3000,
            maxPlayers: maxPlayers
        };
        
        // Map Data
        this.mapData = this.generateMap(this.config.mapSize);

        this.players = {}; // map socketId -> Player
        this.turnQueue = [];
        this.turnIndex = 0;
        this.turnNumber = 0; // Đếm số lượt (dùng cho cooldown)
        this.status = 'LOBBY'; // LOBBY, SETUP, BATTLE, ENDED
        this.winner = null;
        this.logs = [];
        this.pendingEvents = [];
    }

    // Calculate map size based on player count
    calculateMapSize(playerCount) {
        const base = CONSTANTS.MAP_SIZE_BASE || 20;
        const perPlayer = CONSTANTS.MAP_SIZE_PER_PLAYER || 5;
        return base + (playerCount * perPlayer);
    }

    // Map Generator
    generateMap(size) {
        const map = Array(size).fill().map(() => Array(size).fill(TERRAIN.WATER));
        
        // Random Islands (~5%)
        const islandCount = Math.floor(size * size * 0.05);
        for(let i = 0; i < islandCount; i++) {
            const x = Math.floor(Math.random() * size);
            const y = Math.floor(Math.random() * size);
            map[x][y] = TERRAIN.ISLAND;
        }

        // Random Reefs (~3%)
        const reefCount = Math.floor(size * size * 0.03);
        for(let i = 0; i < reefCount; i++) {
            const x = Math.floor(Math.random() * size);
            const y = Math.floor(Math.random() * size);
            if (map[x][y] === TERRAIN.WATER) map[x][y] = TERRAIN.REEF;
        }

        return map;
    }

    // Bresenham Line of Sight
    checkLineOfSight(x0, y0, x1, y1) {
        let dx = Math.abs(x1 - x0);
        let dy = Math.abs(y1 - y0);
        let sx = (x0 < x1) ? 1 : -1;
        let sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;

        while (true) {
            if (x0 === x1 && y0 === y1) break;
            
            if (this.mapData[x0] && this.mapData[x0][y0] === TERRAIN.ISLAND) {
                return false;
            }

            let e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x0 += sx; }
            if (e2 < dx) { err += dx; y0 += sy; }
        }
        return true; 
    }

    // Add Player
    addPlayer(id, name) {
        if (Object.keys(this.players).length >= this.config.maxPlayers) return false;

        const newPlayer = new Player(id, name);
        newPlayer.points = this.config.startingPoints;
        newPlayer.activeEffects = { jammer: 0, admiralVision: 0 };
        newPlayer.buildingDiscount = 0; 
        
        // First player is host
        if (Object.keys(this.players).length === 0) {
            this.hostId = id;
        }
        
        this.players[id] = newPlayer;
        return true;
    }

    // Get all other players (for multiplayer)
    getOtherPlayers(myId) {
        return Object.values(this.players).filter(p => p.id !== myId);
    }

    // Get opponent (for 2 player mode)
    getOpponent(myId) {
        const opId = Object.keys(this.players).find(id => id !== myId);
        return this.players[opId];
    }

    // Get all players data for lobby display
    getAllPlayersPublicData() {
        const data = {};
        for (const [id, player] of Object.entries(this.players)) {
            data[id] = player.toPublicData();
        }
        return data;
    }

    // Player ready toggle
    setPlayerReady(playerId, ready = true) {
        const player = this.players[playerId];
        if (!player) return false;
        if (this.status !== 'LOBBY') return false;
        
        player.ready = ready;
        return true;
    }

    // Check if all players ready
    areAllPlayersReady() {
        const players = Object.values(this.players);
        const minPlayers = CONSTANTS.MIN_PLAYERS || 2;
        if (players.length < minPlayers) return false;
        return players.every(p => p.ready);
    }

    // Host starts game (transitions to SETUP)
    startGame(hostId) {
        if (hostId !== this.hostId) return { error: 'Only host can start' };
        if (!this.areAllPlayersReady()) return { error: 'Not all players ready' };
        if (Object.keys(this.players).length < (CONSTANTS.MIN_PLAYERS || 2)) {
            return { error: 'Not enough players' };
        }
        
        // Reset ready state for deployment phase
        // In SETUP, ready means "has deployed fleet"
        Object.values(this.players).forEach(player => {
            player.ready = false;
        });
        
        this.status = 'SETUP';
        console.log('[START GAME] Transitioned to SETUP, all players ready reset to false');
        return { success: true };
    }

    // Deploy Fleet
    deployFleet(playerId, shipsData) {
        console.log(`[DEPLOY] Player ${playerId} deploying ${shipsData?.length || 0} units`);
        
        if (!shipsData || !Array.isArray(shipsData)) {
            return { success: false, error: 'Invalid ships data' };
        }
        
        if (this.status !== 'SETUP') {
            return { success: false, error: `Cannot deploy in status: ${this.status}` };
        }

        const player = this.players[playerId];
        if (!player) {
            return { success: false, error: 'Player not found' };
        }
        if (player.ready) {
            return { success: false, error: 'Already deployed' };
        }

        const tempFleet = []; 
        const occupiedMap = new Set(); 
        const tempInventory = { ...player.inventory };

        console.log(`[DEPLOY] Player inventory:`, JSON.stringify(tempInventory));

        for (const s of shipsData) {
            const def = UNITS[s.code];
            if (!def) {
                return { success: false, error: `Unknown unit: ${s.code}` };
            }

            // Validate Structure ownership
            if (def.type === 'STRUCTURE') {
                console.log(`[DEPLOY] Checking structure ${s.code}, inventory has: ${tempInventory[s.code] || 0}`);
                if (!tempInventory[s.code] || tempInventory[s.code] <= 0) {
                    return { success: false, error: `You don't own ${s.code}` };
                }
                tempInventory[s.code]--;
                if (tempInventory[s.code] <= 0) {
                    delete tempInventory[s.code];
                }
            }

            // Validate Position & Terrain
            const size = def.size;
            for(let i = 0; i < size; i++) {
                // vertical=true: ship extends DOWN (rows), x increases
                // vertical=false: ship extends RIGHT (columns), y increases
                const cx = s.vertical ? s.x + i : s.x;
                const cy = s.vertical ? s.y : s.y + i;

                // Bounds check
                if (cx < 0 || cy < 0 || cx >= this.config.mapSize || cy >= this.config.mapSize) {
                    return { success: false, error: `${s.code} out of bounds at (${cx},${cy})` };
                }
                
                // Collision check
                const key = `${cx},${cy}`;
                if (occupiedMap.has(key)) {
                    return { success: false, error: `${s.code} overlaps at (${cx},${cy})` };
                }
                occupiedMap.add(key);

                // Terrain check
                const terrain = this.mapData[cx] ? this.mapData[cx][cy] : undefined;
                if (terrain === undefined) {
                    return { success: false, error: `Invalid map position (${cx},${cy})` };
                }
                if (terrain !== TERRAIN.WATER) {
                    const terrainName = terrain === TERRAIN.ISLAND ? 'Island' : terrain === TERRAIN.REEF ? 'Reef' : 'obstacle';
                    return { success: false, error: `${s.code} on ${terrainName} at (${cx},${cy})` };
                }
            }

            // Create Unit
            const unit = new Unit(
                `${playerId}_${s.code}_${Date.now()}_${tempFleet.length}`, 
                def, s.x, s.y, s.vertical, playerId
            );
            
            // Commander Passives
            if (player.commander === 'ADMIRAL' && unit.type === 'SHIP') {
                unit.maxHp = Math.floor(unit.maxHp * 1.2);
                unit.hp = unit.maxHp;
            }
            if (player.commander === 'SPY' && unit.code === 'SS') {
                unit.moveRange += 2;
            }
            
            tempFleet.push(unit);
        }

        // Commit
        console.log(`[DEPLOY] Success! Deployed ${tempFleet.length} units for player ${player.name}`);
        player.inventory = tempInventory;
        player.fleet = tempFleet;
        player.ready = true;
        
        this.checkStartBattle();
        return { success: true };
    }

    checkStartBattle() {
        const allReady = Object.values(this.players).every(p => p.ready && p.fleet.length > 0);
        const playerCount = Object.keys(this.players).length;

        if (allReady && playerCount >= (CONSTANTS.MIN_PLAYERS || 2)) {
            this.status = 'BATTLE';
            this.turnQueue = Object.keys(this.players);
            this.turnIndex = 0;
            this.logs.push({ type: 'GAME_START', msg: 'The battle begins!' });
            return true;
        }
        return false;
    }

    isOccupied(x, y, excludeUnitId = null) {
        for(const pid in this.players) {
            for(const u of this.players[pid].fleet) {
                if (u.id === excludeUnitId) continue;
                if (u.occupies(x, y)) return true;
            }
        }
        return false;
    }

    moveUnit(playerId, unitId, newX, newY) {
        if (this.status !== 'BATTLE') throw new Error('Not in battle');
        if (this.turnQueue[this.turnIndex] !== playerId) throw new Error('Not your turn');

        const player = this.players[playerId];
        const unit = player.fleet.find(u => u.id === unitId);

        if (!unit || unit.isSunk) throw new Error('Invalid Unit');
        if (unit.isImmobilized) throw new Error('Engine Broken');
        if (unit.type === 'STRUCTURE') throw new Error('Structures cannot move');

        // Movement restriction: Ships can only move along their axis
        // vertical ship (extending down) can only move vertically (change X)
        // horizontal ship (extending right) can only move horizontally (change Y)
        if (unit.vertical) {
            // Vertical ship - can only change X (move up/down), Y must stay same
            if (newY !== unit.y) {
                throw new Error('Vertical ship can only move up/down');
            }
        } else {
            // Horizontal ship - can only change Y (move left/right), X must stay same
            if (newX !== unit.x) {
                throw new Error('Horizontal ship can only move left/right');
            }
        }

        const dist = Math.abs(newX - unit.x) + Math.abs(newY - unit.y);
        if (dist > unit.moveRange) throw new Error('Out of range');

        const size = unit.definition.size;
        for(let i = 0; i < size; i++) {
            const cx = unit.vertical ? newX + i : newX;
            const cy = unit.vertical ? newY : newY + i;

            if (cx >= this.config.mapSize || cy >= this.config.mapSize || cx < 0 || cy < 0) {
                throw new Error('Out of bounds');
            }
            if (this.isOccupied(cx, cy, unit.id)) throw new Error(`Blocked at ${cx},${cy}`);

            const terrain = this.mapData[cx][cy];
            if (terrain === TERRAIN.ISLAND) throw new Error('Blocked by Island');
            
            if (terrain === TERRAIN.REEF) {
                if (unit.definition.size >= 4 || unit.code === 'SS') {
                    throw new Error('Blocked by Reef');
                }
            }
        }

        const oldX = unit.x;
        const oldY = unit.y;
        unit.updateCells(newX, newY, unit.vertical);
        this.logs.push({ action: 'MOVE', playerId, unitId, from: {x: oldX, y: oldY}, to: {x: newX, y: newY} });
        this.nextTurn();
        return { success: true };
    }

    /**
     * Teleport unit (ENGINE_BOOST) - có thể xoay hướng
     * @param {boolean} rotate - true để xoay hướng thuyền
     */
    teleportUnit(playerId, unitId, x, y, rotate = false) {
        const player = this.players[playerId];
        const unit = player.fleet.find(u => u.id === unitId);
        
        if (!unit || unit.isSunk) throw new Error('Invalid Unit');

        // Xác định hướng mới (xoay nếu cần)
        const newVertical = rotate ? !unit.vertical : unit.vertical;

        const size = unit.definition.size;
        for(let i = 0; i < size; i++) {
            const cx = newVertical ? x + i : x;
            const cy = newVertical ? y : y + i;

            if (cx >= this.config.mapSize || cy >= this.config.mapSize || cx < 0 || cy < 0) {
                throw new Error('Out of bounds');
            }
            if (this.isOccupied(cx, cy, unit.id)) throw new Error('Teleport blocked');
            if (this.mapData[cx][cy] === TERRAIN.ISLAND) throw new Error('Cannot teleport onto Island');
        }
        
        // Cập nhật vị trí và hướng mới
        unit.updateCells(x, y, newVertical);
        this.logs.push({ action: 'TELEPORT', playerId, unitId, to: {x, y}, rotated: rotate });
    }

    fireShot(attackerId, x, y, preferredUnitId = null) {
        if (this.status !== 'BATTLE') return { error: 'Not in battle' };
        if (this.turnQueue[this.turnIndex] !== attackerId) return { error: 'Not your turn' };

        const attacker = this.players[attackerId];
        let firingUnit = null;

        if (preferredUnitId) {
            const u = attacker.fleet.find(u => u.id === preferredUnitId);
            if (u && !u.isSunk && (u.type === 'SHIP' || u.type === 'STRUCTURE')) {
                const dist = Math.abs(u.x - x) + Math.abs(u.y - y);
                let maxRange = this.getUnitRange(u);
                if (dist <= maxRange) {
                    firingUnit = u;
                }
            }
        }

        if (!firingUnit) {
            for (const u of attacker.fleet) {
                if (u.isSunk || (u.type !== 'SHIP' && u.type !== 'STRUCTURE')) continue;
                const dist = Math.abs(u.x - x) + Math.abs(u.y - y);
                let maxRange = this.getUnitRange(u);
                if (dist <= maxRange) {
                    firingUnit = u;
                    break; 
                }
            }
        }

        if (!firingUnit) return { error: 'No unit in range' };

        if (firingUnit.definition.trajectory === 'DIRECT') {
            const isClear = this.checkLineOfSight(firingUnit.x, firingUnit.y, x, y);
            if (!isClear) {
                this.nextTurn();
                this.logs.push({ turn: this.logs.length, attacker: attackerId, unit: firingUnit.code, x, y, result: 'BLOCKED_TERRAIN' });
                return { result: 'BLOCKED_TERRAIN', msg: 'Shot blocked by Island' };
            }
        }

        let finalResult = 'MISS';
        let sunkShipsList = [];
        let damage = firingUnit.definition.damage || 1;

        for (const pid in this.players) {
            if (pid === attackerId) continue;

            const opponent = this.players[pid];
            for (const targetUnit of opponent.fleet) {
                if (!targetUnit.isSunk && targetUnit.occupies(x, y)) {
                    if (firingUnit.code === 'CL' && targetUnit.type === 'SHIP') {
                        finalResult = 'NO_EFFECT';
                        continue;
                    }

                    // Truyền turnNumber để check cooldown (không bắn cùng ô trong 2 turn)
                    const status = targetUnit.takeDamage(damage, x, y, this.turnNumber || 0);

                    if (status === 'HIT' || status === 'CRITICAL' || status === 'SUNK') {
                        finalResult = 'HIT';
                        attacker.points += 50;
                        if (status === 'SUNK') {
                            sunkShipsList.push(targetUnit.code);
                            attacker.points += 200;
                        }
                    } else if (status === 'ALREADY_HIT_PART' || status === 'CELL_ON_COOLDOWN') {
                        // Ô này đã bị bắn và chưa hết cooldown
                        if (finalResult === 'MISS') finalResult = 'CELL_COOLDOWN';
                    }
                }
            }
        }

        this.logs.push({ 
            turn: this.logs.length, 
            attacker: attackerId, 
            unit: firingUnit.code,
            x, y, 
            result: finalResult, 
            sunk: sunkShipsList 
        });

        if (this.checkWinCondition()) {
            return { result: finalResult, sunk: sunkShipsList, winner: this.winner, gameEnded: true };
        }

        this.nextTurn();
        return { result: finalResult, sunk: sunkShipsList };
    }

    getUnitRange(u) {
        if (u.definition.range !== undefined && u.definition.range === -1) return 999;
        if (u.definition.rangeFactor) return this.config.mapSize * u.definition.rangeFactor;
        return u.vision + 2;
    }

    checkWinCondition() {
        const alivePlayers = [];
        
        for (const playerId in this.players) {
            const player = this.players[playerId];
            const remainingShips = player.fleet.filter(u => u.type === 'SHIP' && !u.isSunk);
            
            if (remainingShips.length > 0) {
                alivePlayers.push(playerId);
            }
        }
        
        // Only 1 player with ships remaining = winner
        if (alivePlayers.length === 1) {
            this.status = 'ENDED';
            this.winner = alivePlayers[0];
            return true;
        }
        
        // No players have ships = draw (shouldn't happen)
        if (alivePlayers.length === 0) {
            this.status = 'ENDED';
            this.winner = null;
            return true;
        }
        
        return false;
    }

    /**
     * Deploy a structure during battle (từ inventory)
     */
    deployStructureInBattle(playerId, structureCode, x, y, vertical = false) {
        if (this.status !== 'BATTLE') return { success: false, error: 'Not in battle' };
        if (this.turnQueue[this.turnIndex] !== playerId) return { success: false, error: 'Not your turn' };
        
        const player = this.players[playerId];
        
        // Check if player owns this structure in inventory
        if (!player.hasItem(structureCode)) {
            return { success: false, error: 'Structure not in inventory' };
        }
        
        const structDef = UNITS[structureCode];
        if (!structDef || structDef.type !== 'STRUCTURE') {
            return { success: false, error: 'Invalid structure' };
        }
        
        // Validate position
        for (let i = 0; i < structDef.size; i++) {
            const cx = vertical ? x + i : x;
            const cy = vertical ? y : y + i;
            
            if (cx < 0 || cy < 0 || cx >= this.config.mapSize || cy >= this.config.mapSize) {
                return { success: false, error: 'Out of bounds' };
            }
            
            const terrain = this.mapData[cx][cy];
            if (terrain === TERRAIN.ISLAND) {
                return { success: false, error: 'Cannot place on Island' };
            }
            
            if (this.isOccupied(cx, cy)) {
                return { success: false, error: 'Position occupied' };
            }
        }
        
        // Remove from inventory and create unit
        player.removeItem(structureCode);
        
        const unit = new Unit(
            `${structureCode}_${Date.now()}`,
            structDef,
            x, y,
            vertical,
            playerId
        );
        player.fleet.push(unit);
        
        this.logs.push({ action: 'DEPLOY_STRUCTURE', playerId, structureCode, x, y });
        this.nextTurn();
        
        return { success: true };
    }

    useItem(playerId, itemId, params) {
        if (this.status !== 'BATTLE') throw new Error('Game not in battle phase');
        if (this.turnQueue[this.turnIndex] !== playerId) throw new Error('Not your turn');
        
        const player = this.players[playerId];
        const itemDef = ITEMS[itemId];

        if (!itemDef) throw new Error('Item definition not found');
        if (itemDef.type !== 'SKILL' && !player.hasItem(itemId)) throw new Error('Item not owned');
        
        const result = ItemSystem.applyItem(this, player, itemId, params);
        
        if (itemDef.type !== 'SKILL') {
            player.removeItem(itemId);
        }
        
        this.logs.push({ action: 'ITEM', itemId, playerId, result });

        if (this.checkWinCondition()) {
            return { ...result, winner: this.winner, gameEnded: true };
        }

        this.nextTurn(); 
        return result;
    }

    nextTurn() {
        this.turnIndex = (this.turnIndex + 1) % this.turnQueue.length;
        this.turnNumber++; // Tăng số lượt (dùng cho cooldown)
        const currentPlayerId = this.turnQueue[this.turnIndex];
        const player = this.players[currentPlayerId];

        if (!player) return;

        // Reduce active effects
        if (player.activeEffects.jammer > 0) player.activeEffects.jammer--;
        if (player.activeEffects.admiralVision > 0) player.activeEffects.admiralVision--;

        // Unit passives
        player.fleet.forEach(u => {
            if (u.revealedTurns > 0) u.revealedTurns--;
            if (u.isSunk) return;

            if (u.code === 'SILO' && u.chargingTurns > 0) u.chargingTurns--;

            if (u.type !== 'STRUCTURE') return;
            u.turnCounter++;

            if (u.code === 'SUPPLY') {
                const range = 1;
                player.fleet.forEach(friend => {
                    if (!friend.isSunk && Math.abs(friend.x - u.x) <= range && Math.abs(friend.y - u.y) <= range) {
                        friend.hp = Math.min(friend.maxHp, friend.hp + 5);
                        if (friend.hp > friend.maxHp * CONSTANTS.CRITICAL_THRESHOLD) friend.isImmobilized = false;
                    }
                });
            }

            if (u.code === 'NUCLEAR_PLANT' && u.turnCounter >= 10) {
                const added = player.addItem('NUKE');
                if (added) {
                    u.turnCounter = 0;
                    this.logs.push({ action: 'PASSIVE_GENERATE', playerId: player.id, item: 'NUKE' });
                }
            }
            
            if (u.code === 'AIRFIELD' && u.turnCounter >= 3) {
                const added = player.addItem('DRONE');
                if (added) {
                    u.turnCounter = 0;
                    this.logs.push({ action: 'PASSIVE_GENERATE', playerId: player.id, item: 'DRONE' });
                }
            }
        });

        // Pending events
        this.pendingEvents = this.pendingEvents.filter(ev => {
            if (ev.ownerId === currentPlayerId) {
                ev.turnsLeft--;
                
                if (ev.turnsLeft <= 0 && ev.type === 'ASSASSINATE') {
                    // Find target in any player's fleet
                    for (const pid in this.players) {
                        if (pid === ev.ownerId) continue;
                        const targetUnit = this.players[pid].fleet.find(t => t.id === ev.targetId);
                        if (targetUnit && !targetUnit.isSunk) {
                            targetUnit.takeDamage(999);
                            this.logs.push({ action: 'ASSASSINATION', targetId: ev.targetId });
                            this.checkWinCondition(); 
                        }
                    }
                    return false;
                }
            }
            return true;
        });
    }

    getStateFor(playerId, revealAll = false) {
        const me = this.players[playerId];
        if (!me) return null;
        
        const visionBonus = me.activeEffects.admiralVision > 0 ? 2 : 0;
        const myDestroyers = me.fleet.filter(u => u.code === 'DD' && !u.isSunk);

        // Build opponents data (for multiplayer)
        const opponents = {};
        for (const [pid, player] of Object.entries(this.players)) {
            if (pid === playerId) continue;
            
            const publicFleet = player.fleet.map(u => {
                // RevealAll mode (spy skill)
                if (revealAll) {
                    return { 
                        id: u.id,
                        code: u.code, 
                        x: u.x, 
                        y: u.y, 
                        vertical: u.vertical, 
                        isSunk: u.isSunk, 
                        hp: u.hp,
                        maxHp: u.maxHp,
                        isRevealed: true,
                        cells: u.cells,
                        type: u.type
                    };
                }

                // Sunk units always visible
                if (u.isSunk) {
                    return { 
                        id: u.id,
                        code: u.code, 
                        x: u.x, 
                        y: u.y, 
                        vertical: u.vertical, 
                        isSunk: true, 
                        hp: 0,
                        maxHp: u.maxHp,
                        cells: u.cells,
                        type: u.type
                    };
                }

                // STRUCTURES: có cái hiện, có cái ẩn (dựa vào alwaysVisible)
                if (u.type === 'STRUCTURE') {
                    if (u.alwaysVisible || u.revealedTurns > 0) {
                        return { 
                            id: u.id,
                            code: u.code, 
                            x: u.x, 
                            y: u.y, 
                            vertical: u.vertical, 
                            isSunk: false, 
                            hp: u.hp,
                            maxHp: u.maxHp,
                            isRevealed: u.revealedTurns > 0,
                            cells: u.cells,
                            type: u.type
                        };
                    }
                    // Hidden structure - check vision
                    for (const myShip of me.fleet) {
                        if (myShip.isSunk) continue;
                        const dist = Math.max(Math.abs(myShip.x - u.x), Math.abs(myShip.y - u.y));
                        if (dist <= myShip.vision + visionBonus) {
                            return { 
                                id: u.id,
                                code: u.code, 
                                x: u.x, 
                                y: u.y, 
                                vertical: u.vertical, 
                                isSunk: false,
                                cells: u.cells,
                                type: u.type
                            };
                        }
                    }
                    return null;
                }

                // SHIPS: Luôn ẩn mặc định
                // Chỉ hiện khi: revealedTurns > 0 (bị lộ bởi items/actions)
                // HOẶC được phát hiện bởi Destroyer có Sonar
                
                if (u.revealedTurns > 0) {
                    return { 
                        id: u.id,
                        code: u.code, 
                        x: u.x, 
                        y: u.y, 
                        vertical: u.vertical, 
                        isSunk: false, 
                        hp: u.hp,
                        maxHp: u.maxHp,
                        isRevealed: true,
                        cells: u.cells,
                        type: u.type
                    };
                }

                // Chỉ Destroyer với Sonar có thể phát hiện ships
                for (const dd of myDestroyers) {
                    const dist = Math.max(Math.abs(dd.x - u.x), Math.abs(dd.y - u.y));
                    if (dist <= dd.vision + visionBonus) {
                        return { 
                            id: u.id,
                            code: u.code, 
                            x: u.x, 
                            y: u.y, 
                            vertical: u.vertical, 
                            isSunk: false,
                            cells: u.cells,
                            type: u.type
                        };
                    }
                }
                
                return null;
            }).filter(x => x);
            
            opponents[pid] = {
                id: pid,
                name: player.name,
                fleet: publicFleet
            };
        }

        // For 2 player compatibility
        const opponentEntries = Object.values(opponents);
        const singleOpponent = opponentEntries.length === 1 ? opponentEntries[0] : null;

        return {
            status: this.status,
            mapData: this.mapData,
            turn: this.turnQueue[this.turnIndex],
            hostId: this.hostId,
            me: { 
                id: me.id,
                name: me.name,
                points: me.points, 
                fleet: me.fleet, 
                inventory: me.inventory, // Object format
                inventoryArray: me.getInventoryArray(), // Array format
                usedSlots: me.getUsedSlots(),
                maxSlots: CONSTANTS.MAX_SLOTS || 10,
                activeEffects: me.activeEffects,
                commander: me.commander,
                commanderUsed: me.commanderUsed,
                ready: me.ready,
                buildingDiscount: me.buildingDiscount,
            },
            opponent: singleOpponent, // For 2 player mode
            opponents: opponents, // For multiplayer
            players: this.getAllPlayersPublicData(), // All players public data
            logs: this.logs,
            config: this.config,
        };
    }
}

module.exports = GameRoom;
