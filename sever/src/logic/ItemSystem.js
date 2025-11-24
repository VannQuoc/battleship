const { ITEMS, CONSTANTS, UNITS } = require('../config/definitions');
const Unit = require('../models/Unit');

/**
 * Hệ thống xử lý kích hoạt Item và Skills.
 */
module.exports = {
    /**
     * Áp dụng hiệu ứng của một vật phẩm hoặc kỹ năng lên game room.
     * @param {GameRoom} gameRoom - Đối tượng GameRoom hiện tại.
     * @param {Player} player - Người chơi kích hoạt.
     * @param {string} itemId - ID của vật phẩm/kỹ năng.
     * @param {object} params - Tham số cần thiết cho việc kích hoạt (ví dụ: targetId, x, y).
     * @returns {object} Kết quả hành động để gửi về client.
     */
    applyItem: (gameRoom, player, itemId, params) => {
        const opponent = gameRoom.getOpponent(player.id);
        let result = {};

        switch (itemId) {
            case 'REPAIR_KIT': // Hồi 20% máu cho một Unit
                {
                    const unit = player.fleet.find(u => u.id === params.targetId);
                    if (!unit || unit.isSunk) throw new Error('Invalid Target');
                    
                    // Hồi 20% máu, tối thiểu là 1
                    const heal = Math.floor(unit.maxHp * 0.2) || 1; 
                    unit.hp = Math.min(unit.maxHp, unit.hp + heal);
                    
                    // Nếu HP vượt ngưỡng Critical, hủy bỏ trạng thái bị Cầm Chân
                    if (unit.hp > unit.maxHp * CONSTANTS.CRITICAL_THRESHOLD) unit.isImmobilized = false;
                    
                    result = { type: 'HEAL', unitId: unit.id, amount: heal };
                }
                break;

            case 'DRONE': // Quét 1 hàng hoặc 1 cột
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
                            // Chỉ tiết lộ loại tàu và tọa độ tâm (approx location)
                            found.push({ type: u.code, x: u.x, y: u.y }); 
                        }
                    });
                    result = { type: 'SCAN', findings: found };
                }
                break;

            case 'ENGINE_BOOST': // Teleport 5 ô (Logic cập nhật từ v3)
                {
                    const unit = player.fleet.find(u => u.id === params.unitId);
                    if (!unit || unit.isSunk) throw new Error('Invalid Unit');
                    
                    // Kiểm tra khoảng cách tối đa 5 ô (Manhattan distance)
                    const dist = Math.abs(params.x - unit.x) + Math.abs(params.y - unit.y);
                    if (dist > 5) throw new Error('Boost range exceeded');

                    // [FIXED]: TRUYỀN ID THAY VÌ OBJECT
                    gameRoom.teleportUnit(player.id, unit.id, params.x, params.y);
                   
                    result = { type: 'TELEPORT', unitId: unit.id, x: params.x, y: params.y };
                }
                break;

            case 'DECOY': // Tạo thuyền giả
                {
                    const decoy = new Unit(`DECOY_${Date.now()}`, UNITS.DECOY_UNIT, params.x, params.y, params.vertical, player.id);
                    // Decoy cần được thêm vào fleet của người chơi
                    player.fleet.push(decoy);
                    result = { type: 'SPAWN_DECOY', x: params.x, y: params.y };
                }
                break;

            case 'BLACK_HAT': // Hack công trình (Đổi chủ)
                {
                    // Check Counter: WHITE_HAT
                    if (opponent.hasItem('WHITE_HAT')) {
                        opponent.removeItem('WHITE_HAT');
                        // Trả về thông báo bị chặn và lộ vị trí
                        return { type: 'BLOCKED_TRAP', msg: 'Hacker detected by White Hat!' }; 
                    }
                    const targetStruct = opponent.fleet.find(u => u.id === params.targetId && u.type === 'STRUCTURE');
                    if (!targetStruct) throw new Error('Invalid Structure');
                    
                    // Logic đổi chủ: Xóa khỏi fleet địch, thêm vào fleet mình, đổi ownerId
                    opponent.fleet = opponent.fleet.filter(u => u.id !== params.targetId);
                    targetStruct.ownerId = player.id;
                    player.fleet.push(targetStruct);
                    
                    result = { type: 'HACK_SUCCESS', structureId: targetStruct.id };
                }
                break;

            case 'MERCENARY': // Ám sát sau 3 turns
                {
                    // Gắn trạng thái vào GameRoom để xử lý khi turn đếm ngược
                    gameRoom.pendingEvents.push({
                        type: 'ASSASSINATE',
                        turnsLeft: 3,
                        targetId: params.targetId, // ID tàu địch
                        ownerId: player.id
                    });
                    result = { type: 'MERCENARY_DEPLOYED' };
                }
                break;
            
            case 'SUICIDE_SQUAD': // NEW ITEM: Lính cảm tử ném vào địch, nổ 3x3 (Logic từ v3)
                {
                    // params: { x, y } - Tọa độ ném tâm nổ
                    const targetX = params.x;
                    const targetY = params.y;
                    const radius = 1; // 3x3 (tâm + 1 ô mỗi bên)
                    const hits = [];

                    opponent.fleet.forEach(u => {
                        if (!u.isSunk) {
                            // Sử dụng Chebyshev distance (max of |dx|, |dy|) để check va chạm hình vuông (3x3)
                            const dist = Math.max(Math.abs(u.x - targetX), Math.abs(u.y - targetY)); 
                            if (dist <= radius) {
                                // Gây dmg 3 (ví dụ)
                                const status = u.takeDamage(3);
                                hits.push({ unitId: u.id, status });
                            }
                        }
                    });
                    
                    result = { type: 'SUICIDE_SQUAD_BOOM', x: targetX, y: targetY, hits };
                }
                break;

            case 'NUKE': // Nổ Hạt Nhân (Khả năng 15x15, cần SILO)
                {
                    const hasSilo = player.fleet.some(u => u.code === 'SILO' && !u.isSunk);
                    if (!hasSilo) throw new Error('Cần Bệ Phóng Hạt Nhân');
                    
                    const radius = Math.floor(CONSTANTS.NUKE_RADIUS / 2); // Giả định CONSTANTS.NUKE_RADIUS = 15
                    const center = { x: params.x, y: params.y };
                    const destroyed = [];

                    // Nuke gây sát thương cho CẢ 2 bên (friendly fire)
                    [player, opponent].forEach(p => {
                        p.fleet.forEach(u => {
                            if(u.isSunk) return;
                            
                            // Kiểm tra va chạm hình vuông (Chebyshev distance)
                            if (Math.abs(u.x - center.x) <= radius && Math.abs(u.y - center.y) <= radius) {
                                u.takeDamage(999); // Sát thương chí mạng
                                destroyed.push(u.id);
                            }
                        });
                    });
                    result = { type: 'NUKE_EXPLOSION', x: params.x, y: params.y, destroyed };
                }
                break;

            case 'JAMMER': // Gây nhiễu sóng trong 3 turn
                // Hiệu ứng này thường được xử lý ở GameRoom trước khi gọi ItemSystem
                player.activeEffects.jammer = 3; 
                result = { type: 'JAMMER_ACTIVE' };
                break;
                
            case 'SELF_DESTRUCT': // Kỹ năng cảm tử của một Unit (KHÔNG phải Item shop)
                {
                    const unit = player.fleet.find(u => u.id === params.unitId);
                    // Điều kiện: Unit phải đang ở ngưỡng Critical (ví dụ: máu thấp hơn 30%)
                    if (!unit || unit.hp > unit.maxHp * CONSTANTS.CRITICAL_THRESHOLD) throw new Error('Condition not met');
                    
                    unit.takeDamage(999); // Tự hủy ngay lập tức
                    
                    // Gây dmg 3x3 xung quanh vị trí nổ
                    const radius = 1; 
                    const hits = [];
                    opponent.fleet.forEach(u => {
                        if (!u.isSunk && Math.abs(u.x - unit.x) <= radius && Math.abs(u.y - unit.y) <= radius) {
                            const status = u.takeDamage(CONSTANTS.SUICIDE_DAMAGE || 5); // Gây 5 dmg (mặc định nếu không có CONSTANT)
                            hits.push({ unitId: u.id, status });
                        }
                    });
                    result = { type: 'SUICIDE_EXPLOSION', x: unit.x, y: unit.y, hits };
                }
                break;

            default:
                throw new Error(`Unknown item ID: ${itemId}`);
        }

        return result;
    }
};
