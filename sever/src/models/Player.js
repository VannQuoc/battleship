const { CONSTANTS, ITEMS, COMMANDERS } = require('../config/definitions');
const Unit = require('./Unit');

class Player {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.ready = false;
    this.fleet = []; // Array<Unit>
    this.inventory = []; // Array<ItemId>
    this.points = CONSTANTS.STARTING_POINTS;
    this.commander = null;
    
    // Effects
    this.hiddenTurns = 0; // Jammer effect
    this.buildingDiscount = 0;
  }

  setCommander(cmdId) {
    this.commander = cmdId;
    if (cmdId === 'ENGINEER') this.buildingDiscount = 0.2;
  }

  // M2: Check tiền và thêm item
  buyItem(itemId) {
    const item = ITEMS[itemId];
    if (!item) return false;
    
    // Check points
    if (this.points < item.cost) return false;
    // Check limit (Max 6)
    if (this.inventory.length >= 6) return false;

    this.points -= item.cost;
    this.inventory.push(itemId);
    return true;
  }

  hasItem(itemId) {
    return this.inventory.includes(itemId);
  }

  removeItem(itemId) {
    const idx = this.inventory.indexOf(itemId);
    if (idx > -1) this.inventory.splice(idx, 1);
  }

  // Tính toán vùng nhìn thấy (Fog of War)
  getVisibleCells(mapSize) {
    if (this.hiddenTurns > 0) return []; // Nếu bị Jammer (logic đảo: mình bị mù hay địch mù? GDD: Mình ẩn)

    const visibleSet = new Set();
    this.fleet.forEach(unit => {
      if (unit.isSunk) return;
      // Vision hình vuông
      for (let dx = -unit.vision; dx <= unit.vision; dx++) {
        for (let dy = -unit.vision; dy <= unit.vision; dy++) {
          const vx = Math.floor(unit.x + (unit.vertical ? 0 : unit.cells.length/2) + dx); // Tạm tính tâm
          // Logic đơn giản: Loop qua từng cell của tàu rồi loang ra
          unit.cells.forEach(c => {
             // Vision check đơn giản hóa
             if (Math.abs(c.x - (c.x + dx)) <= unit.vision) 
                visibleSet.add(`${c.x+dx},${c.y+dy}`);
          });
        }
      }
    });
    return visibleSet;
  }
}

module.exports = Player;