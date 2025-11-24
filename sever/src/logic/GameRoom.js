const Player = require('../models/Player');
const Unit = require('../models/Unit');
const ItemSystem = require('./ItemSystem');
// Giả định các dependencies này tồn tại
const CommanderSystem = require('./CommanderSystem'); 
const { CONSTANTS, UNITS } = require('../config/definitions'); 

/**
 * Lớp quản lý logic của một phòng game (trận đấu)
 * Bao gồm trạng thái game, lượt chơi, và tương tác giữa các players.
 */
class GameRoom {
  constructor(id, config = {}) {
    this.id = id;
    this.config = {
      mapSize: config.mapSize || CONSTANTS.MAP_SIZE_DEFAULT,
      startingPoints: config.points || CONSTANTS.DEFAULT_POINTS,
      maxPlayers: config.maxPlayers || CONSTANTS.MAX_PLAYERS
    };
    this.players = {}; // map socketId -> Player
    this.turnQueue = [];
    this.turnIndex = 0;
    this.status = 'LOBBY'; // LOBBY, SETUP, BATTLE, ENDED
    this.logs = [];
    
    // Quản lý sự kiện trễ (Mercenary, Spawning...)
    this.pendingEvents = []; 
  }

  // --- M1: Lobby Logic ---
  addPlayer(id, name) {
    if (Object.keys(this.players).length >= this.config.maxPlayers) return false;
    this.players[id] = new Player(id, name);
    this.players[id].points = this.config.startingPoints; // Set point theo config
    return true;
  }

  // Helper: Tìm đối thủ
  getOpponent(myId) {
    const opId = Object.keys(this.players).find(id => id !== myId);
    return this.players[opId];
  }

  // --- M2: Setup & Deployment (Đã cải tiến từ v2) ---
  deployFleet(playerId, shipsData) {
    const player = this.players[playerId];
    if (!player) return false;
    
    const newFleet = [];
    // Mảng đánh dấu tọa độ đã chiếm của bản thân
    const occupiedMap = new Set(); 

    // Reset fleet trước khi triển khai
    player.fleet = [];

    for (const s of shipsData) {
      const def = UNITS[s.code];
      if (!def) continue;

      const size = def.size;
      const shipCells = [];

      for(let i = 0; i < size; i++) {
        const cx = s.vertical ? s.x : s.x + i;
        const cy = s.vertical ? s.y + i : s.y;
        
        // 1. Check Boundary
        if (cx < 0 || cy < 0 || cx >= this.config.mapSize || cy >= this.config.mapSize) return false;
        
        // 2. Check Collision Self
        const key = `${cx},${cy}`;
        if (occupiedMap.has(key)) return false; // Trùng tàu mình -> Error
        occupiedMap.add(key);
        shipCells.push({ x: cx, y: cy });
      }

      // Tạo Unit
      // Id cần unique, dùng Date.now() hoặc counter
      const unit = new Unit(`${playerId}_${s.code}_${player.fleet.length}`, def, s.x, s.y, s.vertical, playerId);
      
      // Commander Passive: Admiral (+20% HP)
      if (player.commander === 'ADMIRAL') {
          unit.maxHp = Math.floor(unit.maxHp * 1.2);
          unit.hp = unit.maxHp;
      }
      // GDD 4.3: Spy SS movement is handled in moveUnit/Client side, but unit is created here.

      newFleet.push(unit);
    }
    
    player.fleet = newFleet;
    player.ready = true;
    
    // Check start game
    this.checkStartBattle();
    return true;
  }

  checkStartBattle() {
    const allReady = Object.values(this.players).every(p => p.ready);
    if (allReady && Object.keys(this.players).length === this.config.maxPlayers) {
      this.status = 'BATTLE';
      // Khởi tạo thứ tự lượt chơi (có thể Randomize nếu cần)
      this.turnQueue = Object.keys(this.players); 
      this.turnIndex = 0;
      this.logs.push({ type: 'GAME_START', msg: 'The battle begins!' });
    }
  }

  // Helper: Kiểm tra một ô có bị chiếm bởi tàu sống nào không
  isOccupied(x, y) {
    for(const pid in this.players) {
      for(const u of this.players[pid].fleet) {
        // Chỉ tàu sống mới block đường đi
        if(!u.isSunk && u.occupies(x, y)) return true; 
      }
    }
    return false;
  }

