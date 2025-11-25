const { CONSTANTS, ITEMS, UNITS } = require('../config/definitions');

class Player {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.ready = false;
    
    // Quản lý quân lực
    this.fleet = [];       // Array<Unit> - Chứa cả Tàu và Công trình đã đặt
    this.inventory = [];   // Array<ItemId> - Chứa Item mua trong shop và Công trình chưa đặt
    this.structures = [];  // [FIX CRITICAL]: Khởi tạo mảng rỗng để tránh crash khi mua Structure
    
    // Kinh tế
    this.points = CONSTANTS.STARTING_POINTS || 2000;
    
    // Commander
    this.commander = null;
    this.commanderUsed = false; // Đánh dấu đã dùng skill Active chưa
    this.buildingDiscount = 0;  // Passive giảm giá (Engineer)

    // [CẬP NHẬT MỚI]: Gom các hiệu ứng đếm ngược vào đây để dễ quản lý
    this.activeEffects = {
        jammer: 0,        // Thay thế cho this.hiddenTurns
        admiralVision: 0  // Skill tăng tầm nhìn của Đô đốc
    };
  }

  setCommander(cmdId) {
    this.commander = cmdId;
    if (cmdId === 'ENGINEER') {
        this.buildingDiscount = 0.2; // Giảm 20%
    }
  }

  // Hàm mua đồ (Có trừ tiền)
  buyItem(itemId) {
    // Check xem là Item hay Structure (vì definitions có thể tách riêng)
    let itemDef = ITEMS[itemId];
    
    // Nếu không tìm thấy trong ITEMS, thử tìm trong UNITS (cho trường hợp mua Structure)
    if (!itemDef && UNITS[itemId] && UNITS[itemId].type === 'STRUCTURE') {
        itemDef = UNITS[itemId];
    }

    if (!itemDef) return false;
    
    // Tính giá (Có áp dụng giảm giá Engineer nếu là Structure)
    let finalCost = itemDef.cost;
    if (itemDef.type === 'STRUCTURE') {
        finalCost = Math.floor(finalCost * (1 - this.buildingDiscount));
    }

    // Check tiền
    if (this.points < finalCost) return false;

    // Check giới hạn kho đồ
    // Logic: Structure tính vào slot structure (nếu tách riêng) hoặc inventory chung
    // Ở đây ta dùng logic Inventory chung max 6 món
    const limit = CONSTANTS.MAX_ITEMS || 6; 
    if (this.inventory.length >= limit) return false;

    // Mua thành công
    this.points -= finalCost;
    this.inventory.push(itemId);
    
    // Nếu game logic yêu cầu quản lý danh sách structure sở hữu riêng:
    if (itemDef.type === 'STRUCTURE') {
        this.structures.push(itemId);
    }

    return true;
  }

  // Hàm nhận đồ free (Dùng cho nội tại Nuclear Plant, Airfield)
  addItem(itemId) {
    const itemDef = ITEMS[itemId];
    if (!itemDef) return false;

    const limit = CONSTANTS.MAX_ITEMS || 6;
    if (this.inventory.length >= limit) {
        return false; 
    }

    this.inventory.push(itemId);
    return true;
  }
  
  // Các hàm hỗ trợ khác (nếu cần)
  hasItem(itemId) {
      return this.inventory.includes(itemId);
  }
  
  removeItem(itemId) {
      const idx = this.inventory.indexOf(itemId);
      if (idx > -1) this.inventory.splice(idx, 1);
  }
}

module.exports = Player;