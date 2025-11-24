const { ITEMS } = require('../config/definitions');

module.exports = {
  applyItem: (gameRoom, player, itemId, params) => {
    const itemDef = ITEMS[itemId];
    if (!itemDef || itemDef.type !== 'ACTIVE') throw new Error('Invalid Item');

    let result = {};

    switch (itemId) {
      case 'REPAIR_KIT':
        // Hồi 20% HP
        const unit = player.fleet.find(u => u.id === params.targetId);
        if (unit && !unit.isSunk) {
          const heal = Math.floor(unit.maxHp * 0.2);
          unit.hp += heal;
          if (unit.hp > unit.maxHp) unit.hp = unit.maxHp;
          if (unit.hp > unit.maxHp * 0.5) unit.isImmobilized = false;
          result = { type: 'HEAL', unitId: unit.id, hp: unit.hp };
        }
        break;

      case 'DRONE':
        // Quét hàng/cột
        const isRow = params.axis === 'row'; // true/false
        const index = params.index; // số hàng/cột
        const opponent = gameRoom.getOpponent(player.id);
        
        // Check Counter: ANTI_AIR
        if (opponent.hasItem('ANTI_AIR')) {
          opponent.removeItem('ANTI_AIR');
          return { type: 'BLOCKED', msg: 'Drone shot down by Anti-Air' };
        }

        const found = [];
        opponent.fleet.forEach(u => {
          if (!u.isSunk && u.occupies(isRow ? -1 : index, isRow ? index : -1)) { // Logic check tọa độ
             // Fix logic check row/col chính xác
             const hit = u.cells.some(c => (isRow && c.y === index) || (!isRow && c.x === index));
             if(hit) found.push({x: u.x, y: u.y, type: u.code}); // Chỉ báo có tàu, ko báo chính xác ô
          }
        });
        result = { type: 'SCAN', findings: found };
        break;

      case 'NUKE':
        // Yêu cầu Silo
        const hasSilo = player.fleet.some(u => u.code === 'SILO' && !u.isSunk);
        if (!hasSilo) throw new Error('Requires Operational Silo');
        
        const { x, y } = params;
        // AOE 15x15 (Radius 7)
        const range = 7;
        const destroyed = [];
        
        // Damage cả 2 bên
        [player, gameRoom.getOpponent(player.id)].forEach(p => {
            p.fleet.forEach(u => {
                if(u.isSunk) return;
                // Check distance center-to-center roughly
                const dist = Math.sqrt(Math.pow(u.x - x, 2) + Math.pow(u.y - y, 2));
                if (dist <= range) {
                    u.takeDamage(999);
                    destroyed.push(u.id);
                }
            });
        });
        result = { type: 'NUKE_EXPLOSION', x, y, destroyed };
        break;

      case 'JAMMER':
        player.hiddenTurns = 3;
        result = { type: 'JAMMER_ACTIVE', duration: 3 };
        break;
    }

    return result;
  }
};