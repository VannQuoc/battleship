// server/src/logic/GameRoom.js

// --- PHẦN IMPORT ---
const Player = require('../models/Player');
const Unit = require('../models/Unit');
// Giả định ItemSystem và CommanderSystem đã được định nghĩa và export đúng cách
const ItemSystem = require('./ItemSystem');
const CommanderSystem = require('./CommanderSystem');
const { CONSTANTS, UNITS, ITEMS } = require('../config/definitions');


/**
 * Lớp quản lý logic của một phòng game (trận đấu)
 * Bao gồm trạng thái game, lượt chơi, và tương tác giữa các players.
 */
class GameRoom {
    constructor(id, config = {}) {
        this.id = id;
        this.config = {
            // Sử dụng các hằng số mặc định
            mapSize: config.mapSize || CONSTANTS.DEFAULT_MAP_SIZE || 20,
            startingPoints: config.points || CONSTANTS.STARTING_POINTS || 1000,
            maxPlayers: config.maxPlayers || CONSTANTS.DEFAULT_PLAYERS || 2
        };
        this.players = {}; // map socketId -> Player
        this.turnQueue = []; // Thứ tự lượt chơi
        this.turnIndex = 0;
        this.status = 'LOBBY'; // LOBBY, SETUP, BATTLE, ENDED
        this.logs = [];

        // Quản lý sự kiện trễ (Mercenary, Spawning...)
        this.pendingEvents = [];
    }

    // --- M1: Lobby Logic ---
    addPlayer(id, name) {
        if (Object.keys(this.players).length >= this.config.maxPlayers) return false;

        const newPlayer = new Player(id, name);
        newPlayer.points = this.config.startingPoints; // Set point theo config

        // Đảm bảo Player model có activeEffects để đồng bộ với logic nextTurn/getStateFor
        newPlayer.activeEffects = {
            jammer: 0,
            admiralVision: 0,
        };
        
        // SỬA: Thêm buildingDiscount cho tương thích với getStateFor (Commander Engineer)
        newPlayer.buildingDiscount = 0; 
        
        this.players[id] = newPlayer;
        return true;
    }

    getOpponent(myId) {
        const opId = Object.keys(this.players).find(id => id !== myId);
        return this.players[opId];
    }

