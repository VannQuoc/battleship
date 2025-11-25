// server/src/logic/GameRoom.js

// --- PHẦN IMPORT ---
const Player = require('../models/Player');
const Unit = require('../models/Unit');
const ItemSystem = require('./ItemSystem');
// Giả định CommanderSystem dùng để validate commander nếu cần, nhưng logic chính đã nằm trong deploy
const CommanderSystem = require('./CommanderSystem'); 
const { CONSTANTS, UNITS, ITEMS, TERRAIN } = require('../config/definitions');

/**
 * Lớp quản lý logic của một phòng game (trận đấu) - Hợp nhất V1 & V2
 */
class GameRoom {
    constructor(id, config = {}) {
        this.id = id;
        this.config = {
            mapSize: config.mapSize || CONSTANTS.DEFAULT_MAP_SIZE || 20,
            startingPoints: config.points || CONSTANTS.STARTING_POINTS || 1000,
            maxPlayers: config.maxPlayers || CONSTANTS.DEFAULT_PLAYERS || 2
        };
        
        // --- V2: KHỞI TẠO MAP DATA ---
        this.mapData = this.generateMap(this.config.mapSize);

        this.players = {}; // map socketId -> Player
        this.turnQueue = []; // Thứ tự lượt chơi
        this.turnIndex = 0;
        this.status = 'LOBBY'; // LOBBY, SETUP, BATTLE, ENDED
        this.winner = null;
        this.logs = [];

        // Quản lý sự kiện trễ (Mercenary, Spawning...) của V1
        this.pendingEvents = [];
    }

    // --- V2: MAP GENERATOR ---
    generateMap(size) {
        // Tạo mảng 2 chiều full Nước
        const map = Array(size).fill().map(() => Array(size).fill(TERRAIN.WATER));
        
        // Random Đảo (ISLAND) - Chiếm khoảng 5% map
        const islandCount = Math.floor(size * size * 0.05);
        for(let i=0; i<islandCount; i++) {
            const x = Math.floor(Math.random() * size);
            const y = Math.floor(Math.random() * size);
            map[x][y] = TERRAIN.ISLAND;
        }

        // Random Đá Ngầm (REEF) - Chiếm 3%
        const reefCount = Math.floor(size * size * 0.03);
        for(let i=0; i<reefCount; i++) {
            const x = Math.floor(Math.random() * size);
            const y = Math.floor(Math.random() * size);
            // Chỉ đặt đá nếu là nước (không đè lên đảo)
            if (map[x][y] === TERRAIN.WATER) map[x][y] = TERRAIN.REEF;
        }

        return map;
    }

