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
                    if (!opponent) throw new Error('No opponent found');
                    
                    // Check Counter: ANTI_AIR
                    if (opponent.hasItem('ANTI_AIR')) {
                        opponent.removeItem('ANTI_AIR');
                        return { type: 'BLOCKED', msg: 'Drone bị bắn hạ bởi Anti-Air!' };
                    }
                    const { axis, index } = params; // axis: 'row'|'col', index: number
                    const found = [];
                    
                    // row = scan horizontal (same x value), col = scan vertical (same y value)
                    opponent.fleet.forEach(u => {
                        if (!u.isSunk && u.cells && u.cells.some(c => (axis === 'row' ? c.x : c.y) === index)) {
                            // Tiết lộ loại tàu và tọa độ
                            found.push({ type: u.code, x: u.x, y: u.y, name: u.definition?.name || u.code }); 
                        }
                    });
                    result = { type: 'SCAN', findings: found, axis, index };
                }
                break;

            case 'ENGINE_BOOST': // Teleport 5 ô + có thể xoay hướng
                {
                    const unit = player.fleet.find(u => u.id === params.unitId);
                    if (!unit || unit.isSunk) throw new Error('Invalid Unit');
                    if (unit.type === 'STRUCTURE') throw new Error('Cannot boost structures');
                    
                    // Kiểm tra khoảng cách tối đa 5 ô (Manhattan distance)
                    const dist = Math.abs(params.x - unit.x) + Math.abs(params.y - unit.y);
                    if (dist > 5) throw new Error('Boost range exceeded (max 5)');

                    // params.rotate: true để xoay hướng thuyền
                    const rotate = params.rotate || false;
                    
                    gameRoom.teleportUnit(player.id, unit.id, params.x, params.y, rotate);
           
                    // Tàu bị lộ 2 lượt khi dùng boost
                    unit.revealedTurns = 2; 

                    result = { 
                        type: 'TELEPORT', 
                        unitId: unit.id, 
                        x: params.x, 
                        y: params.y,
                        rotated: rotate,
                        newVertical: unit.vertical, 
                        isRevealed: true
                    };
                }
                break;

            case 'DECOY': // Tạo thuyền giả
                {
                    // Decoy definition inline (Size 2, HP 1, làm mồi nhử)
                    const decoyDef = { 
                        code: 'DECOY', 
                        name: 'Mồi nhử', 
                        size: 2, 
                        hp: 1, 
                        vision: 0, 
                        cost: 0, 
                        type: 'SHIP' 
                    };
                    const decoy = new Unit(
                        `DECOY_${Date.now()}`, 
                        decoyDef, 
                        params.x, 
                        params.y, 
                        params.vertical || false, 
                        player.id
                    );
                    player.fleet.push(decoy);
                    result = { type: 'SPAWN_DECOY', x: params.x, y: params.y };
                }
                break;

            case 'BLACK_HAT': // Hack công trình (Đổi chủ)
                {
                    if (!params.hackerId) throw new Error('Missing hacker platform');
                    const hackerUnit = player.fleet.find(u => u.id === params.hackerId && !u.isSunk && u.type === 'SHIP');
                    if (!hackerUnit) throw new Error('Invalid Hacker platform');

                    let targetStruct = null;
                    let targetOwner = null;
                    for (const pid in gameRoom.players) {
                        const candidateOwner = gameRoom.players[pid];
                        const candidate = candidateOwner.fleet.find(u => u.id === params.targetId);
                        if (candidate) {
                            targetStruct = candidate;
                            targetOwner = candidateOwner;
                            break;
                        }
                    }

                    if (!targetStruct || targetStruct.type !== 'STRUCTURE') throw new Error('Invalid Structure');
                    if (!targetOwner || targetOwner.id === player.id) throw new Error('Cannot hack own structure');

                    const whiteHat = targetOwner.activeEffects.whiteHat;
                    if (whiteHat && gameRoom.chebyshevDistance(targetStruct.x, targetStruct.y, whiteHat.x, whiteHat.y) <= whiteHat.range) {
                        return { type: 'BLOCKED_WHITE_HAT', msg: 'White Hat chặn Hacker!' };
                    }

                    targetOwner.fleet = targetOwner.fleet.filter(u => u.id !== targetStruct.id);
                    targetStruct.ownerId = player.id;
                    hackerUnit.revealedTurns = Math.max(hackerUnit.revealedTurns || 0, 2);
                    player.fleet.push(targetStruct);
                    
                    result = { type: 'HACK_SUCCESS', structureId: targetStruct.id };
                }
                break;

            case 'WHITE_HAT':
                {
                    const x = Number(params.x);
                    const y = Number(params.y);
                    if (Number.isNaN(x) || Number.isNaN(y)) throw new Error('Invalid coordinates');
                    player.activeEffects.whiteHat = {
                        x,
                        y,
                        range: CONSTANTS.WHITE_HAT_RANGE,
                        turnsLeft: CONSTANTS.WHITE_HAT_TURNS,
                    };
                    result = { type: 'WHITE_HAT_DEPLOYED', x, y, duration: CONSTANTS.WHITE_HAT_TURNS };
                }
                break;

            case 'RADAR':
                {
                    const unit = player.fleet.find(u => u.id === params.unitId);
                    if (!unit || unit.isSunk) throw new Error('Invalid Unit');
                    unit.hasRadar = true;
                    unit.radarRange = CONSTANTS.RADAR_RANGE;
                    gameRoom.revealSubmarinesAround(unit.x, unit.y, unit.radarRange, player.id);
                    result = { type: 'RADAR_DEPLOYED', unitId: unit.id, range: unit.radarRange };
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
                    if (!opponent) throw new Error('No opponent found');
                    
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
                    const activeSilo = player.fleet.find(u => u.code === 'SILO' && !u.isSunk && u.chargingTurns <= 0);
           
                    if (!activeSilo) throw new Error('Cần Bệ Phóng Hạt Nhân đã nạp đạn (5 lượt)');
                    
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
                    activeSilo.chargingTurns = 5;
                }
                break;

            case 'JAMMER':
                {
                    if (!params.unitId) throw new Error('Jammer must be installed on a unit');
                    const unit = player.fleet.find(u => u.id === params.unitId);
                    if (!unit || unit.isSunk) throw new Error('Invalid Unit');
                    unit.jammerTurns = 3;
                    player.activeEffects.jammer = 3;
                    const disrupted = gameRoom.disruptRadarsAround(unit.x, unit.y, CONSTANTS.JAMMER_DISRUPT_RANGE);
                    result = { type: 'JAMMER_ACTIVE', disrupted };
                }
                break;
                
            case 'SELF_DESTRUCT': // Kỹ năng cảm tử của một Unit (KHÔNG phải Item shop)
                {
                    const unit = player.fleet.find(u => u.id === params.unitId);
                    // Điều kiện: Unit phải đang ở ngưỡng Critical (ví dụ: máu thấp hơn 50%)
                    if (!unit || unit.hp > unit.maxHp * CONSTANTS.CRITICAL_THRESHOLD) throw new Error('Condition not met');
                    
                    const unitX = unit.x;
                    const unitY = unit.y;
                    
                    unit.takeDamage(999); // Tự hủy ngay lập tức
                    
                    // Gây dmg 3x3 xung quanh vị trí nổ
                    const radius = 1; 
                    const hits = [];
                    
                    if (opponent && opponent.fleet) {
                        opponent.fleet.forEach(u => {
                            if (!u.isSunk && Math.abs(u.x - unitX) <= radius && Math.abs(u.y - unitY) <= radius) {
                                const status = u.takeDamage(CONSTANTS.SUICIDE_DAMAGE || 5);
                                hits.push({ unitId: u.id, status });
                            }
                        });
                    }
                    result = { type: 'SUICIDE_EXPLOSION', x: unitX, y: unitY, hits };
                }
                break;

            default:
                throw new Error(`Unknown item ID: ${itemId}`);
        }

        return result;
    }
};