    // --- M2: Setup & Deployment (Transactional & Full Logic) ---
    deployFleet(playerId, shipsData) {
        // 1. Check trạng thái game (Quan trọng: Bản fix bị thiếu)
        if (this.status !== 'LOBBY' && this.status !== 'SETUP') {
            console.error(`[DEPLOY ERROR] Cannot deploy in status: ${this.status}`);
            return false; 
        }

        const player = this.players[playerId];
        if (!player) return false;

        // 2. Khởi tạo biến tạm (Transactional Pattern)
        // Mọi thay đổi sẽ thực hiện trên biến tạm, chỉ commit vào player khi mọi thứ hợp lệ.
        const tempFleet = []; 
        const occupiedMap = new Set(); 
        const tempInventory = [...player.inventory]; // Clone inventory để trừ dần

        // 3. Duyệt và Validate danh sách tàu gửi lên
        for (const s of shipsData) {
        const def = UNITS[s.code];
        if (!def) return false; // Unit không tồn tại

        // --- A. Validate Ownership (Chống Hack) ---
        if (def.type === 'STRUCTURE') {
            const index = tempInventory.indexOf(s.code);
            if (index === -1) {
                console.warn(`[CHEATING ATTEMPT] Player ${playerId} tried to deploy ${s.code} without owning it.`);
                return false; // Hủy toàn bộ, không lưu gì cả
            }
            // Xóa khỏi kho tạm
            tempInventory.splice(index, 1);
        }

        // --- B. Validate Vị trí & Va chạm ---
        const size = def.size;
        for(let i = 0; i < size; i++) {
            const cx = s.vertical ? s.x : s.x + i;
            const cy = s.vertical ? s.y + i : s.y;

            // Fix: Bản fix thiếu check < 0 (tàu có thể đặt ở tọa độ -1)
            if (cx < 0 || cy < 0 || cx >= this.config.mapSize || cy >= this.config.mapSize) {
                return false; // Out of bound
            }
            
            const key = `${cx},${cy}`;
            if (occupiedMap.has(key)) return false; // Overlap (trùng nhau)
            occupiedMap.add(key);
        }

        // --- C. Tạo Unit vào fleet tạm ---
        const unit = new Unit(
            `${playerId}_${s.code}_${Date.now()}_${tempFleet.length}`, // ID generation
            def, 
            s.x, 
            s.y, 
            s.vertical, 
            playerId
        );
        
        // --- D. Commander Passives (Đầy đủ) ---
        // ADMIRAL: +20% HP cho Ship
        if (player.commander === 'ADMIRAL' && unit.type === 'SHIP') {
            unit.maxHp = Math.floor(unit.maxHp * 1.2);
            unit.hp = unit.maxHp;
        }
        // SPY: +2 Movement cho SS
        if (player.commander === 'SPY' && unit.code === 'SS') {
            unit.moveRange += 2;
        }
        
        tempFleet.push(unit);
        }
        
        // --- E. Apply Player Passive (Missing in Fix) ---
        // Passive này tác động lên Player chứ không phải Unit, nên đặt ngoài vòng lặp
        if (player.commander === 'ENGINEER') {
            player.buildingDiscount = CONSTANTS.ENGINEER_DISCOUNT || 0.1;
        }

        // 4. COMMIT CHANGES (Chỉ chạy khi không có return false nào ở trên)
        player.inventory = tempInventory; // Cập nhật kho thật
        player.fleet = tempFleet;         // Cập nhật đội hình thật
        player.ready = true;              // Đánh dấu sẵn sàng
        
        this.checkStartBattle();
        return true;
    }

    checkStartBattle() {
        const allReady = Object.values(this.players).every(p => p.ready);
        const playerCount = Object.keys(this.players).length;

        if (this.config.maxPlayers === 2 && allReady && playerCount === 2) {
             this.status = 'BATTLE';
             // Khởi tạo thứ tự lượt chơi
             this.turnQueue = Object.keys(this.players);
             this.turnIndex = 0;
             this.logs.push({ type: 'GAME_START', msg: 'The battle begins!' });
        }
    }

    // [FIX 3B]: NÂNG CẤP HÀM isOccupied (Thêm excludeUnitId)
    isOccupied(x, y, excludeUnitId = null) {
        for(const pid in this.players) {
            for(const u of this.players[pid].fleet) {
                // Bỏ qua tàu đã chìm (nếu game cho phép đi qua xác tàu - GDD bảo xác tàu là chướng ngại vật -> OK giữ nguyên)
                // Bỏ qua chính tàu đang di chuyển (để tránh tự block mình khi overlap vị trí cũ)
                if (u.id === excludeUnitId) continue;
                    if (u.occupies(x, y)) return true;
            }
        }
        return false;
    }