  // --- M3: Battle Loop: Move Unit (Từ v2) ---
  moveUnit(playerId, unitId, newX, newY) {
    if (this.status !== 'BATTLE') throw new Error('Not in battle');
    if (this.turnQueue[this.turnIndex] !== playerId) throw new Error('Not your turn');

    const player = this.players[playerId];
    const unit = player.fleet.find(u => u.id === unitId);
    
    // Validate
    if (!unit || unit.isSunk) throw new Error('Invalid Unit');
    if (unit.isImmobilized) throw new Error('Unit engine broken'); // Kiểm tra hỏng động cơ
    if (unit.type === 'STRUCTURE') throw new Error('Structures cannot move');
    
    // Check range (Manhattan Distance)
    // GDD 4.3: SPY SS có moveRange = 3
    const moveRange = unit.code === 'SS' && player.commander === 'SPY' ? 3 : unit.moveRange;
    const dist = Math.abs(newX - unit.x) + Math.abs(newY - unit.y);
    if (dist > moveRange) throw new Error('Out of range');

    // Check Boundary & Collision
    // GDD: Không đi vào chướng ngại vật (Tàu mình, Tàu địch, Đảo, Xác tàu)
    if (this.isOccupied(newX, newY)) throw new Error('Destination blocked');
    
    // Execute Move
    // Tạm thời giả định tàu giữ nguyên hướng khi di chuyển
    const oldX = unit.x;
    const oldY = unit.y;
    unit.x = newX;
    unit.y = newY;
    
    this.logs.push({ action: 'MOVE', playerId, unitId, from: {x:oldX, y:oldY}, to: {x:newX, y:newY} });
    this.nextTurn();
    return { success: true };
  }

