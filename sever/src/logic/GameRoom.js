const Player = require('../models/Player');
const Unit = require('../models/Unit');
const { CONSTANTS, UNITS, ITEMS } = require('../config/definitions');

/**
 * MOCK: Giả định các hệ thống này đã được định nghĩa ở nơi khác.
 * Chúng ta sẽ định nghĩa một bản mock đơn giản để GameRoom có thể chạy.
 */
const ItemSystem = {
    /**
     * Thực hiện logic của vật phẩm.
     * @param {GameRoom} room - Tham chiếu đến phòng game hiện tại.
     * @param {Player} user - Người chơi sử dụng vật phẩm.
     * @param {string} itemId - ID vật phẩm.
     * @param {object} params - Tham số sử dụng (vd: tọa độ).
     * @returns {object} Kết quả hành động.
     */
    applyItem: (room, user, itemId, params) => {
        // Đây là mock. Logic thực tế sẽ phức tạp hơn.
        if (itemId === 'RADAR') {
            // Logic: Quét 5x5
            return { type: 'SCAN', area: 25 };
        }
        if (itemId === 'ENGINE_BOOST') {
            // Giả định params chứa {unitId, x, y}
            room.teleportUnit(user.id, params.unitId, params.x, params.y);
            return { type: 'TELEPORTED' };
        }
        return { success: true };
    }
};

/**
 * Lớp quản lý logic của một phòng game (trận đấu)
 * Bao gồm trạng thái game, lượt chơi, và tương tác giữa các players.
 */
class GameRoom {
    constructor(id, config = {}) {
        this.id = id;
        this.config = {
            // Sử dụng các hằng số mặc định
            mapSize: config.mapSize || CONSTANTS.DEFAULT_MAP_SIZE || 20,
            startingPoints: config.points || CONSTANTS.STARTING_POINTS || 1000,
            maxPlayers: config.maxPlayers || CONSTANTS.DEFAULT_PLAYERS || 2
        };
        this.players = {}; // map socketId -> Player
        this.turnQueue = []; // Thứ tự lượt chơi
        this.turnIndex = 0;
        this.status = 'LOBBY'; // LOBBY, SETUP, BATTLE, ENDED
        this.logs = [];
        
        // Quản lý sự kiện trễ (Mercenary, Spawning...)
        this.pendingEvents = []; 
    }

    // --- M1: Lobby Logic ---
    addPlayer(id, name) {
        if (Object.keys(this.players).length >= this.config.maxPlayers) return false;
        
        const newPlayer = new Player(id, name);
        newPlayer.points = this.config.startingPoints; // Set point theo config
        
        // Đảm bảo Player model có activeEffects để đồng bộ với logic nextTurn/getStateFor
        newPlayer.activeEffects = {
            jammer: 0,
            admiralVision: 0,
        };
        
        this.players[id] = newPlayer;
        return true;
    }

    getOpponent(myId) {
        const opId = Object.keys(this.players).find(id => id !== myId);
        return this.players[opId];
    }

    // --- M2: Setup & Deployment ---
    deployFleet(playerId, shipsData) {
        if (this.status !== 'LOBBY' && this.status !== 'SETUP') throw new Error('Cannot deploy now');
        
        const player = this.players[playerId];
        const newFleet = [];
        const occupiedMap = new Set(); 

        // Reset fleet trước khi triển khai
        player.fleet = [];

        for (const s of shipsData) {
            const def = UNITS[s.code];
            if (!def) continue;

            const size = def.size;
            
            // 1. Check Boundary & Collision Self
            for(let i = 0; i < size; i++) {
                const cx = s.vertical ? s.x : s.x + i;
                const cy = s.vertical ? s.y + i : s.y;
                
                if (cx < 0 || cy < 0 || cx >= this.config.mapSize || cy >= this.config.mapSize) throw new Error('Ship placed out of boundary');
                
                const key = `${cx},${cy}`;
                if (occupiedMap.has(key)) throw new Error('Ships overlap each other'); 
                occupiedMap.add(key);
            }

            // Tạo Unit
            const unit = new Unit(
                `${playerId}_${s.code}_${Date.now()}_${newFleet.length}`, 
                def, 
                s.x, 
                s.y, 
                s.vertical, 
                playerId
            );
            
            // COMMANDER PASSIVE: ADMIRAL (+20% HP)
            if (player.commander === 'ADMIRAL') {
                unit.maxHp = Math.floor(unit.maxHp * 1.2);
                unit.hp = unit.maxHp;
            }
            // COMMANDER PASSIVE: SPY (SS movement + 2)
            if (player.commander === 'SPY' && unit.code === 'SS') {
                unit.moveRange += 2;
            }

            newFleet.push(unit);
        }
        
        player.fleet = newFleet;
        player.ready = true;
        
        this.checkStartBattle();
        return true;
    }