    // [FIX 3A]: CẬP NHẬT HÀM moveUnit CHECK TOÀN BỘ THÂN TÀU
    moveUnit(playerId, unitId, newX, newY) {
    if (this.status !== 'BATTLE') throw new Error('Not in battle');
    if (this.turnQueue[this.turnIndex] !== playerId) throw new Error('Not your turn');

    const player = this.players[playerId];
    const unit = player.fleet.find(u => u.id === unitId);

    // Validate
    if (!unit || unit.isSunk) throw new Error('Invalid Unit');
    if (unit.isImmobilized) throw new Error('Unit engine broken');
    if (unit.type === 'STRUCTURE') throw new Error('Structures cannot move');

    // Check range (Manhattan distance)
    const dist = Math.abs(newX - unit.x) + Math.abs(newY - unit.y);
    if (dist > unit.moveRange) throw new Error('Out of range');

    // VALIDATE COLLISION (Check toàn bộ thân tàu tại vị trí mới)
        const size = unit.definition.size; // Lấy size từ config gốc hoặc unit.cells.length
            
        for(let i = 0; i < size; i++) {
            // Tính tọa độ từng ô dự kiến
            const cx = unit.vertical ? newX : newX + i;
            const cy = unit.vertical ? newY + i : newY;

            // 1. Check biên bản đồ (Boundary)
            if (cx >= this.config.mapSize || cy >= this.config.mapSize) throw new Error('Out of bounds');

            // 2. Check va chạm (QUAN TRỌNG: Loại trừ chính tàu này ra)
            if (this.isOccupied(cx, cy, unit.id)) {
                throw new Error(`Destination blocked at ${cx},${cy}`);
            }
        }
            
        // Nếu OK hết thì mới update
        unit.updateCells(newX, newY, unit.vertical);
            
        this.logs.push({ action: 'MOVE', playerId, unitId, from: {x:unit.x, y:unit.y}, to: {x:newX, y:newY} });
        this.nextTurn();
        return { success: true };
    }

    // [FIX 1]: CẬP NHẬT HÀM teleportUnit CHECK VA CHẠM TOÀN THÂN TÀU
    teleportUnit(playerId, unitId, x, y) {
        const player = this.players[playerId];
        if (!player) throw new Error('Player not found');
        
        const unit = player.fleet.find(u => u.id === unitId);
        if (!unit || unit.isSunk) throw new Error('Invalid Unit');

        // Validate Boundary & Collision cho TOÀN BỘ thân tàu
        const size = unit.definition.size;
        
        for(let i = 0; i < size; i++) {
            const cx = unit.vertical ? x : x + i;
            const cy = unit.vertical ? y + i : y;

            // 1. Check biên bản đồ
            if (cx >= this.config.mapSize || cy >= this.config.mapSize) throw new Error('Out of bounds');

            // 2. Check va chạm (Trừ chính nó ra)
            if (this.isOccupied(cx, cy, unit.id)) {
                throw new Error(`Teleport destination blocked at ${cx},${cy}`);
            }
        }
        
        // Update tọa độ và hitbox
        unit.updateCells(x, y, unit.vertical);
        
        // Log lại
        this.logs.push({ action: 'TELEPORT', playerId, unitId, to: {x, y} });
    }

