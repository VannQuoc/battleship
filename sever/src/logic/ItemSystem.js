// server/src/logic/ItemSystem.js
const { ITEMS, CONSTANTS, UNITS } = require('../config/definitions');
const Unit = require('../models/Unit');

module.exports = {
  applyItem: (gameRoom, player, itemId, params) => {
    const opponent = gameRoom.getOpponent(player.id);
    let result = {};

    switch (itemId) {
      case 'REPAIR_KIT': // Hồi 20%
        {
          const unit = player.fleet.find(u => u.id === params.targetId);
          if (!unit || unit.isSunk) throw new Error('Invalid Target');
          const heal = Math.floor(unit.maxHp * 0.2) || 1;
          unit.hp = Math.min(unit.maxHp, unit.hp + heal);
          if (unit.hp > unit.maxHp * CONSTANTS.CRITICAL_THRESHOLD) unit.isImmobilized = false;
          result = { type: 'HEAL', unitId: unit.id, amount: heal };
        }
        break;

      case 'DRONE': // Quét hàng/cột
        {
          // Check Counter: ANTI_AIR
          if (opponent.hasItem('ANTI_AIR')) {
            opponent.removeItem('ANTI_AIR');
            return { type: 'BLOCKED', msg: 'Drone shot down by Anti-Air' };
          }
          const { axis, index } = params; // axis: 'row'|'col', index: number
          const found = [];
          opponent.fleet.forEach(u => {
            if (!u.isSunk && u.cells.some(c => (axis === 'row' ? c.y : c.x) === index)) {
              found.push({ type: u.code, x: u.x, y: u.y }); // Reveal approx location
            }
          });
          result = { type: 'SCAN', findings: found };
        }
        break;

      case 'ENGINE_BOOST': // Teleport 5 ô (Logic đơn giản hóa: Move unit)
        {
           // params: unitId, newX, newY. Logic check distance <= 5
           const unit = player.fleet.find(u => u.id === params.unitId);
           if (!unit || unit.isSunk) throw new Error('Invalid Unit');
           // Teleport bỏ qua check đường đi, chỉ check đích đến
           gameRoom.teleportUnit(player, unit, params.x, params.y);
           result = { type: 'TELEPORT', unitId: unit.id, x: params.x, y: params.y };
        }
        break;

      case 'DECOY': // Tạo thuyền giả
        {
           const decoy = new Unit(`DECOY_${Date.now()}`, UNITS.DECOY_UNIT, params.x, params.y, params.vertical, player.id);
           player.fleet.push(decoy);
           result = { type: 'SPAWN_DECOY', x: params.x, y: params.y };
        }
        break;

      case 'BLACK_HAT': // Hack công trình (Đổi chủ)
        {
           // Check Counter: WHITE_HAT
           if (opponent.hasItem('WHITE_HAT')) {
             opponent.removeItem('WHITE_HAT');
             return { type: 'BLOCKED_TRAP', msg: 'Hacker detected by White Hat!' }; // Lộ vị trí Hacker (Client tự handle effect)
           }
           const targetStruct = opponent.fleet.find(u => u.id === params.targetId && u.type === 'STRUCTURE');
           if (!targetStruct) throw new Error('Invalid Structure');
           
           // Logic đổi chủ: Xóa khỏi địch, thêm vào mình
           opponent.fleet = opponent.fleet.filter(u => u.id !== params.targetId);
           targetStruct.ownerId = player.id;
           player.fleet.push(targetStruct);
           
           result = { type: 'HACK_SUCCESS', structureId: targetStruct.id };
        }
        break;
        
      case 'MERCENARY': // Ám sát sau 3 turns
        {
           // Gắn trạng thái vào GameRoom để xử lý sau 3 turn
           gameRoom.pendingEvents.push({
             type: 'ASSASSINATE',
             turnsLeft: 3,
             targetId: params.targetId, // ID tàu địch
             ownerId: player.id
           });
           result = { type: 'MERCENARY_DEPLOYED' };
        }
        break;

      case 'NUKE': // Nổ 15x15
        {
           const hasSilo = player.fleet.some(u => u.code === 'SILO' && !u.isSunk);
           if (!hasSilo) throw new Error('Cần Bệ Phóng Hạt Nhân');
           
           const radius = Math.floor(CONSTANTS.NUKE_RADIUS / 2);
           const center = { x: params.x, y: params.y };
           const destroyed = [];

           [player, opponent].forEach(p => {
              p.fleet.forEach(u => {
                 if(u.isSunk) return;
                 // Check va chạm hình chữ nhật
                 // Đơn giản hóa: Check tâm
                 if (Math.abs(u.x - center.x) <= radius && Math.abs(u.y - center.y) <= radius) {
                    u.takeDamage(999);
                    destroyed.push(u.id);
                 }
              });
           });
           result = { type: 'NUKE_EXPLOSION', x: params.x, y: params.y, destroyed };
        }
        break;

       case 'JAMMER':
         player.activeEffects.jammer = 3; // 3 turns
         result = { type: 'JAMMER_ACTIVE' };
         break;
         
       case 'SELF_DESTRUCT': // Kỹ năng cảm tử (Không phải Item mua shop, nhưng handle chung luồng Active)
         {
           const unit = player.fleet.find(u => u.id === params.unitId);
           if (!unit || unit.hp > unit.maxHp * CONSTANTS.CRITICAL_THRESHOLD) throw new Error('Chưa đủ điều kiện cảm tử');
           
           unit.takeDamage(999); // Tự hủy
           // Gây dmg 3x3 xung quanh
           const radius = 1;
           const hits = [];
           opponent.fleet.forEach(u => {
              if (!u.isSunk && Math.abs(u.x - unit.x) <= radius && Math.abs(u.y - unit.y) <= radius) {
                 const status = u.takeDamage(CONSTANTS.SUICIDE_DAMAGE);
                 hits.push({ unitId: u.id, status });
              }
           });
           result = { type: 'SUICIDE_EXPLOSION', x: unit.x, y: unit.y, hits };
         }
         break;
    }

    return result;
  }
};