    checkStartBattle() {
        const allReady = Object.values(this.players).every(p => p.ready);
        const playerCount = Object.keys(this.players).length;

        if (this.config.maxPlayers === 2 && allReady && playerCount === 2) {
             this.status = 'BATTLE';
             // Khởi tạo thứ tự lượt chơi (có thể Randomize nếu cần)
             this.turnQueue = Object.keys(this.players); 
             this.turnIndex = 0;
             this.logs.push({ type: 'GAME_START', msg: 'The battle begins!' });
        }
    }

    isOccupied(x, y) {
        for(const pid in this.players) {
            for(const u of this.players[pid].fleet) {
                // Tàu sống hoặc xác tàu đều block đường đi
                if(u.occupies(x, y)) return true; 
            }
        }
        return false;
    }

    // --- M3: Battle Loop: Move Unit ---
    moveUnit(playerId, unitId, newX, newY) {
        if (this.status !== 'BATTLE') throw new Error('Not in battle');
        if (this.turnQueue[this.turnIndex] !== playerId) throw new Error('Not your turn');

        const player = this.players[playerId];
        const unit = player.fleet.find(u => u.id === unitId);
        
        // Validate
        if (!unit || unit.isSunk) throw new Error('Invalid Unit');
        if (unit.isImmobilized) throw new Error('Unit engine broken'); 
        if (unit.type === 'STRUCTURE') throw new Error('Structures cannot move');
        
        // Check range (Manhattan distance)
        const dist = Math.abs(newX - unit.x) + Math.abs(newY - unit.y);
        if (dist > unit.moveRange) throw new Error('Out of range');

        // Check Collision: Chỉ cần check điểm cuối, vì tàu di chuyển 1 ô/lượt
        if (this.isOccupied(newX, newY)) throw new Error('Destination blocked');
        
        // Execute Move
        const oldX = unit.x;
        const oldY = unit.y;
        
        // CẬP NHẬT TỌA ĐỘ VÀ HITBOX (Fix từ V3)
        unit.updateCells(newX, newY, unit.vertical);
        
        this.logs.push({ action: 'MOVE', playerId, unitId, from: {x:oldX, y:oldY}, to: {x:newX, y:newY} });
        this.nextTurn();
        return { success: true };
    }
    
    // FIX 2: CHUẨN HÓA HÀM TELEPORT
    teleportUnit(playerId, unitId, x, y) {
        const player = this.players[playerId];
        if (!player) throw new Error('Player not found');
        
        const unit = player.fleet.find(u => u.id === unitId);
        if (!unit || unit.isSunk) throw new Error('Invalid Unit or already sunk');

        // Validate vị trí (bao gồm out of bounds)
        if (x < 0 || y < 0 || x >= this.config.mapSize || y >= this.config.mapSize) throw new Error('Out of bounds');
        // Vẫn phải check va chạm đè lên tàu khác
        if(this.isOccupied(x, y)) throw new Error('Destination blocked');
        
        const oldX = unit.x;
        const oldY = unit.y;
        
        // Update tọa độ và hitbox
        unit.updateCells(x, y, unit.vertical);
        this.logs.push({ action: 'TELEPORT', playerId, unitId, from: {x:oldX, y:oldY}, to: {x, y} });
    }

