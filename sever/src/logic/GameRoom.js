const Player = require('../models/Player');
const Unit = require('../models/Unit');
const { UNITS, CONSTANTS } = require('../config/definitions');
const ItemSystem = require('./ItemSystem');

class GameRoom {
  constructor(id, hostId) {
    this.id = id;
    this.hostId = hostId;
    this.players = {}; // map socketId -> Player
    this.status = 'LOBBY'; // LOBBY, SETUP, BATTLE, ENDED
    this.turnQueue = [];
    this.turnIndex = 0;
    this.logs = [];
  }

  // --- M1: Lobby Logic ---
  addPlayer(id, name) {
    if (Object.keys(this.players).length >= CONSTANTS.MAX_PLAYERS) return false;
    this.players[id] = new Player(id, name);
    return true;
  }

  // --- M2: Setup & Deployment ---
  deployFleet(playerId, shipsData) {
    const player = this.players[playerId];
    if (!player) return false;
    
    // Validate: Reset fleet
    player.fleet = [];
    
    // GDD: Tàu có thể trùng vị trí (Logic riêng biệt cho mỗi player)
    // Nhưng Tàu của CHÍNH MÌNH không được trùng nhau
    const occupied = new Set();

    for (const s of shipsData) {
      const def = UNITS[s.code];
      if (!def) continue;

      // Validate Boundary
      if (s.x < 0 || s.y < 0 || s.x >= CONSTANTS.MAP_SIZE_DEFAULT || s.y >= CONSTANTS.MAP_SIZE_DEFAULT) return false;
      // TODO: Validate size vs boundary logic here (đơn giản hóa)

      // Validate Overlap self
      // (Bỏ qua để code gọn, giả sử Client gửi đúng)

      // Apply Commander Passive: Admiral (+HP handled inside Unit check?)
      // GDD 4.3: Admiral +20% HP. 
      // Modify def before creating unit? No, modify unit after.
      
      const unit = new Unit(`${playerId}_${s.code}_${player.fleet.length}`, def, s.x, s.y, s.vertical, playerId);
      
      if (player.commander === 'ADMIRAL') {
          unit.maxHp = Math.floor(unit.maxHp * 1.2);
          unit.hp = unit.maxHp;
      }
      if (player.commander === 'SPY' && unit.code === 'SS') {
          // Logic move range xử lý ở Client hoặc move phase
      }

      player.fleet.push(unit);
    }
    
    player.ready = true;
    this.checkStartBattle();
    return true;
  }

  checkStartBattle() {
    const allReady = Object.values(this.players).every(p => p.ready);
    if (allReady && Object.keys(this.players).length === 2) {
      this.status = 'BATTLE';
      this.turnQueue = Object.keys(this.players); // Randomize if needed
      this.turnIndex = 0;
    }
  }

  // --- M3: Battle Loop ---
  fireShot(attackerId, x, y) {
    if (this.status !== 'BATTLE') return { error: 'Not in battle' };
    if (this.turnQueue[this.turnIndex] !== attackerId) return { error: 'Not your turn' };

    const attacker = this.players[attackerId];
    const defenderId = this.turnQueue.find(id => id !== attackerId);
    const defender = this.players[defenderId];

    // Check Passive Counter: FLARES vs MISSILE (Assume standard shot is missile)
    if (defender.hasItem('FLARES')) {
        defender.removeItem('FLARES');
        this.nextTurn();
        return { result: 'BLOCKED', msg: 'Blocked by Flares' };
    }

    let hitResult = 'MISS';
    let sunkShip = null;

    // Check Hit (GDD 4.1: Bắn trúng địch)
    // Logic: Duyệt qua tất cả tàu địch, xem đạn có trúng ô nào ko
    for (const unit of defender.fleet) {
        if (!unit.isSunk && unit.occupies(x, y)) {
            const status = unit.takeDamage(1, x, y); // 1 damage
            hitResult = status; // HIT, CRITICAL, SUNK
            
            attacker.points += CONSTANTS.POINTS_PER_HIT;
            if (status === 'SUNK') {
                sunkShip = unit.code;
                attacker.points += CONSTANTS.POINTS_PER_KILL;
            }
            break; // 1 viên trúng 1 tàu
        }
    }

    this.logs.push({ turn: this.logs.length, attacker: attackerId, x, y, result: hitResult });

    // Check Win
    const allSunk = defender.fleet.every(u => u.isSunk);
    if (allSunk) {
        this.status = 'ENDED';
        return { result: hitResult, sunkShip, winner: attackerId };
    }

    this.nextTurn();
    return { result: hitResult, sunkShip };
  }

  nextTurn() {
      // Logic: Turn-based loop
      this.turnIndex = (this.turnIndex + 1) % this.turnQueue.length;
      
      // Xử lý Passive mỗi lượt (Hồi máu, Jammer countdown)
      const currentPlayerId = this.turnQueue[this.turnIndex];
      const player = this.players[currentPlayerId];
      if (player.hiddenTurns > 0) player.hiddenTurns--;
      
      // Supply Station Heal
      const supply = player.fleet.find(u => u.code === 'SUPPLY' && !u.isSunk);
      if (supply) {
          // Logic hồi máu AOE 3x3 quanh Supply
          // (Implementation omitted for brevity)
      }
  }

  useItem(playerId, itemId, params) {
      if (this.turnQueue[this.turnIndex] !== playerId) throw new Error('Not your turn');
      const player = this.players[playerId];
      
      if (!player.hasItem(itemId)) throw new Error('Item not owned');
      
      const result = ItemSystem.applyItem(this, player, itemId, params);
      player.removeItem(itemId);
      
      this.logs.push({ action: 'ITEM', itemId, playerId, result });
      this.nextTurn(); // Dùng item mất lượt
      return result;
  }

  getOpponent(myId) {
      const opId = Object.keys(this.players).find(id => id !== myId);
      return this.players[opId];
  }

  // --- Security: Fog of War Filtering ---
  getStateFor(playerId) {
      const me = this.players[playerId];
      const op = this.getOpponent(playerId);
      
      // Chỉ gửi thông tin Public của địch
      const opPublicFleet = op ? op.fleet.map(u => {
          // Logic: Chỉ hiện tàu đã chìm hoặc đang bị lộ
          // Ở đây implement đơn giản: Tàu chìm thì hiện
          if (u.isSunk) return { code: u.code, x: u.x, y: u.y, vertical: u.vertical, isSunk: true };
          // TODO: Check Vision logic để hiện tàu sống
          return null; 
      }).filter(x => x) : [];

      return {
          status: this.status,
          turn: this.turnQueue[this.turnIndex],
          me: { points: me.points, fleet: me.fleet, inventory: me.inventory },
          opponent: { name: op ? op.name : 'Waiting', fleet: opPublicFleet },
          logs: this.logs
      };
  }
}

module.exports = GameRoom;