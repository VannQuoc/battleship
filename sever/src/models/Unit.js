const { CONSTANTS } = require('../config/definitions');

class Unit {
  constructor(id, definition, x, y, vertical, ownerId) {
    this.id = id;
    this.code = definition.code;
    this.type = definition.type; // SHIP or STRUCTURE
    this.maxHp = definition.hp;
    this.hp = definition.hp;
    this.vision = definition.vision;
    this.ownerId = ownerId;
    
    // Position
    this.x = x;
    this.y = y;
    this.vertical = vertical;
    this.cells = []; // Array {x, y, hit}
    
    // State
    this.isSunk = false;
    this.isImmobilized = false; // < 50% HP
    this.isStealth = definition.isStealth || false;
    
    // Init Cells
    for (let i = 0; i < definition.size; i++) {
      this.cells.push({
        x: vertical ? x : x + i,
        y: vertical ? y + i : y,
        hit: false
      });
    }
  }

  takeDamage(dmg = 1, atX = -1, atY = -1) {
    if (this.isSunk) return 'ALREADY_SUNK';

    this.hp -= dmg;
    
    // Mark cell as hit (visual purpose)
    if (atX !== -1) {
      const cell = this.cells.find(c => c.x === atX && c.y === atY);
      if (cell) cell.hit = true;
    }

    // Check trạng thái (GDD 4.1)
    if (this.hp <= 0) {
      this.hp = 0;
      this.isSunk = true;
      this.isImmobilized = true;
      return 'SUNK';
    }
    
    if (this.hp < this.maxHp * CONSTANTS.CRITICAL_THRESHOLD) {
      this.isImmobilized = true; // Hỏng động cơ
      return 'CRITICAL';
    }

    return 'HIT';
  }

  occupies(x, y) {
    return this.cells.some(c => c.x === x && c.y === y);
  }
}

module.exports = Unit;