    // --- M4: Battle Loop: Fire Shot ---
    fireShot(attackerId, x, y) {
        if (this.status !== 'BATTLE') return { error: 'Not in battle' };
        if (this.turnQueue[this.turnIndex] !== attackerId) return { error: 'Not your turn' };

        const attacker = this.players[attackerId];
        const defender = this.getOpponent(attackerId);
        if (!defender) return { error: 'Opponent not found' };

        // 1. Check Passive Counter: FLARES vs MISSILE (Giả định Flares chặn mọi loại đạn)
        if (defender.hasItem('FLARES')) {
            defender.removeItem('FLARES');
            this.logs.push({ action: 'ITEM_BLOCK', itemId: 'FLARES', defenderId: defender.id });
            this.nextTurn();
            return { result: 'BLOCKED', msg: 'Shot blocked by Flares' };
        }

        let hitResult = 'MISS';
        let sunkShip = null;

        // 2. Check Hit
        for (const unit of defender.fleet) {
            if (!unit.isSunk && unit.occupies(x, y)) {
                // Commander Passive: ASSASSIN (+1 Critical Damage)
                const damage = attacker.commander === 'ASSASSIN' ? 2 : 1;
                
                const status = unit.takeDamage(damage, x, y); 
                hitResult = status; // HIT, CRITICAL, SUNK
                
                attacker.points += CONSTANTS.POINTS_PER_HIT || 10;
                if (status === 'SUNK') {
                    sunkShip = unit.code;
                    attacker.points += CONSTANTS.POINTS_PER_KILL || 100;
                    this.logs.push({ action: 'SUNK', unitId: unit.id, unitCode: unit.code, targetId: defender.id });
                }
                break; 
            }
        }

        this.logs.push({ action: 'SHOT', attacker: attackerId, x, y, result: hitResult });

        // 3. Check Win
        const allSunk = defender.fleet.every(u => u.isSunk);
        if (allSunk) {
            this.status = 'ENDED';
            this.logs.push({ type: 'GAME_END', winner: attackerId });
            return { result: hitResult, sunkShip, winner: attackerId };
        }

        this.nextTurn();
        return { result: hitResult, sunkShip };
    }

    // --- M5: Item Usage ---
    useItem(playerId, itemId, params) {
        if (this.status !== 'BATTLE') throw new Error('Not in battle');
        if (this.turnQueue[this.turnIndex] !== playerId) throw new Error('Not your turn');
        
        const player = this.players[playerId];
        
        if (!player.hasItem(itemId)) throw new Error('Item not owned');
        
        const result = ItemSystem.applyItem(this, player, itemId, params); 
        player.removeItem(itemId);
        
        this.logs.push({ action: 'ITEM_USE', itemId, playerId, result });
        this.nextTurn(); 
        return result;
    }

    // --- M6: Turn Cycle & Passive Effects ---
    nextTurn() {
        this.turnIndex = (this.turnIndex + 1) % this.turnQueue.length;
        const currentPlayerId = this.turnQueue[this.turnIndex];
        const player = this.players[currentPlayerId];

        this.logs.push({ type: 'NEW_TURN', playerId: currentPlayerId });

        // 1. Giảm hiệu ứng Active (Đồng bộ với logic Player.activeEffects)
        if (player.activeEffects.jammer > 0) player.activeEffects.jammer--;
        if (player.activeEffects.admiralVision > 0) player.activeEffects.admiralVision--;

        // 2. Xử lý Structures Passive
        player.fleet.forEach(u => {
            if (u.isSunk || u.type !== 'STRUCTURE') return;
            
            u.turnCounter++; 

            // SUPPLY: Hồi máu AOE (3x3 around)
            if (u.code === 'SUPPLY') {
                const range = 1; // 3x3 (1 ô loang ra)
                player.fleet.forEach(friend => {
                    if (!friend.isSunk && Math.abs(friend.x - u.x) <= range && Math.abs(friend.y - u.y) <= range) {
                        
                        // FIX 3: SỬA LƯỢNG MÁU HỒI VÀ ĐIỀU KIỆN SỬA ĐỘNG CƠ (từ V3)
                        const maxHeal = 5; 
                        friend.hp = Math.min(friend.maxHp, friend.hp + maxHeal);
                        
                        // Nếu máu > Ngưỡng Crit (~50%) -> Hết hỏng động cơ
                        if (friend.hp > friend.maxHp * (CONSTANTS.CRITICAL_THRESHOLD || 0.5)) {
                            friend.isImmobilized = false;
                        }
                        this.logs.push({ action: 'HEAL', unitId: friend.id, amount: maxHeal });
                    }
                });
            }

            // NUCLEAR PLANT: Gen Item NUKE sau 10 lượt
            if (u.code === 'NUCLEAR_PLANT' && u.turnCounter >= 10) {
                const success = player.addItem('NUKE');
                if (success) { 
                    u.turnCounter = 0; // Reset counter nếu thêm thành công
                    this.logs.push({ action: 'ITEM_GEN', itemId: 'NUKE', playerId: player.id });
                }
            }
            
            // AIRFIELD: Gen Item DRONE sau 3 lượt
            if (u.code === 'AIRFIELD' && u.turnCounter >= 3) {
                const success = player.addItem('DRONE');
                if (success) {
                    u.turnCounter = 0;
                    this.logs.push({ action: 'SPAWN', msg: 'Airfield launched a patrol drone', playerId: player.id });
                }
            }
        });

        // 3. Xử lý Pending Events
        this.pendingEvents = this.pendingEvents.filter(ev => {
            // Chỉ xử lý event của người chơi đang đến lượt
            if (ev.ownerId === currentPlayerId) {
                ev.turnsLeft--;
                if (ev.turnsLeft <= 0 && ev.type === 'ASSASSINATE') {
                    const targetPlayer = this.getOpponent(ev.ownerId);
                    const targetUnit = targetPlayer?.fleet.find(t => t.id === ev.targetId);
                    
                    if (targetUnit && !targetUnit.isSunk) {
                        targetUnit.takeDamage(999); // One-shot kill
                        this.logs.push({ action: 'ASSASSINATION_COMPLETE', targetId: ev.targetId, targetPlayerId: targetPlayer.id });
                        // Check Win sau khi ám sát
                        const allSunk = targetPlayer.fleet.every(u => u.isSunk);
                        if (allSunk) this.status = 'ENDED';
                    } else {
                        this.logs.push({ action: 'ASSASSINATION_FAIL', targetId: ev.targetId, reason: targetUnit ? 'Sunk' : 'Not Found' });
                    }
                    return false; // Remove event
                }
            }
            return true; // Keep event
        });
        
        // Kiểm tra kết thúc game sau các passive
        if (this.status === 'ENDED') return;
    }

