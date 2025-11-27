const { CONSTANTS, ITEMS, UNITS } = require('../config/definitions');

class Player {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.ready = false;
    
    // Quản lý quân lực
    this.fleet = [];       // Array<Unit> - Chứa cả Tàu và Công trình đã đặt
    
    // NEW: Inventory dạng Object { itemId: quantity }
    // Mỗi loại item chỉ chiếm 1 slot dù có bao nhiêu
    this.inventory = {};   // { 'NUKE': 2, 'DRONE': 3, 'SILO': 1, ... }
    this.structures = [];  // Danh sách structure ID đã mua
    this.purchasePrices = {}; // Track purchase prices for refund: { itemId: { price: number, quantity: number } }
    
    // Kinh tế
    this.points = CONSTANTS.DEFAULT_POINTS || 3000;
    
    // Commander
    this.commander = null;
    this.commanderUsed = false;
    this.buildingDiscount = 0;

    // Active Effects
    this.activeEffects = {
        jammer: 0,
        admiralVision: 0,
        whiteHat: [], // Array of white hat deployments
    };
  }

  setCommander(cmdId) {
    this.commander = cmdId;
    const { COMMANDERS } = require('../config/definitions');
    const commander = COMMANDERS[cmdId];
    if (commander && commander.enabled !== false) {
        if (cmdId === 'ENGINEER' && commander.passiveDiscount) {
            this.buildingDiscount = commander.passiveDiscount;
        } else {
            this.buildingDiscount = 0;
        }
    } else {
        this.buildingDiscount = 0;
    }
  }

  // Đếm số slot đang dùng (mỗi loại item = 1 slot)
  getUsedSlots() {
    return Object.keys(this.inventory).length;
  }

  // Lấy tổng số item (cho hiển thị)
  getTotalItems() {
    return Object.values(this.inventory).reduce((sum, qty) => sum + qty, 0);
  }

  // Chuyển inventory object thành array (cho compatibility với code cũ)
  getInventoryArray() {
    const arr = [];
    for (const [itemId, qty] of Object.entries(this.inventory)) {
      for (let i = 0; i < qty; i++) {
        arr.push(itemId);
      }
    }
    return arr;
  }

  // Hàm mua đồ (Có trừ tiền)
  buyItem(itemId) {
    let itemDef = ITEMS[itemId];
    
    // Nếu không tìm thấy trong ITEMS, thử tìm trong UNITS (Structure)
    if (!itemDef && UNITS[itemId] && UNITS[itemId].type === 'STRUCTURE') {
        itemDef = UNITS[itemId];
    }

    if (itemId === 'NUKE') return false;
    if (!itemDef) return false;
    
    // Check if unit/item is enabled
    if (itemDef.enabled === false) return false;
    
    // Tính giá (Engineer giảm giá Structure)
    let finalCost = itemDef.cost;
    if (itemDef.type === 'STRUCTURE') {
        finalCost = Math.floor(finalCost * (1 - this.buildingDiscount));
    }

    // Check tiền
    if (this.points < finalCost) return false;

    // Check giới hạn slot (chỉ check nếu là item mới, không phải stack)
    const maxSlots = CONSTANTS.MAX_SLOTS || 10;
    const currentSlots = this.getUsedSlots();
    const isNewSlot = !this.inventory[itemId];
    
    if (isNewSlot && currentSlots >= maxSlots) {
      return false; // Slot đầy, không thể thêm loại item mới
    }

    // Mua thành công
    this.points -= finalCost;
    
    // Thêm vào inventory (stack nếu đã có)
    if (this.inventory[itemId]) {
      this.inventory[itemId]++;
    } else {
      this.inventory[itemId] = 1;
    }
    
    // Track purchase price for refund (weighted average if multiple purchases)
    if (this.purchasePrices[itemId]) {
      const existing = this.purchasePrices[itemId];
      const totalQuantity = existing.quantity + 1;
      const totalValue = (existing.price * existing.quantity) + finalCost;
      this.purchasePrices[itemId] = {
        price: Math.floor(totalValue / totalQuantity),
        quantity: totalQuantity
      };
    } else {
      this.purchasePrices[itemId] = {
        price: finalCost,
        quantity: 1
      };
    }
    
    // Track structure riêng
    if (itemDef.type === 'STRUCTURE') {
        this.structures.push(itemId);
    }

    return true;
  }

  // Hàm nhận đồ free (Nuclear Plant, Airfield spawn)
  addItem(itemId) {
    const itemDef = ITEMS[itemId];
    if (!itemDef) return false;

    const maxSlots = CONSTANTS.MAX_SLOTS || 10;
    const currentSlots = this.getUsedSlots();
    const isNewSlot = !this.inventory[itemId];
    
    if (isNewSlot && currentSlots >= maxSlots) {
        return false; 
    }

    if (this.inventory[itemId]) {
      this.inventory[itemId]++;
    } else {
      this.inventory[itemId] = 1;
    }
    
    return true;
  }
  
  // Check có item không
  hasItem(itemId) {
    return this.inventory[itemId] && this.inventory[itemId] > 0;
  }
  
  // Xóa 1 item (dùng khi sử dụng item)
  removeItem(itemId) {
    if (this.inventory[itemId] && this.inventory[itemId] > 0) {
      this.inventory[itemId]--;
      if (this.inventory[itemId] <= 0) {
        delete this.inventory[itemId]; // Xóa slot nếu hết
      }
      return true;
    }
    return false;
  }

  // Lấy số lượng của 1 loại item
  getItemCount(itemId) {
    return this.inventory[itemId] || 0;
  }

  // Bán/Hoàn trả item (refund 80% giá đã mua, tính cả discount nếu có)
  sellItem(itemId) {
    if (!this.inventory[itemId] || this.inventory[itemId] <= 0) {
      return { success: false, error: 'Item not found' };
    }

    let itemDef = ITEMS[itemId];
    if (!itemDef && UNITS[itemId] && UNITS[itemId].type === 'STRUCTURE') {
      itemDef = UNITS[itemId];
    }

    if (!itemDef) return { success: false, error: 'Invalid item' };

    // Hoàn trả 80% giá đã mua (có tính discount nếu đã mua với discount)
    let purchasePrice = itemDef.cost;
    if (this.purchasePrices[itemId] && this.purchasePrices[itemId].quantity > 0) {
      purchasePrice = this.purchasePrices[itemId].price;
      // Update purchase price tracking
      this.purchasePrices[itemId].quantity--;
      if (this.purchasePrices[itemId].quantity <= 0) {
        delete this.purchasePrices[itemId];
      }
    }
    const refundAmount = Math.floor(purchasePrice * 0.8);
    this.points += refundAmount;

    // Giảm số lượng
    this.inventory[itemId]--;
    if (this.inventory[itemId] <= 0) {
      delete this.inventory[itemId];
    }

    // Xóa khỏi structures nếu là structure
    if (itemDef.type === 'STRUCTURE') {
      const idx = this.structures.indexOf(itemId);
      if (idx > -1) this.structures.splice(idx, 1);
    }

    return { success: true, refund: refundAmount };
  }

  // Serialize player data cho client
  toPublicData() {
    return {
      id: this.id,
      name: this.name,
      ready: this.ready,
      commander: this.commander,
      points: this.points,
      inventory: this.inventory, // Object format
      inventoryArray: this.getInventoryArray(), // Array format for compatibility
      usedSlots: this.getUsedSlots(),
      maxSlots: CONSTANTS.MAX_SLOTS || 10,
      buildingDiscount: this.buildingDiscount,
    };
  }
}

module.exports = Player;
