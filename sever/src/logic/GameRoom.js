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
        // Check if start and end are the same
        if (x0 === x1 && y0 === y1) return true;
        
        let dx = Math.abs(x1 - x0);
        let dy = Math.abs(y1 - y0);
        let sx = (x0 < x1) ? 1 : -1;
        let sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;
        
        let currentX = x0;
        let currentY = y0;

        while (true) {
            // Check current position for island (skip start position)
            if (!(currentX === x0 && currentY === y0)) {
                if (this.mapData[currentX] && this.mapData[currentX][currentY] === TERRAIN.ISLAND) {
                    return false;
                }
            }
            
            if (currentX === x1 && currentY === y1) break;

            let e2 = 2 * err;
            if (e2 > -dy) { err -= dy; currentX += sx; }
            if (e2 < dx) { err += dx; currentY += sy; }
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
            
            // Check if unit is enabled
            if (def.enabled === false) {
                return { success: false, error: `Unit ${s.code} is disabled` };
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
            
            // Commander Passives (from config)
            const { COMMANDERS } = require('../config/definitions');
            const commander = COMMANDERS[player.commander];
            if (commander && commander.enabled !== false) {
                if (player.commander === 'ADMIRAL' && unit.type === 'SHIP' && commander.passiveHpBonus) {
                    unit.maxHp = Math.floor(unit.maxHp * (1 + commander.passiveHpBonus));
                    unit.hp = unit.maxHp;
                }
                if (player.commander === 'SPY' && unit.code === 'SS' && commander.passiveSubMoveBonus) {
                    unit.moveRange += commander.passiveSubMoveBonus;
                }
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
            
            console.log(`[checkStartBattle] Battle started! Players: ${playerCount}, Turn queue:`, this.turnQueue);
            
            // Ensure all units start with revealedTurns = 0 (not revealed)
            for (const pid in this.players) {
                const player = this.players[pid];
                player.fleet.forEach(unit => {
                    if (!unit.revealedTurns) {
                        unit.revealedTurns = 0;
                    }
                });
            }
            
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
        console.log(`[MOVE_UNIT] Player ${playerId} moving unit ${unitId} to (${newX}, ${newY})`);
        
        if (this.status !== 'BATTLE') {
            console.log(`[MOVE_UNIT] Error: Not in battle (status: ${this.status})`);
            throw new Error('Not in battle');
        }
        if (this.turnQueue[this.turnIndex] !== playerId) {
            console.log(`[MOVE_UNIT] Error: Not player's turn (current: ${this.turnQueue[this.turnIndex]}, expected: ${playerId})`);
            throw new Error('Not your turn');
        }

        const player = this.players[playerId];
        const unit = player.fleet.find(u => u.id === unitId);

        if (!unit || unit.isSunk) {
            console.log(`[MOVE_UNIT] Error: Invalid unit (found: ${!!unit}, sunk: ${unit?.isSunk})`);
            throw new Error('Invalid Unit');
        }
        if (unit.isImmobilized) {
            console.log(`[MOVE_UNIT] Error: Unit ${unit.code} is immobilized`);
            throw new Error('Engine Broken');
        }
        if (unit.type === 'STRUCTURE') {
            console.log(`[MOVE_UNIT] Error: Cannot move structure`);
            throw new Error('Structures cannot move');
        }

        console.log(`[MOVE_UNIT] Unit ${unit.code} at (${unit.x}, ${unit.y}), vertical: ${unit.vertical}, moveRange: ${unit.moveRange}`);

        // Movement restriction: Ships can only move along their axis
        // vertical ship (extending down) can only move vertically (change X)
        // horizontal ship (extending right) can only move horizontally (change Y)
        if (unit.vertical) {
            // Vertical ship - can only change X (move up/down), Y must stay same
            if (newY !== unit.y) {
                console.log(`[MOVE_UNIT] Error: Vertical ship cannot change Y (${unit.y} -> ${newY})`);
                throw new Error('Vertical ship can only move up/down');
            }
        } else {
            // Horizontal ship - can only change Y (move left/right), X must stay same
            if (newX !== unit.x) {
                console.log(`[MOVE_UNIT] Error: Horizontal ship cannot change X (${unit.x} -> ${newX})`);
                throw new Error('Horizontal ship can only move left/right');
            }
        }

        // Use Manhattan distance for movement (actual distance traveled)
        const dist = Math.abs(newX - unit.x) + Math.abs(newY - unit.y);
        console.log(`[MOVE_UNIT] Distance: ${dist}, maxRange: ${unit.moveRange}`);
        if (dist > unit.moveRange) {
            console.log(`[MOVE_UNIT] Error: Out of range (${dist} > ${unit.moveRange})`);
            throw new Error('Out of range');
        }

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
        
        // Check lighthouse detection when ship moves
        this.checkLighthouseDetection(newX, newY, playerId);
        
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
            
            const terrain = this.mapData[cx][cy];
            if (terrain === TERRAIN.ISLAND) throw new Error('Cannot teleport onto Island');
            if (terrain === TERRAIN.REEF) {
                if (unit.definition.size >= 4 || unit.code === 'SS') {
                    throw new Error('Cannot teleport onto Reef');
                }
            }
        }
        
        // Cập nhật vị trí và hướng mới
        unit.updateCells(x, y, newVertical);
        this.logs.push({ action: 'TELEPORT', playerId, unitId, to: {x, y}, rotated: rotate });
    }

    fireShot(attackerId, x, y, preferredUnitId = null) {
        console.log(`[FIRE_SHOT] Player ${attackerId} firing at (${x}, ${y}), preferredUnit: ${preferredUnitId || 'none'}`);
        
        if (this.status !== 'BATTLE') {
            console.log(`[FIRE_SHOT] Error: Not in battle (status: ${this.status})`);
            return { error: 'Not in battle' };
        }
        if (this.turnQueue[this.turnIndex] !== attackerId) {
            console.log(`[FIRE_SHOT] Error: Not player's turn (current: ${this.turnQueue[this.turnIndex]}, expected: ${attackerId})`);
            return { error: 'Not your turn' };
        }

        const attacker = this.players[attackerId];
        let firingUnit = null;

        if (preferredUnitId) {
            const unit = attacker.fleet.find(unit => unit.id === preferredUnitId);
            if (unit && !unit.isSunk && (unit.type === 'SHIP' || unit.type === 'STRUCTURE')) {
                // Check range using all cells of the unit (not just x, y)
                let inRange = false;
                for (const cell of unit.cells) {
                    const dist = Math.abs(cell.x - x) + Math.abs(cell.y - y);
                    const maxRange = this.getUnitRange(unit);
                    if (dist <= maxRange) {
                        inRange = true;
                        break;
                    }
                }
                if (inRange) {
                    firingUnit = unit;
                    console.log(`[FIRE_SHOT] Using preferred unit ${unit.code} at (${unit.x}, ${unit.y})`);
                } else {
                    console.log(`[FIRE_SHOT] Preferred unit ${unit.code} out of range`);
                }
            }
        }

        if (!firingUnit) {
            for (const unit of attacker.fleet) {
                if (unit.isSunk || (unit.type !== 'SHIP' && unit.type !== 'STRUCTURE')) continue;
                // Check range using all cells of the unit
                let inRange = false;
                for (const cell of unit.cells) {
                    const dist = Math.abs(cell.x - x) + Math.abs(cell.y - y);
                    const maxRange = this.getUnitRange(unit);
                    if (dist <= maxRange) {
                        inRange = true;
                        break;
                    }
                }
                if (inRange) {
                    firingUnit = unit;
                    console.log(`[FIRE_SHOT] Auto-selected unit ${unit.code} at (${unit.x}, ${unit.y})`);
                    break; 
                }
            }
        }

        if (!firingUnit) {
            console.log(`[FIRE_SHOT] Error: No unit in range of (${x}, ${y})`);
            return { error: 'No unit in range' };
        }

        if (firingUnit.definition.trajectory === 'DIRECT') {
            // Check line of sight from firing unit's position to target
            const firingCell = firingUnit.cells[0]; // Use first cell for LOS check
            const isClear = this.checkLineOfSight(firingCell.x, firingCell.y, x, y);
            if (!isClear) {
                console.log(`[FIRE_SHOT] Shot blocked by terrain from (${firingCell.x}, ${firingCell.y}) to (${x}, ${y})`);
                this.nextTurn();
                this.logs.push({ turn: this.logs.length, attacker: attackerId, unit: firingUnit.code, x, y, result: 'BLOCKED_TERRAIN' });
                return { result: 'BLOCKED_TERRAIN', msg: 'Shot blocked by Island' };
            }
        }

        let finalResult = 'MISS';
        let sunkShipsList = [];
        let damage = firingUnit.definition.damage || 1;
        let hitUnit = null;
        let hitCell = null;

        console.log(`[FIRE_SHOT] Checking for hits at (${x}, ${y}) with damage ${damage}`);

        // Check all opponents (prevent friendly fire)
        for (const pid in this.players) {
            if (pid === attackerId) continue; // Skip self

            const opponent = this.players[pid];
            for (const targetUnit of opponent.fleet) {
                if (targetUnit.isSunk) continue;
                
                // Check if shot hits any cell of this unit
                const hitCellData = targetUnit.cells.find(cell => cell.x === x && cell.y === y);
                if (hitCellData) {
                    console.log(`[FIRE_SHOT] Hit detected! Target: ${targetUnit.code} (${targetUnit.id}), cell: (${x}, ${y}), HP before: ${targetUnit.hp}/${targetUnit.maxHp}`);
                    
                    // CL cannot attack ships
                    if (firingUnit.code === 'CL' && targetUnit.type === 'SHIP') {
                        console.log(`[FIRE_SHOT] CL cannot attack ships - NO_EFFECT`);
                        finalResult = 'NO_EFFECT';
                        continue;
                    }

                    // Apply damage with cooldown check
                    const status = targetUnit.takeDamage(damage, x, y, this.turnNumber || 0);
                    console.log(`[FIRE_SHOT] Damage applied, status: ${status}, HP after: ${targetUnit.hp}/${targetUnit.maxHp}`);

                    hitUnit = targetUnit;
                    hitCell = { x, y };

                    if (status === 'HIT' || status === 'CRITICAL' || status === 'SUNK') {
                        finalResult = 'HIT';
                        attacker.points += 50;
                        if (status === 'SUNK') {
                            sunkShipsList.push(targetUnit.code);
                            attacker.points += 200;
                            console.log(`[FIRE_SHOT] Unit ${targetUnit.code} SUNK!`);
                        }
                    } else if (status === 'CELL_ON_COOLDOWN') {
                        // Cell is on cooldown
                        console.log(`[FIRE_SHOT] Cell (${x}, ${y}) on cooldown`);
                        if (finalResult === 'MISS') finalResult = 'CELL_COOLDOWN';
                    }
                    // Only one unit can be hit at a position
                    break;
                }
            }
        }

        if (finalResult === 'MISS') {
            console.log(`[FIRE_SHOT] Miss at (${x}, ${y})`);
        }

        const logEntry = { 
            turn: this.turnNumber || this.logs.length, 
            attacker: attackerId, 
            unit: firingUnit.code,
            x, y, 
            result: finalResult, 
            sunk: sunkShipsList,
            hitUnit: hitUnit ? { code: hitUnit.code, id: hitUnit.id, hp: hitUnit.hp, maxHp: hitUnit.maxHp } : null,
            hitCell: hitCell
        };
        this.logs.push(logEntry);
        console.log(`[FIRE_SHOT] Log entry:`, JSON.stringify(logEntry));

        // Check lighthouse detection when ship shoots
        this.checkLighthouseDetection(firingUnit.x, firingUnit.y, attackerId);

        if (this.checkWinCondition()) {
            console.log(`[FIRE_SHOT] Game ended! Winner: ${this.winner}`);
            return { result: finalResult, sunk: sunkShipsList, winner: this.winner, gameEnded: true };
        }

        this.nextTurn();
        return { result: finalResult, sunk: sunkShipsList, hitUnit: hitUnit ? { code: hitUnit.code, hp: hitUnit.hp, maxHp: hitUnit.maxHp } : null };
    }

    getUnitRange(unit) {
        // Structures cannot shoot (except special cases)
        if (unit.type === 'STRUCTURE') {
            // Some structures might have range in future, but for now return 0
            return 0;
        }
        
        // Ships can shoot
        if (unit.definition.range !== undefined && unit.definition.range === -1) {
            return 999; // Infinite range (CV)
        }
        if (unit.definition.rangeFactor) {
            return Math.floor(this.config.mapSize * unit.definition.rangeFactor);
        }
        // Default range: vision + 2
        return unit.vision + 2;
    }

    checkWinCondition() {
        const alivePlayers = [];
        
        for (const playerId in this.players) {
            const player = this.players[playerId];
            // Only check ships - structures cannot attack, so player loses when all ships are sunk
            const remainingShips = player.fleet.filter(unit => unit.type === 'SHIP' && !unit.isSunk);
            
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

    chebyshevDistance(x1, y1, x2, y2) {
        return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
    }

    /**
     * Reveal ships near lighthouses when they perform actions (move, shoot, kamikaze)
     * Only reveals ships that are active (performing the action), not all ships in range
     */
    checkLighthouseDetection(unitX, unitY, ownerId) {
        // Check all players' lighthouses
        for (const pid in this.players) {
            if (pid === ownerId) continue; // Don't reveal own ships to self
            const player = this.players[pid];
            player.fleet.forEach(lighthouse => {
                if (lighthouse.isSunk || lighthouse.code !== 'LIGHTHOUSE') return;
                
                // Check if the action (at unitX, unitY) is within lighthouse vision
                const dist = this.chebyshevDistance(lighthouse.x, lighthouse.y, unitX, unitY);
                if (dist <= lighthouse.vision) {
                    // Reveal the enemy player's ships that are in lighthouse range
                    const enemyPlayer = this.players[ownerId];
                    if (enemyPlayer) {
                        enemyPlayer.fleet.forEach(ship => {
                            if (ship.isSunk || ship.type !== 'SHIP') return;
                            // Check if any cell of ship is in lighthouse range
                            for (const cell of ship.cells) {
                                const shipDist = this.chebyshevDistance(lighthouse.x, lighthouse.y, cell.x, cell.y);
                                if (shipDist <= lighthouse.vision) {
                                    ship.revealedTurns = Math.max(ship.revealedTurns || 0, 3);
                                    break; // Only need to reveal once
                                }
                            }
                        });
                    }
                }
            });
        }
    }

    revealSubmarinesAround(x, y, range, ownerId) {
        for (const pid in this.players) {
            if (pid === ownerId) continue;
            const player = this.players[pid];
            player.fleet.forEach(unit => {
                if (unit.isSunk) return;
                if (unit.type !== 'SHIP') return;
                if (!unit.definition?.isStealth) return;
                
                // Check if any cell of unit is within radar range
                for (const cell of unit.cells) {
                    const dist = this.chebyshevDistance(cell.x, cell.y, x, y);
                    if (dist <= range) {
                        unit.revealedTurns = Math.max(unit.revealedTurns || 0, 3);
                        break; // Only need to reveal once
                    }
                }
            });
        }
    }

    disruptRadarsAround(x, y, range) {
        const destroyed = [];
        for (const pid in this.players) {
            const player = this.players[pid];
            player.fleet.forEach(unit => {
                if (unit.hasRadar && !unit.isSunk) {
                    if (this.chebyshevDistance(unit.x, unit.y, x, y) <= range) {
                        unit.hasRadar = false;
                        unit.radarRange = 0;
                        destroyed.push(unit.id);
                    }
                }
            });
        }
        return destroyed;
    }

    processRadars() {
        for (const pid in this.players) {
            const player = this.players[pid];
            player.fleet.forEach(unit => {
                if (unit.isSunk) return;
                if (unit.hasRadar && unit.radarRange > 0) {
                    this.revealSubmarinesAround(unit.x, unit.y, unit.radarRange, pid);
                }
                if (unit.jammerTurns > 0) {
                    unit.jammerTurns--;
                }
            });
        }
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
        
        // Check if structure is enabled
        if (structDef.enabled === false) {
            return { success: false, error: 'Structure is disabled' };
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
            if (terrain === TERRAIN.REEF) {
                // Structures can be placed on reef (unlike ships)
                // But check if structure is too large
                if (structDef.size >= 4) {
                    return { success: false, error: 'Structure too large for Reef' };
                }
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
        // Skip to next valid player
        let attempts = 0;
        do {
            this.turnIndex = (this.turnIndex + 1) % this.turnQueue.length;
            attempts++;
            if (attempts > this.turnQueue.length) {
                // All players invalid, end game
                this.status = 'ENDED';
                return;
            }
        } while (!this.players[this.turnQueue[this.turnIndex]]);
        
        this.turnNumber++; // Tăng số lượt (dùng cho cooldown)
        const currentPlayerId = this.turnQueue[this.turnIndex];
        const player = this.players[currentPlayerId];

        if (!player) return;

        // Reduce active effects
        if (player.activeEffects.jammer > 0) player.activeEffects.jammer--;
        if (player.activeEffects.admiralVision > 0) player.activeEffects.admiralVision--;
        // Update white hats array (decrement turns and remove expired ones)
        if (Array.isArray(player.activeEffects.whiteHat)) {
            player.activeEffects.whiteHat = player.activeEffects.whiteHat
                .map(wh => ({ ...wh, turnsLeft: wh.turnsLeft - 1 }))
                .filter(wh => wh.turnsLeft > 0);
        }

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
                    if (friend.isSunk) return;
                    
                    // Check if any cell of friend unit is within SUPPLY range
                    let inRange = false;
                    for (const supplyCell of u.cells) {
                        for (const friendCell of friend.cells) {
                            const dist = this.chebyshevDistance(supplyCell.x, supplyCell.y, friendCell.x, friendCell.y);
                            if (dist <= range) {
                                inRange = true;
                                break;
                            }
                        }
                        if (inRange) break;
                    }
                    
                    if (inRange) {
                        friend.hp = Math.min(friend.maxHp, friend.hp + 5);
                        if (friend.hp > friend.maxHp * CONSTANTS.CRITICAL_THRESHOLD) friend.isImmobilized = false;
                    }
                });
            }

            if (u.code === 'NUCLEAR_PLANT' && u.turnCounter >= (CONSTANTS.NUCLEAR_PLANT_SPAWN_TURNS || 10)) {
                const added = player.addItem('NUKE');
                if (added) {
                    u.turnCounter = 0;
                    this.logs.push({ action: 'PASSIVE_GENERATE', playerId: player.id, item: 'NUKE' });
                }
            }
            
            if (u.code === 'AIRFIELD' && u.turnCounter >= (CONSTANTS.AIRFIELD_SPAWN_TURNS || 3)) {
                const added = player.addItem('PLANE');
                if (added) {
                    u.turnCounter = 0;
                    this.logs.push({ action: 'PASSIVE_GENERATE', playerId: player.id, item: 'PLANE' });
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
        this.processRadars();
    }

    getStateFor(playerId, revealAll = false) {
        const me = this.players[playerId];
        if (!me) {
            console.warn(`[getStateFor] Player ${playerId} not found`);
            return null;
        }
        
        if (revealAll) {
            console.log(`[getStateFor] RevealAll mode for player ${playerId}`);
        }
        
        const visionBonus = me.activeEffects.admiralVision > 0 ? 2 : 0;
        const myDestroyers = me.fleet.filter(u => u.code === 'DD' && !u.isSunk);
        
        console.log(`[getStateFor] Player ${playerId} has ${me.fleet.length} units, ${myDestroyers.length} destroyers, visionBonus: ${visionBonus}`);

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

                // STRUCTURES: có cái hiện, có cái ẩn (dựa vào alwaysVisible và isStealth)
                if (u.type === 'STRUCTURE') {
                    const structDef = u.definition || UNITS[u.code];
                    const isStealth = structDef?.isStealth !== undefined ? structDef.isStealth : false;
                    const alwaysVisible = structDef?.alwaysVisible !== undefined ? structDef.alwaysVisible : (u.alwaysVisible || false);
                    
                    // Always visible structures are always shown (regardless of stealth)
                    if (alwaysVisible) {
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
                    
                    // Revealed structures (by items/actions) are shown
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
                    
                    // Non-stealth structures: check vision from any ship
                    if (!isStealth) {
                        for (const myShip of me.fleet) {
                            if (myShip.isSunk) continue;
                            // Check if any cell of structure is in vision range (Chebyshev distance for square vision)
                            for (const structCell of u.cells) {
                                const dist = this.chebyshevDistance(myShip.x, myShip.y, structCell.x, structCell.y);
                                if (dist <= myShip.vision + visionBonus) {
                                    return { 
                                        id: u.id,
                                        code: u.code, 
                                        x: u.x, 
                                        y: u.y, 
                                        vertical: u.vertical, 
                                        isSunk: false,
                                        hp: u.hp,
                                        maxHp: u.maxHp,
                                        cells: u.cells,
                                        type: u.type
                                    };
                                }
                            }
                        }
                    }
                    // Stealth structures: only revealed by revealedTurns or special detection
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

                // Check stealth from definition
                const unitDef = u.definition || UNITS[u.code];
                const isStealth = unitDef?.isStealth !== undefined ? unitDef.isStealth : (u.type === 'SHIP');
                
                console.log(`[getStateFor] Checking visibility for ${u.code} (${u.id}), isStealth: ${isStealth}, revealedTurns: ${u.revealedTurns || 0}`);
                
                if (isStealth) {
                    // Stealth units: CHỈ hiển thị khi:
                    // 1. revealedTurns > 0 (đã bị reveal bởi items/actions/lighthouse)
                    // 2. HOẶC được detect bởi Destroyer có Sonar (chỉ cho SS)
                    
                    // SS chỉ bị phát hiện bởi Destroyer có Sonar
                    if (u.code === 'SS') {
                        for (const dd of myDestroyers) {
                            if (!dd.definition?.hasSonar) continue;
                            // Check if any cell of submarine is in vision range
                            for (const subCell of u.cells) {
                                const dist = this.chebyshevDistance(dd.x, dd.y, subCell.x, subCell.y);
                                if (dist <= dd.vision + visionBonus) {
                                    console.log(`[getStateFor] SS detected by Destroyer with Sonar at distance ${dist}`);
                                    return { 
                                        id: u.id,
                                        code: u.code, 
                                        x: u.x, 
                                        y: u.y, 
                                        vertical: u.vertical, 
                                        isSunk: false,
                                        hp: u.hp,
                                        maxHp: u.maxHp,
                                        cells: u.cells,
                                        type: u.type
                                    };
                                }
                            }
                        }
                        // SS not detected - return null (hidden)
                        console.log(`[getStateFor] SS not detected, returning null`);
                        return null;
                    } else {
                        // Các ship stealth khác (BB, CV, DD, etc.) CHỈ hiển thị khi revealedTurns > 0
                        // KHÔNG bị phát hiện bởi vision thông thường
                        console.log(`[getStateFor] Stealth ship ${u.code} not revealed (revealedTurns: ${u.revealedTurns || 0}), returning null`);
                        return null;
                    }
                } else {
                    // Non-stealth units: có thể bị phát hiện bởi bất kỳ ship nào trong tầm nhìn
                    for (const myShip of me.fleet) {
                        if (myShip.isSunk) continue;
                        // Check if any cell of enemy unit is in vision range
                        for (const enemyCell of u.cells) {
                            const dist = this.chebyshevDistance(myShip.x, myShip.y, enemyCell.x, enemyCell.y);
                            if (dist <= myShip.vision + visionBonus) {
                                console.log(`[getStateFor] Non-stealth unit ${u.code} detected by vision at distance ${dist}`);
                                return { 
                                    id: u.id,
                                    code: u.code, 
                                    x: u.x, 
                                    y: u.y, 
                                    vertical: u.vertical, 
                                    isSunk: false,
                                    hp: u.hp,
                                    maxHp: u.maxHp,
                                    cells: u.cells,
                                    type: u.type
                                };
                            }
                        }
                    }
                    // Non-stealth unit not in vision - return null
                    console.log(`[getStateFor] Non-stealth unit ${u.code} not in vision, returning null`);
                    return null;
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
            turnNumber: this.turnNumber, // Add turn number for cooldown calculation
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
