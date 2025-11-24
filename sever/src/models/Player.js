const { CONSTANTS, ITEMS, COMMANDERS } = require('../config/definitions');
// Giả định Unit model được import và sử dụng (tuy nhiên không cần trong định nghĩa class này)
// const Unit = require('./Unit'); 

class Player {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        this.ready = false;
        this.fleet = []; // Array<Unit> - Hạm đội/Công trình của người chơi
        this.inventory = []; // Array<ItemId> - Kho vật phẩm
        this.points = CONSTANTS.STARTING_POINTS;
        this.commander = null;
        
        // Trạng thái/Hiệu ứng đang hoạt động
        this.hiddenTurns = 0; // Số lượt bị Jammer (tạm thời không thể bị phát hiện bởi FoW của địch)
        this.buildingDiscount = 0; // Chiết khấu xây dựng (Commander ENGINEER)
    }

    setCommander(cmdId) {
        this.commander = cmdId;
        // Áp dụng nội tại chỉ huy
        if (cmdId === 'ENGINEER') {
            this.buildingDiscount = CONSTANTS.ENGINEER_DISCOUNT || 0.2;
        } else {
            this.buildingDiscount = 0;
        }
    }

    /**
     * Mua vật phẩm từ shop (có trừ tiền và kiểm tra giới hạn).
     * @param {string} itemId - ID của vật phẩm.
     * @returns {boolean} True nếu mua thành công.
     */
    buyItem(itemId) {
        const item = ITEMS[itemId];
        if (!item) return false;
        
        // 1. Check points
        if (this.points < item.cost) return false;
        // 2. Check limit (Max 6)
        if (this.inventory.length >= CONSTANTS.MAX_INVENTORY_SLOTS || 6) return false;

        this.points -= item.cost;
        this.inventory.push(itemId);
        return true;
    }

    /**
     * Thêm vật phẩm vào kho mà KHÔNG cần trả tiền (Dùng cho phần thưởng/nội tại).
     * FIX 1: Thêm hàm addItem
     * @param {string} itemId - ID của vật phẩm.
     * @returns {boolean} True nếu thêm thành công.
     */
    addItem(itemId) {
        const itemDef = ITEMS[itemId];
        if (!itemDef) return false;

        // Check giới hạn Inventory (Max 6 items)
        if (this.inventory.length >= CONSTANTS.MAX_INVENTORY_SLOTS || 6) {
            return false; // Kho đầy, không nhận được đồ
        }

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
        // Nếu đang bị hiệu ứng ẩn/Jammer, không thể nhìn thấy gì
        if (this.hiddenTurns > 0) return new Set(); 

        const visibleSet = new Set();
        
        this.fleet.forEach(unit => {
            if (unit.isSunk) return;

            // Logic đơn giản hóa: Tính toán tầm nhìn hình vuông dựa trên unit.vision
            for (const cell of unit.cells) {
                for (let dx = -unit.vision; dx <= unit.vision; dx++) {
                    for (let dy = -unit.vision; dy <= unit.vision; dy++) {
                        const vx = cell.x + dx;
                        const vy = cell.y + dy;
                        
                        // Kiểm tra không vượt ra ngoài bản đồ
                        if (vx >= 0 && vx < mapSize && vy >= 0 && vy < mapSize) {
                            visibleSet.add(`${vx},${vy}`);
                        }
                    }
                }
            }
        });
        
        return visibleSet;
    }
}

module.exports = Player;