    // --- V2: HELPER CHECK LINE OF SIGHT (RAYCAST) ---
    // Sử dụng thuật toán Bresenham
    checkLineOfSight(x0, y0, x1, y1) {
        let dx = Math.abs(x1 - x0);
        let dy = Math.abs(y1 - y0);
        let sx = (x0 < x1) ? 1 : -1;
        let sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;

        while (true) {
            if (x0 === x1 && y0 === y1) break; // Đã đến đích (không check ô đích)
            
            // Skip check ô đầu tiên (nơi người bắn đứng)
            // Check địa hình: Chỉ có ISLAND chặn đạn (REEF bắn qua được)
            if (this.mapData[x0][y0] === TERRAIN.ISLAND) {
                return false; // Bị chặn
            }

            let e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x0 += sx; }
            if (e2 < dx) { err += dx; y0 += sy; }
        }
        return true; 
    }

    // --- LOBBY LOGIC ---
    addPlayer(id, name) {
        if (Object.keys(this.players).length >= this.config.maxPlayers) return false;

        const newPlayer = new Player(id, name);
        newPlayer.points = this.config.startingPoints;

        // Active Effects (V1)
        newPlayer.activeEffects = {
            jammer: 0,
            admiralVision: 0,
        };
        
        // Commander Passive (V1)
        newPlayer.buildingDiscount = 0; 
        
        this.players[id] = newPlayer;
        return true;
    }

    getOpponent(myId) {
        const opId = Object.keys(this.players).find(id => id !== myId);
        return this.players[opId];
    }

    // --- DEPLOYMENT (Hợp nhất: Transactional của V1 + Check Terrain của V2) ---
    deployFleet(playerId, shipsData) {
        if (this.status !== 'LOBBY' && this.status !== 'SETUP') {
            console.error(`[DEPLOY ERROR] Cannot deploy in status: ${this.status}`);
            return false; 
        }

        const player = this.players[playerId];
        if (!player) return false;

        // 1. Transactional Variables
        const tempFleet = []; 
        const occupiedMap = new Set(); 
        const tempInventory = [...player.inventory]; 

        // 2. Validate Loop
        for (const s of shipsData) {
            const def = UNITS[s.code];
            if (!def) return false;

            // A. Validate Ownership
            if (def.type === 'STRUCTURE') {
                const index = tempInventory.indexOf(s.code);
                if (index === -1) {
                    console.warn(`[CHEATING] Player ${playerId} tried to deploy ${s.code} without owning.`);
                    return false;
                }
                tempInventory.splice(index, 1);
            }

            // B. Validate Position, Collision & TERRAIN (V2 Logic inserted here)
            const size = def.size;
            for(let i = 0; i < size; i++) {
                const cx = s.vertical ? s.x : s.x + i;
                const cy = s.vertical ? s.y + i : s.y;

                // Check Bounds
                if (cx < 0 || cy < 0 || cx >= this.config.mapSize || cy >= this.config.mapSize) return false;
                
                // Check Overlap (Unit collision)
                const key = `${cx},${cy}`;
                if (occupiedMap.has(key)) return false; 
                occupiedMap.add(key);

                // Check Terrain (V2): Không được đặt lên Đảo hoặc Đá (khi setup)
                // Lưu ý: Có thể cho phép đặt lên Reef tùy game design, nhưng an toàn là cấm hết khi setup
                if (this.mapData[cx][cy] !== TERRAIN.WATER) return false; 
            }

            // C. Create Unit
            const unit = new Unit(
                `${playerId}_${s.code}_${Date.now()}_${tempFleet.length}`, 
                def, s.x, s.y, s.vertical, playerId
            );
            
            // D. Commander Passives (V1 Logic)
            if (player.commander === 'ADMIRAL' && unit.type === 'SHIP') {
                unit.maxHp = Math.floor(unit.maxHp * 1.2);
                unit.hp = unit.maxHp;
            }
            if (player.commander === 'SPY' && unit.code === 'SS') {
                unit.moveRange += 2;
            }
            
            tempFleet.push(unit);
        }
        
        // E. Player Passive
        if (player.commander === 'ENGINEER') {
            player.buildingDiscount = CONSTANTS.ENGINEER_DISCOUNT || 0.1;
        }

        // 3. Commit
        player.inventory = tempInventory;
        player.fleet = tempFleet;
        player.ready = true;
        
        this.checkStartBattle();
        return true;
    }

    checkStartBattle() {
        const allReady = Object.values(this.players).every(p => p.ready);
        const playerCount = Object.keys(this.players).length;

        if (this.config.maxPlayers === 2 && allReady && playerCount === 2) {
             this.status = 'BATTLE';
             this.turnQueue = Object.keys(this.players);
             this.turnIndex = 0;
             this.logs.push({ type: 'GAME_START', msg: 'The battle begins!' });
        }
    }

    // --- HELPER: IS OCCUPIED (V1 Updated) ---
    isOccupied(x, y, excludeUnitId = null) {
        for(const pid in this.players) {
            for(const u of this.players[pid].fleet) {
                // Bỏ qua unit bị loại trừ (chính nó)
                if (u.id === excludeUnitId) continue;
                // Vẫn check va chạm với xác tàu (theo GDD xác tàu là vật cản)
                if (u.occupies(x, y)) return true;
            }
        }
        return false;
    }

    // --- BATTLE: MOVE UNIT (V1 + V2 Combined) ---
    moveUnit(playerId, unitId, newX, newY) {
        if (this.status !== 'BATTLE') throw new Error('Not in battle');
        if (this.turnQueue[this.turnIndex] !== playerId) throw new Error('Not your turn');

        const player = this.players[playerId];
        const unit = player.fleet.find(u => u.id === unitId);

        if (!unit || unit.isSunk) throw new Error('Invalid Unit');
        if (unit.isImmobilized) throw new Error('Engine Broken');
        if (unit.type === 'STRUCTURE') throw new Error('Structures cannot move');

        // Check Range (Manhattan)
        const dist = Math.abs(newX - unit.x) + Math.abs(newY - unit.y);
        if (dist > unit.moveRange) throw new Error('Out of range');

        // Check Collision & Terrain (Full Body Check)
        const size = unit.definition.size;
        for(let i = 0; i < size; i++) {
            const cx = unit.vertical ? newX : newX + i;
            const cy = unit.vertical ? newY + i : newY;

            // 1. Boundary
            if (cx >= this.config.mapSize || cy >= this.config.mapSize) throw new Error('Out of bounds');

            // 2. Unit Collision (Exclude Self - V1 Logic)
            if (this.isOccupied(cx, cy, unit.id)) {
                throw new Error(`Destination blocked by unit at ${cx},${cy}`);
            }

            // 3. Terrain Collision (V2 Logic)
            const terrain = this.mapData[cx][cy];
            if (terrain === TERRAIN.ISLAND) throw new Error('Blocked by Island');
            
            // Reef Logic: Chặn tàu to (Size >= 4) và Tàu ngầm (SS)
            if (terrain === TERRAIN.REEF) {
                if (unit.definition.size >= 4 || unit.code === 'SS') {
                    throw new Error('Blocked by Reef (Too large or Submarine)');
                }
            }
        }

        // Commit Move
        unit.updateCells(newX, newY, unit.vertical);
        this.logs.push({ action: 'MOVE', playerId, unitId, from: {x:unit.x, y:unit.y}, to: {x:newX, y:newY} });
        this.nextTurn();
        return { success: true };
    }

    // --- BATTLE: TELEPORT (V1 Logic + V2 Terrain Check) ---
    teleportUnit(playerId, unitId, x, y) {
        const player = this.players[playerId];
        const unit = player.fleet.find(u => u.id === unitId);
        
        if (!unit || unit.isSunk) throw new Error('Invalid Unit');

        const size = unit.definition.size;
        for(let i = 0; i < size; i++) {
            const cx = unit.vertical ? x : x + i;
            const cy = unit.vertical ? y + i : y;

            if (cx >= this.config.mapSize || cy >= this.config.mapSize) throw new Error('Out of bounds');
            if (this.isOccupied(cx, cy, unit.id)) throw new Error('Teleport destination blocked');
            
            // Check Terrain cho Teleport (Không nhảy lên đảo)
            if (this.mapData[cx][cy] === TERRAIN.ISLAND) throw new Error('Cannot teleport onto Island');
        }
        
        unit.updateCells(x, y, unit.vertical);
        this.logs.push({ action: 'TELEPORT', playerId, unitId, to: {x, y} });
    }

    // --- BATTLE: FIRE SHOT (V2 Logic - Enhanced) ---
    // preferredUnitId: Client có thể gửi unitId muốn bắn. Nếu null, server tự tìm.
    fireShot(attackerId, x, y, preferredUnitId = null) {
        if (this.status !== 'BATTLE') return { error: 'Not in battle' };
        if (this.turnQueue[this.turnIndex] !== attackerId) return { error: 'Not your turn' };

        const attacker = this.players[attackerId];
        let firingUnit = null;

        // 1. Xác định tàu bắn
        if (preferredUnitId) {
            const u = attacker.fleet.find(u => u.id === preferredUnitId);
            // Validate: Tàu phải còn sống, là SHIP/STRUCTURE, và trong tầm bắn
            if (u && !u.isSunk && (u.type === 'SHIP' || u.type === 'STRUCTURE')) {
                // Check Range
                const dist = Math.abs(u.x - x) + Math.abs(u.y - y);
                let maxRange = this.getUnitRange(u);
                if (dist <= maxRange) {
                    firingUnit = u;
                }
            }
        }

        // Nếu không có preferred hoặc preferred không hợp lệ, AUTO-SELECT tàu tốt nhất
        if (!firingUnit) {
            for (const u of attacker.fleet) {
                if (u.isSunk || (u.type !== 'SHIP' && u.type !== 'STRUCTURE')) continue;
                const dist = Math.abs(u.x - x) + Math.abs(u.y - y);
                let maxRange = this.getUnitRange(u);

                if (dist <= maxRange) {
                    firingUnit = u;
                    // Nếu là Direct Fire (cần check Raycast), ưu tiên tàu bắn cầu vồng trước để chắc ăn?
                    // Để đơn giản: Lấy tàu đầu tiên bắn tới.
                    break; 
                }
            }
        }

        if (!firingUnit) return { error: 'No unit in range' };

        // 2. Check Line of Sight (V2 Role Logic)
        if (firingUnit.definition.trajectory === 'DIRECT') {
            const isClear = this.checkLineOfSight(firingUnit.x, firingUnit.y, x, y);
            if (!isClear) {
                this.nextTurn(); // Mất lượt do bắn trúng đảo
                this.logs.push({ turn: this.logs.length, attacker: attackerId, unit: firingUnit.code, x, y, result: 'BLOCKED_TERRAIN' });
                return { result: 'BLOCKED_TERRAIN', msg: 'Shot blocked by Island' };
            }
        }

        // 3. Execute Damage
        let finalResult = 'MISS';
        let sunkShipsList = [];
        let damage = firingUnit.definition.damage || 1;

        for (const pid in this.players) {
            if (pid === attackerId) continue; // Friendly fire: No damage

            const opponent = this.players[pid];
            for (const targetUnit of opponent.fleet) {
                if (!targetUnit.isSunk && targetUnit.occupies(x, y)) {
                    
                    // V2 Logic: CL (Cruiser) bắn tàu -> No Effect (Giả định CL chỉ anti-air/sub)
                    if (firingUnit.code === 'CL' && targetUnit.type === 'SHIP') {
                        finalResult = 'NO_EFFECT';
                        continue;
                    }

                    const status = targetUnit.takeDamage(damage, x, y);

                    if (status === 'HIT' || status === 'CRITICAL' || status === 'SUNK') {
                        finalResult = 'HIT';
                        attacker.points += 50;
                        if (status === 'SUNK') {
                            sunkShipsList.push(targetUnit.code);
                            attacker.points += 200;
                        }
                    } else if (status === 'ALREADY_HIT_PART') {
                        if (finalResult === 'MISS') finalResult = 'HIT_NO_DMG';
                    }
                }
            }
        }

        // 4. Log & Win Check
        this.logs.push({ 
            turn: this.logs.length, 
            attacker: attackerId, 
            unit: firingUnit.code, // Log unit nào đã bắn
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

    // Helper: Get Range chuẩn hóa
    getUnitRange(u) {
        if (u.definition.range !== undefined && u.definition.range === -1) return 999; // Toàn map (CV, Silo)
        if (u.definition.rangeFactor) return this.config.mapSize * u.definition.rangeFactor; // BB
        return u.vision + 2; // Default logic
    }

    // --- WIN CONDITION ---
    checkWinCondition() {
        for (const playerId in this.players) {
            const player = this.players[playerId];
            // Điều kiện bại trận: Hết sạch TÀU (Không tính Structure)
            const remainingShips = player.fleet.filter(u => u.type === 'SHIP' && !u.isSunk);
            
            if (remainingShips.length === 0) {
                this.status = 'ENDED';
                this.winner = this.getOpponent(playerId).id; 
                return true;
            }
        }
        return false;
    }

    // --- USE ITEM ---
    useItem(playerId, itemId, params) {
        if (this.status !== 'BATTLE') throw new Error('Game not in battle phase');
        if (this.turnQueue[this.turnIndex] !== playerId) throw new Error('Not your turn');
        
        const player = this.players[playerId];
        const itemDef = ITEMS[itemId];

        if (!itemDef) throw new Error('Item definition not found');
        if (itemDef.type !== 'SKILL' && !player.inventory.includes(itemId)) throw new Error('Item not owned');
        
        // Gọi ItemSystem
        const result = ItemSystem.applyItem(this, player, itemId, params);
        
        // Xóa item dùng xong
        if (itemDef.type !== 'SKILL') {
            const idx = player.inventory.indexOf(itemId);
            if (idx > -1) player.inventory.splice(idx, 1);
        }
        
        this.logs.push({ action: 'ITEM', itemId, playerId, result });

        if (this.checkWinCondition()) {
            return { ...result, winner: this.winner, gameEnded: true };
        }

        this.nextTurn(); 
        return result;
    }

    // --- NEXT TURN (Full Logic from V1) ---
    nextTurn() {
        this.turnIndex = (this.turnIndex + 1) % this.turnQueue.length;
        const currentPlayerId = this.turnQueue[this.turnIndex];
        const player = this.players[currentPlayerId];

        // 1. Giảm hiệu ứng active
        if (player.activeEffects.jammer > 0) player.activeEffects.jammer--;
        if (player.activeEffects.admiralVision > 0) player.activeEffects.admiralVision--;

        // 2. Loop Unit passives
        player.fleet.forEach(u => {
            if (u.revealedTurns > 0) u.revealedTurns--;
            if (u.isSunk) return;

            // Silo Charging
            if (u.code === 'SILO' && u.chargingTurns > 0) u.chargingTurns--;

            if (u.type !== 'STRUCTURE') return;
            u.turnCounter++;

            // Healing (Supply Station)
            if (u.code === 'SUPPLY') {
                const range = 1;
                player.fleet.forEach(friend => {
                    if (!friend.isSunk && Math.abs(friend.x - u.x) <= range && Math.abs(friend.y - u.y) <= range) {
                        friend.hp = Math.min(friend.maxHp, friend.hp + 5);
                        if (friend.hp > friend.maxHp * CONSTANTS.CRITICAL_THRESHOLD) friend.isImmobilized = false;
                    }
                });
            }

            // Generate Nuke
            if (u.code === 'NUCLEAR_PLANT' && u.turnCounter >= 10) {
                const added = player.addItem('NUKE');
                if (added) {
                    u.turnCounter = 0;
                    this.logs.push({ action: 'PASSIVE_GENERATE', playerId: player.id, item: 'NUKE' });
                }
            }
            
            // Generate Drone
            if (u.code === 'AIRFIELD' && u.turnCounter >= 3) {
                const added = player.addItem('DRONE');
                if (added) {
                    u.turnCounter = 0;
                    this.logs.push({ action: 'PASSIVE_GENERATE', playerId: player.id, item: 'DRONE' });
                }
            }
        });

        // 3. Process Pending Events (Assassin/Mercenary)
        this.pendingEvents = this.pendingEvents.filter(ev => {
            if (ev.ownerId === currentPlayerId) {
                ev.turnsLeft--;
                
                if (ev.turnsLeft <= 0 && ev.type === 'ASSASSINATE') {
                    const targetPlayer = this.getOpponent(ev.ownerId);
                    const targetUnit = targetPlayer.fleet.find(t => t.id === ev.targetId);
                    
                    if (targetUnit && !targetUnit.isSunk) {
                        targetUnit.takeDamage(999);
                        this.logs.push({ action: 'ASSASSINATION', targetId: ev.targetId });
                        this.checkWinCondition(); 
                    }
                    return false; // Done
                }
            }
            return true; // Keep
        });
    }

    // --- GET STATE (Hợp nhất Logic Vision V1 + Trả về MapData V2) ---
    getStateFor(playerId, revealAll = false) {
        const me = this.players[playerId];
        const op = this.getOpponent(playerId);
        
        // V1 Vision Bonus
        const visionBonus = me.activeEffects.admiralVision > 0 ? 2 : 0;
        const myDestroyers = me.fleet.filter(u => u.code === 'DD' && !u.isSunk);

        const opPublicFleet = op ? op.fleet.map(u => {
            // A. Always Visible Cases
            if (revealAll || u.isSunk || u.revealedTurns > 0 || u.definition.alwaysVisible) {
                return { code: u.code, x: u.x, y: u.y, vertical: u.vertical, isSunk: u.isSunk, hp: u.hp, isRevealed: u.revealedTurns > 0 };
            }
            
            // B. Vision Check Logic
            let isVisible = false;
            
            if (u.isStealth) { // Submarine
                // Chỉ lộ bởi DD (Sonar)
                for (const dd of myDestroyers) {
                    const dist = Math.max(Math.abs(dd.x - u.x), Math.abs(dd.y - u.y));
                    if (dist <= dd.vision + visionBonus) {
                        isVisible = true; break;
                    }
                }
            } else { // Surface Ships
                for (const myShip of me.fleet) {
                    if (myShip.isSunk) continue;
                    const dist = Math.max(Math.abs(myShip.x - u.x), Math.abs(myShip.y - u.y));
                    if (dist <= myShip.vision + visionBonus) {
                        isVisible = true; break;
                    }
                }
            }

            if (isVisible) {
                return { code: u.code, x: u.x, y: u.y, vertical: u.vertical, isSunk: false };
            }
            
            return null; // Hidden
        }).filter(x => x) : [];

        return {
            status: this.status,
            mapData: this.mapData, // V2 Feature
            turn: this.turnQueue[this.turnIndex],
            me: { 
                points: me.points, 
                fleet: me.fleet, 
                inventory: me.inventory, 
                activeEffects: me.activeEffects 
            },
            opponent: { name: op ? op.name : 'Waiting', fleet: opPublicFleet },
            logs: this.logs
        };
    }
}

module.exports = GameRoom;