    fireShot(attackerId, x, y) {
        if (this.status !== 'BATTLE') return { error: 'Not in battle' };
        if (this.turnQueue[this.turnIndex] !== attackerId) return { error: 'Not your turn' };

        const attacker = this.players[attackerId];
        
        // Biến lưu kết quả tổng hợp (vì có thể bắn trúng nhiều người cùng lúc)
        let totalHits = 0;
        let sunkShipsList = []; // Danh sách tàu chìm (có thể chìm nhiều tàu 1 lúc)
        let finalResult = 'MISS';

        // DUYỆT QUA TẤT CẢ NGƯỜI CHƠI TRONG PHÒNG
        for (const pid in this.players) {
            const player = this.players[pid];

            // 1. LOGIC FRIENDLY FIRE (BẮN TÀU MÌNH)
            // Yêu cầu: "Bắn ở vị trí tàu của mình... sẽ không làm tàu mình mất máu"
            if (pid === attackerId) {
                // Vẫn check xem có tàu mình ở đó không để (có thể) hiển thị hiệu ứng visual
                // Nhưng KHÔNG gọi takeDamage
                const myShip = player.fleet.find(u => !u.isSunk && u.occupies(x, y));
                if (myShip) {
                    // Có thể log hoặc return một trạng thái visual đặc biệt
                    // console.log("Player hit their own ship - No Damage");
                }
                continue; // Bỏ qua, không trừ máu chính mình
            }

            // 2. LOGIC BẮN ĐỊCH (BATTLE ROYALE)
            // Check tất cả tàu của người chơi này
            for (const unit of player.fleet) {
                if (!unit.isSunk && unit.occupies(x, y)) {
                    // Gọi hàm takeDamage bên Unit.js
                    // Hàm này đã xử lý việc: Nếu ô (x,y) đã vỡ trước đó -> Return ALREADY_HIT_PART
                    const status = unit.takeDamage(1, x, y);

                    if (status === 'HIT' || status === 'CRITICAL' || status === 'SUNK') {
                        totalHits++;
                        finalResult = 'HIT'; // Ít nhất trúng 1 người
                        
                        // Cộng điểm
                        attacker.points += 50;
                        
                        if (status === 'SUNK') {
                            sunkShipsList.push(unit.code);
                            attacker.points += 200;
                        }
                    } else if (status === 'ALREADY_HIT_PART') {
                        // Trúng vào phần xác tàu đã vỡ
                        // Không trừ máu, không cộng điểm, nhưng vẫn báo cho Client biết là bắn trúng sắt vụn
                        if (finalResult === 'MISS') finalResult = 'HIT_NO_DMG';
                    }
                }
            }
        }

        // Ghi log
        this.logs.push({ 
            turn: this.logs.length, 
            attacker: attackerId, 
            x, y, 
            result: finalResult, 
            sunk: sunkShipsList 
        });

        // Check Win Condition ngay lập tức
        if (this.checkWinCondition()) {
            return { result: finalResult, sunk: sunkShipsList, winner: this.winner, gameEnded: true };
        }

        this.nextTurn();
        return { result: finalResult, sunk: sunkShipsList };
    }
    // ---------------------------------------------------------
    // 1. HÀM KIỂM TRA ĐIỀU KIỆN THẮNG (HELPER)
    // ---------------------------------------------------------
    checkWinCondition() {
        // Duyệt qua tất cả người chơi
        for (const playerId in this.players) {
            const player = this.players[playerId];
            
            // Điều kiện bại trận: Hết sạch TÀU (Không tính Structure)
            const remainingShips = player.fleet.filter(u => u.type === 'SHIP' && !u.isSunk);
            
            if (remainingShips.length === 0) {
                this.status = 'ENDED';
                // Người thắng là đối thủ của người vừa thua
                this.winner = this.getOpponent(playerId).id; 
                return true; // Game đã kết thúc
            }
        }
        return false; // Game chưa kết thúc
    }

    // ---------------------------------------------------------
    // 2. HÀM USE ITEM (XỬ LÝ KỸ NĂNG & VẬT PHẨM)
    // ---------------------------------------------------------
    useItem(playerId, itemId, params) {
        // 1. Validate lượt
        if (this.status !== 'BATTLE') throw new Error('Game not in battle phase');
        if (this.turnQueue[this.turnIndex] !== playerId) throw new Error('Not your turn');
        
        const player = this.players[playerId];
        const itemDef = ITEMS[itemId]; // Đảm bảo đã import ITEMS từ definitions

        if (!itemDef) throw new Error('Item definition not found');

        // 2. Validate sở hữu (Trừ trường hợp là Skill Tướng/Unit)
        if (itemDef.type !== 'SKILL') {
            if (!player.inventory.includes(itemId)) throw new Error('Item not owned');
        }
        
        // 3. Thực thi Logic (Gọi sang ItemSystem)
        // Lưu ý: ItemSystem.applyItem sẽ gọi các hàm như teleportUnit, takeDamage...
        const result = ItemSystem.applyItem(this, player, itemId, params);
        
        // 4. Xóa item sau khi dùng (Nếu không phải Skill)
        if (itemDef.type !== 'SKILL') {
            const idx = player.inventory.indexOf(itemId);
            if (idx > -1) player.inventory.splice(idx, 1);
        }
        
        // 5. Ghi log
        this.logs.push({ action: 'ITEM', itemId, playerId, result });

        // 6. [QUAN TRỌNG] Kiểm tra thắng thua ngay lập tức
        // (Vì Nuke, Suicide Squad có thể đã diệt tàu cuối cùng)
        if (this.checkWinCondition()) {
            return { ...result, winner: this.winner, gameEnded: true };
        }

        // 7. Chuyển lượt (Dùng item tốn 1 lượt)
        this.nextTurn(); 
        return result;
    }