  // --- M4: Battle Loop: Fire Shot (Từ v1) ---
  fireShot(attackerId, x, y) {
    if (this.status !== 'BATTLE') return { error: 'Not in battle' };
    if (this.turnQueue[this.turnIndex] !== attackerId) return { error: 'Not your turn' };

    const attacker = this.players[attackerId];
    const defender = this.getOpponent(attackerId);

    // 1. Check Passive Counter: FLARES vs MISSILE
    if (defender.hasItem('FLARES')) {
        defender.removeItem('FLARES');
        this.logs.push({ action: 'ITEM_BLOCK', itemId: 'FLARES', defenderId: defender.id });
        this.nextTurn();
        return { result: 'BLOCKED', msg: 'Shot blocked by Flares' };
    }

    let hitResult = 'MISS';
    let sunkShip = null;

    // 2. Check Hit (GDD 4.1: Bắn trúng địch)
    for (const unit of defender.fleet) {
      if (!unit.isSunk && unit.occupies(x, y)) {
          // Commander Passive: ASSASSIN (+1 Critical Damage)
          const damage = attacker.commander === 'ASSASSIN' ? 2 : 1;
          
          const status = unit.takeDamage(damage, x, y); // damage (1 hoặc 2)
          hitResult = status; // HIT, CRITICAL, SUNK
          
          attacker.points += CONSTANTS.POINTS_PER_HIT;
          if (status === 'SUNK') {
              sunkShip = unit.code;
              attacker.points += CONSTANTS.POINTS_PER_KILL;
              this.logs.push({ action: 'SUNK', unitId: unit.id, unitCode: unit.code, targetId: defender.id });
          }
          break; // 1 viên trúng 1 tàu
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

  // --- M5: Item Usage (Từ v1) ---
  useItem(playerId, itemId, params) {
    if (this.status !== 'BATTLE') throw new Error('Not in battle');
    if (this.turnQueue[this.turnIndex] !== playerId) throw new Error('Not your turn');
    
    const player = this.players[playerId];
    
    if (!player.hasItem(itemId)) throw new Error('Item not owned');
    
    // ItemSystem.applyItem cần được implement đầy đủ để xử lý: 
    // - NUKE: Damage AOE.
    // - JAMMER: Set player.activeEffects.jammer.
    // - RADAR: Reveal 3x3.
    const result = ItemSystem.applyItem(this, player, itemId, params); 
    player.removeItem(itemId);
    
    this.logs.push({ action: 'ITEM_USE', itemId, playerId, result });
    this.nextTurn(); // Dùng item mất lượt
    return result;
  }

  // --- M6: Turn Cycle & Passive Effects (Cải tiến từ v2) ---
  nextTurn() {
    this.turnIndex = (this.turnIndex + 1) % this.turnQueue.length;
    const currentPlayerId = this.turnQueue[this.turnIndex];
    const player = this.players[currentPlayerId];

    this.logs.push({ type: 'NEW_TURN', playerId: currentPlayerId });

    // 1. Giảm hiệu ứng Active (Jammer, Admiral Vision)
    if (player.activeEffects.jammer > 0) player.activeEffects.jammer--;
    if (player.activeEffects.admiralVision > 0) player.activeEffects.admiralVision--;

    // 2. Xử lý Structures Passive
    player.fleet.forEach(u => {
      if (u.isSunk || u.type !== 'STRUCTURE') return;
      
      u.turnCounter++; // Tăng counter cho cấu trúc (Dùng cho Nuclear Plant, Airfield...)

      // SUPPLY: Hồi máu AOE (3x3 around)
      if (u.code === 'SUPPLY') {
        const range = 1; 
        player.fleet.forEach(friend => {
           if (!friend.isSunk && Math.abs(friend.x - u.x) <= range && Math.abs(friend.y - u.y) <= range) {
             const maxHeal = 1; 
             friend.hp = Math.min(friend.maxHp, friend.hp + maxHeal);
             if (friend.hp === friend.maxHp) friend.isImmobilized = false; // Hồi máu có thể sửa hỏng động cơ
           }
        });
      }

      // NUCLEAR PLANT: Gen Item NUKE sau 10 lượt
      if (u.code === 'NUCLEAR_PLANT' && u.turnCounter >= 10) {
          player.addItem('NUKE');
          u.turnCounter = 0; // Reset counter
          this.logs.push({ action: 'ITEM_GEN', itemId: 'NUKE', playerId: player.id });
      }
    });

    // 3. Xử lý Pending Events (Mercenary, Delayed attacks)
    this.pendingEvents = this.pendingEvents.filter(ev => {
        // Chỉ xử lý event của người chơi đang đến lượt
        if (ev.ownerId === currentPlayerId) {
            ev.turnsLeft--;
            if (ev.turnsLeft <= 0 && ev.type === 'ASSASSINATE') {
              const targetPlayer = this.getOpponent(ev.ownerId);
              const targetUnit = targetPlayer.fleet.find(t => t.id === ev.targetId);
              if (targetUnit && !targetUnit.isSunk) {
                 targetUnit.takeDamage(999); // One-shot kill
                 this.logs.push({ action: 'ASSASSINATION_COMPLETE', targetId: ev.targetId, targetPlayerId: targetPlayer.id });
                 // Check Win sau khi ám sát
                 const allSunk = targetPlayer.fleet.every(u => u.isSunk);
                 if (allSunk) this.status = 'ENDED';
              } else {
                 this.logs.push({ action: 'ASSASSINATION_FAIL', targetId: ev.targetId });
              }
              return false; // Remove event
            }
        }
        return true; // Keep event
    });
    
    // Kiểm tra kết thúc game sau các passive
    if (this.status === 'ENDED') return;
  }

  // --- M7: Security: Fog of War Filtering (Từ v1, cải tiến) ---
  getStateFor(playerId) {
    const me = this.players[playerId];
    const op = this.getOpponent(playerId);
    
    // Nếu chưa có đối thủ (LOBBY), trả về trạng thái đơn giản
    if (!op) {
       return {
          status: this.status,
          turn: this.turnQueue[this.turnIndex],
          me: { points: me.points, fleet: me.fleet, inventory: me.inventory, commander: me.commander, activeEffects: me.activeEffects },
          opponent: { name: 'Waiting', fleet: [], commander: 'UNKNOWN' },
          logs: this.logs
       };
    }

    // Lọc tàu địch theo luật Fog of War
    const opIsJammed = op.activeEffects.jammer > 0;
    const myVisionIsActive = me.activeEffects.admiralVision > 0; // Admiral Vision - GDD 4.3

    const opPublicFleet = op.fleet.map(u => {
        // 1. Luôn hiện tàu đã chìm
        if (u.isSunk) {
            // Tàu chìm hiện vị trí, hướng, loại (để đánh dấu trên map)
            return { id: u.id, code: u.code, x: u.x, y: u.y, vertical: u.vertical, isSunk: true };
        } 
        
        // 2. Hiện tàu sống nếu có Vision (Ví dụ: Admiral Active)
        if (myVisionIsActive) {
            // Hiện đầy đủ vị trí, HP của tàu
            return { id: u.id, code: u.code, x: u.x, y: u.y, vertical: u.vertical, isSunk: false, hp: u.hp, maxHp: u.maxHp };
        }
        
        // 3. Các vị trí đã bắn trúng (HIT/CRITICAL) vẫn được đánh dấu 
        // Logic này thường được lưu ở client hoặc trong log, không cần lộ vị trí tàu.
        
        // 4. Nếu tàu là Structure (thường không bị giấu) và không bị Jammer (Giả định Structures không được giấu)
        if (u.type === 'STRUCTURE' && !opIsJammed) {
             return { id: u.id, code: u.code, x: u.x, y: u.y, vertical: u.vertical, isSunk: false };
        }

        // Mặc định: Giấu
        return null; 
    }).filter(x => x);

    return {
        status: this.status,
        turn: this.turnQueue[this.turnIndex],
        // Thông tin cá nhân
        me: { 
            points: me.points, 
            fleet: me.fleet, // Gửi full fleet của mình
            inventory: me.inventory,
            commander: me.commander,
            activeEffects: me.activeEffects,
        },
        // Thông tin đối thủ (đã lọc FoW)
        opponent: { 
            name: op.name, 
            fleet: opPublicFleet,
            commander: op.commander, // Lộ commander
            activeEffects: op.activeEffects, // Lộ effect của địch (như Jammer)
        },
        logs: this.logs
    };
  }
}

module.exports = GameRoom;