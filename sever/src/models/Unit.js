// server/src/models/Unit.js
const { CONSTANTS } = require('../config/definitions');

class Unit {
  constructor(id, definition, x, y, vertical, ownerId) {
    this.id = id;
    this.code = definition.code;
    this.type = definition.type; 
    this.maxHp = definition.hp;
    this.hp = definition.hp;
    this.vision = definition.vision;
    this.moveRange = definition.move || 0; // Move stat
    this.ownerId = ownerId;
    this.definition = definition;

    this.x = x;
    this.y = y;
    this.vertical = vertical;
    this.cells = []; 
    
    this.isSunk = false;
    this.isImmobilized = false;
    this.isStealth = definition.isStealth || false;
    this.alwaysVisible = definition.alwaysVisible || false;

    // Passive Logic vars
    this.turnCounter = 0; 

    this.updateCells(x, y, vertical);
  }

  updateCells(x, y, vertical) {
    this.x = x;
    this.y = y;
    this.vertical = vertical;
    this.cells = [];
    const size = this.definition.size;
    for (let i = 0; i < size; i++) {
      this.cells.push({
        x: vertical ? x : x + i,
        y: vertical ? y + i : y,
        hit: false // Reset hit status on move? GDD: "bắn lại vị trí cũ". Cells should keep state? Usually NO in tactical games.
      });
    }
  }

    takeDamage(dmg = 1, atX = -1, atY = -1) {
        if (this.isSunk) return 'ALREADY_SUNK';

        // [FIX 1]: CHECK CELL HIT STATUS
        if (atX !== -1 && atY !== -1) {
        const cell = this.cells.find(c => c.x === atX && c.y === atY);
        // Nếu ô này đã bị bắn trước đó -> Không trừ HP nữa
        if (cell && cell.hit) {
            return 'ALREADY_HIT'; 
        }
        // Nếu chưa bắn -> Mark hit
        if (cell) cell.hit = true;
        }

        this.hp -= dmg;

        // ... (Logic check SUNK/CRITICAL giữ nguyên) ...
        if (this.hp <= 0) { /* ... */ return 'SUNK'; }
        if (this.hp < this.maxHp * 0.5) { /* ... */ return 'CRITICAL'; }

        return 'HIT';
    }

  // Helper check va chạm
  occupies(x, y) {
    return this.cells.some(c => c.x === x && c.y === y);
  }
}
module.exports = Unit;