    // ---------------------------------------------------------
    // 3. HÀM NEXT TURN (VÒNG LẶP XỬ LÝ PASSIVE & EVENT)
    // ---------------------------------------------------------
    // [FIX 1]: LOGIC NEXT TURN (SẠC ĐẠN SILO)
    nextTurn() {
        this.turnIndex = (this.turnIndex + 1) % this.turnQueue.length;
        const currentPlayerId = this.turnQueue[this.turnIndex];
        const player = this.players[currentPlayerId];

        if (player.activeEffects.jammer > 0) player.activeEffects.jammer--;
        if (player.activeEffects.admiralVision > 0) player.activeEffects.admiralVision--;

        player.fleet.forEach(u => {
        if (u.revealedTurns > 0) u.revealedTurns--;
        if (u.isSunk) return; // Unit chết thì thôi

        // --- FIX 1: GIẢM COOLDOWN NẠP ĐẠN ---
        if (u.code === 'SILO' && u.chargingTurns > 0) {
            u.chargingTurns--;
        }
        // -------------------------------------

        if (u.type !== 'STRUCTURE') return;
        u.turnCounter++;

        // --- LOGIC SUPPLY STATION (TRẠM TIẾP TẾ) ---
        if (u.code === 'SUPPLY') {
            const range = 1; // 3x3
            player.fleet.forEach(friend => {
            // Check khoảng cách
            if (!friend.isSunk && Math.abs(friend.x - u.x) <= range && Math.abs(friend.y - u.y) <= range) {
                // Hồi 5 HP (Theo GDD)
                friend.hp = Math.min(friend.maxHp, friend.hp + 5);
                
                // Nếu máu > 50% -> Hết hỏng động cơ
                if (friend.hp > friend.maxHp * CONSTANTS.CRITICAL_THRESHOLD) {
                    friend.isImmobilized = false;
                }
            }
            });
        }

        // --- LOGIC NUCLEAR PLANT (NHÀ MÁY HẠT NHÂN) ---
        if (u.code === 'NUCLEAR_PLANT' && u.turnCounter >= 10) {
            // Dùng hàm addItem để check slot inventory an toàn
            const added = player.addItem('NUKE');
            if (added) {
                u.turnCounter = 0; // Reset chỉ khi nhận được đồ
                this.logs.push({ action: 'PASSIVE_GENERATE', playerId: player.id, item: 'NUKE' });
            }
        }
        
        // --- LOGIC AIRFIELD (SÂN BAY) ---
        if (u.code === 'AIRFIELD' && u.turnCounter >= 3) {
            const added = player.addItem('DRONE');
            if (added) {
                u.turnCounter = 0;
                this.logs.push({ action: 'PASSIVE_GENERATE', playerId: player.id, item: 'DRONE' });
            }
        }
        });

        // 4. Xử lý các sự kiện chờ (Mercenary/Assassin)
        // Filter trả về true để giữ lại, false để xóa đi
        this.pendingEvents = this.pendingEvents.filter(ev => {
        // Logic: Kiểm tra nếu sự kiện thuộc về người chơi hiện tại (hoặc logic đếm ngược chung)
        // Ở đây giả sử đếm ngược vào đầu lượt của người thuê
        if (ev.ownerId === currentPlayerId) {
            ev.turnsLeft--;
            
            // Khi đếm ngược về 0 -> Kích hoạt Ám sát
            if (ev.turnsLeft <= 0 && ev.type === 'ASSASSINATE') {
                const targetPlayer = this.getOpponent(ev.ownerId);
                const targetUnit = targetPlayer.fleet.find(t => t.id === ev.targetId);
                
                if (targetUnit && !targetUnit.isSunk) {
                    targetUnit.takeDamage(999); // Instakill
                    this.logs.push({ action: 'ASSASSINATION', targetId: ev.targetId });

                    // [QUAN TRỌNG] Check Win sau khi Ám sát
                    this.checkWinCondition(); 
                    // Lưu ý: Nếu game end, status sẽ đổi sang ENDED, loop game sẽ dừng ở các check sau
                }
                return false; // Xóa event khỏi danh sách vì đã thực thi
            }
        }
        return true; // Giữ lại event chưa đến hạn
        });
    }