    // --- M7: Security: Fog of War Filtering ---
    getStateFor(playerId, revealAll = false) {
        const me = this.players[playerId];
        const op = this.getOpponent(playerId);
        
        // Trạng thái đơn giản khi chưa có đối thủ
        if (!op) {
            return {
                status: this.status,
                turn: this.turnQueue[this.turnIndex],
                me: { points: me.points, fleet: me.fleet, inventory: me.inventory, commander: me.commander, activeEffects: me.activeEffects },
                opponent: { name: 'Waiting', fleet: [], commander: 'UNKNOWN', activeEffects: {} },
                logs: this.logs
            };
        }

        // Lọc tàu địch theo luật Fog of War
        const opIsJammed = op.activeEffects.jammer > 0;
        // Kiểm tra Vision: Admiral Active HOẶC Spy Reveal HOẶC Commander Passive
        const myVisionIsActive = me.activeEffects.admiralVision > 0 || revealAll; 
        
        const opPublicFleet = op.fleet.map(u => {
            // 1. Luôn hiện tàu đã chìm
            if (u.isSunk) {
                // Vị trí, trạng thái chìm, loại tàu được lộ
                return { id: u.id, code: u.code, x: u.x, y: u.y, vertical: u.vertical, isSunk: true };
            } 
            
            // 2. Hiện tàu sống nếu có Vision (Active Skill)
            if (myVisionIsActive) {
                // Hiện đầy đủ vị trí, HP, trạng thái động cơ
                return { id: u.id, code: u.code, x: u.x, y: u.y, vertical: u.vertical, isSunk: false, hp: u.hp, maxHp: u.maxHp, isImmobilized: u.isImmobilized, type: u.type };
            }
            
            // 3. Nếu tàu là Structure và không bị Jammer (Structure luôn bị lộ trừ khi bị Jammed)
            if (u.type === 'STRUCTURE' && !opIsJammed) {
                 return { id: u.id, code: u.code, x: u.x, y: u.y, vertical: u.vertical, isSunk: false, hp: u.hp, maxHp: u.maxHp, type: u.type };
            }

            // Mặc định: Giấu hoàn toàn
            return null; 
        }).filter(x => x); // Lọc bỏ các tàu bị giấu

        return {
            status: this.status,
            turn: this.turnQueue[this.turnIndex],
            currentTurnPlayer: this.turnQueue[this.turnIndex],
            // Thông tin cá nhân (Gửi full)
            me: { 
                points: me.points, 
                fleet: me.fleet, 
                inventory: me.inventory,
                commander: me.commander,
                activeEffects: me.activeEffects,
                buildingDiscount: me.buildingDiscount, // Thêm discount cho Engineer
            },
            // Thông tin đối thủ (đã lọc FoW)
            opponent: { 
                name: op.name, 
                fleet: opPublicFleet,
                commander: op.commander, // Lộ commander
                activeEffects: op.activeEffects, // Lộ effect của địch (như Jammer)
            },
            logs: this.logs,
            config: this.config
        };
    }
}

module.exports = GameRoom;