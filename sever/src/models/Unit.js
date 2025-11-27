// server/src/models/Unit.js
const { CONSTANTS } = require('../config/definitions');

class Unit {
  constructor(id, definition, x, y, vertical, ownerId) {
    this.id = id;
    this.code = definition.code;
    this.type = definition.type; 
    
    // [FIX 2A]: KHỞI TẠO CHARGE CHO SILO
    if (this.code === 'SILO') {
        this.chargingTurns = CONSTANTS.SILO_CHARGE_TURNS || 5; 
    } else {
        this.chargingTurns = 0;
    }
    
    this.maxHp = definition.hp;
    this.hp = definition.hp;
    this.vision = definition.vision;
    this.moveRange = definition.move || 0;
    this.ownerId = ownerId;
    this.definition = definition;

    this.x = x;
    this.y = y;
    this.vertical = vertical;
    this.cells = []; 
    for (let i = 0; i < definition.size; i++) {
      this.cells.push({
        x: vertical ? x + i : x,
        y: vertical ? y : y + i,
        hit: false,
        hitTurn: -1, // Turn khi cell bị bắn trúng (dùng cho cooldown)
      });
    }
    this.isSunk = false;
    this.isImmobilized = false;
    
    // Read isStealth from definition (default: ships = true, structures = false)
    if (definition.isStealth !== undefined) {
        this.isStealth = definition.isStealth;
    } else {
        // Default: ships are stealth, structures are not
        this.isStealth = this.type === 'SHIP';
    }
    this.alwaysVisible = this.type === 'STRUCTURE' ? (definition.alwaysVisible || false) : false;

    this.hasRadar = false;
    this.radarRange = 0;
    this.jammerTurns = 0;

    // Passive Logic vars
    this.turnCounter = 0; 
    this.revealedTurns = 0;
    this.updateCells(x, y, vertical);
  }

  // Cập nhật lại tọa độ các đốt khi di chuyển
  updateCells(x, y, vertical) {
    this.x = x;
    this.y = y;
    this.vertical = vertical;
    
    for (let i = 0; i < this.cells.length; i++) {
        this.cells[i].x = vertical ? x + i : x;
        this.cells[i].y = vertical ? y : y + i;
        // Giữ nguyên hit state khi di chuyển
    }
  }

  /**
   * Gây damage cho unit
   * @param {number} dmg - Số damage
   * @param {number} atX - Tọa độ X bị bắn
   * @param {number} atY - Tọa độ Y bị bắn  
   * @param {number} currentTurn - Lượt hiện tại (để check cooldown)
   */
  takeDamage(dmg = 1, atX = -1, atY = -1, currentTurn = 0) {
    if (this.isSunk) return 'ALREADY_SUNK';

    // If specific coordinates provided, check cell cooldown
    if (atX !== -1 && atY !== -1) {
      const cell = this.cells.find(c => c.x === atX && c.y === atY);
      
      if (cell) {
        if (cell.hit && cell.hitTurn >= 0) {
          // Cell đã bị hit - check cooldown
          const cooldownTurns = CONSTANTS.SHOT_COOLDOWN_TURNS || 2;
          const turnsSinceHit = currentTurn - cell.hitTurn;
          if (turnsSinceHit < cooldownTurns) {
            // Chưa đủ cooldown - không gây damage
            return 'CELL_ON_COOLDOWN';
          }
          // Đã đủ cooldown - có thể bắn lại, reset hit state
          cell.hit = false;
          cell.hitTurn = -1;
        }
        // Đánh dấu bộ phận này đã hỏng
        cell.hit = true;
        cell.hitTurn = currentTurn;
      } else {
        // Cell not found - this shouldn't happen if coordinates are correct
        // But still apply damage (fallback)
        console.warn(`[Unit.takeDamage] Cell not found at (${atX}, ${atY}) for unit ${this.id}`);
      }
    }

    // Trừ HP tổng
    this.hp -= dmg;

    if (this.hp <= 0) {
      this.hp = 0;
      this.isSunk = true;
      this.isImmobilized = true;
      return 'SUNK';
    }
    
    if (this.hp < this.maxHp * CONSTANTS.CRITICAL_THRESHOLD) {
      this.isImmobilized = true;
      return 'CRITICAL';
    }

    return 'HIT';
  }

  // Hồi máu (Dùng cho Repair Kit / Supply)
  heal(amount) {
    if (this.isSunk) return;
    
    this.hp = Math.min(this.maxHp, this.hp + amount);
    
    // Reset immobilized nếu HP > critical threshold
    if (this.hp > this.maxHp * CONSTANTS.CRITICAL_THRESHOLD) {
      this.isImmobilized = false;
    }
    
    // Reset trạng thái hit của các cells - cho phép bắn lại
    this.cells.forEach(c => {
      c.hit = false;
      c.hitTurn = -1;
    });
  }

  // Kiểm tra xem tọa độ (x, y) có nằm trên unit này không
  occupies(x, y) {
    return this.cells.some(c => c.x === x && c.y === y);
  }
  
  // Kiểm tra có thể tự hủy không (HP < 50%)
  canSelfDestruct() {
    return this.type === 'SHIP' && !this.isSunk && this.hp < this.maxHp * CONSTANTS.CRITICAL_THRESHOLD;
  }
}

module.exports = Unit;