    // [FIX 2 & 3]: CẬP NHẬT LOGIC TẦM NHÌN VÀ LỘ DIỆN
    getStateFor(playerId, revealAll = false) {
        const me = this.players[playerId];
        const op = this.getOpponent(playerId);
        
        // [FIX 2]: TÍNH BONUS VISION TỪ SKILL ADMIRAL
        const visionBonus = me.activeEffects.admiralVision > 0 ? 2 : 0; // Cộng thêm 2 ô tầm nhìn

        const myDestroyers = me.fleet.filter(u => u.code === 'DD' && !u.isSunk);

        const opPublicFleet = op ? op.fleet.map(u => {
            // 1. Các trường hợp LUÔN HIỆN:
            // - Spy Skill (revealAll)
            // - Tàu đã chìm
            // - Structure (alwaysVisible - VD: Nhà máy hạt nhân)
            // - [FIX 3]: Tàu bị lộ diện do Engine Boost/Jammer hết hạn (revealedTurns > 0)
            if (revealAll || u.isSunk || u.alwaysVisible || u.revealedTurns > 0) {
                return { code: u.code, x: u.x, y: u.y, vertical: u.vertical, isSunk: u.isSunk, hp: u.hp, isRevealed: u.revealedTurns > 0 };
            }
            
            // 2. Logic Vision & Sonar
            let isVisible = false;
            
            if (u.isStealth) { // Tàu ngầm (SS)
                // Chỉ bị lộ bởi DD (Sonar)
                for (const dd of myDestroyers) {
                    const dist = Math.max(Math.abs(dd.x - u.x), Math.abs(dd.y - u.y));
                    // Sonar cũng được hưởng buff Admiral (Logic game) hoặc không (Tùy GDD). 
                    // Ở đây giả sử Admiral buff toàn bộ cảm biến -> Buff cả Sonar.
                    if (dist <= dd.vision + visionBonus) {
                        isVisible = true;
                        break;
                    }
                }
            } else {
                // Tàu mặt nước: Check Vision thông thường
                for (const myShip of me.fleet) {
                    if (myShip.isSunk) continue;
                    const dist = Math.max(Math.abs(myShip.x - u.x), Math.abs(myShip.y - u.y));
                    
                    // [FIX 2]: ÁP DỤNG VISION BONUS
                    if (dist <= myShip.vision + visionBonus) {
                        isVisible = true;
                        break;
                    }
                }
            }

            if (isVisible) {
                return { code: u.code, x: u.x, y: u.y, vertical: u.vertical, isSunk: false };
            }
            
            return null; // Ẩn
        }).filter(x => x) : [];

        return {
            status: this.status,
            turn: this.turnQueue[this.turnIndex],
            me: { points: me.points, fleet: me.fleet, inventory: me.inventory, activeEffects: me.activeEffects }, // Gửi thêm activeEffects để Client biết đường vẽ UI buff
            opponent: { name: op ? op.name : 'Waiting', fleet: opPublicFleet },
            logs: this.logs
        };
    }
}

module.exports = GameRoom;