// server/src/models/Unit.js
const { CONSTANTS } = require('../config/definitions');

class Unit {
  constructor(id, definition, x, y, vertical, ownerId) {
    this.id = id;
    this.code = definition.code;
    this.type = definition.type; 
    // [FIX 2A]: KHỞI TẠO CHARGE CHO SILO
    // Nếu là Bệ phóng hạt nhân -> Cần 5 lượt nạp đạn
    if (this.code === 'SILO') {
        this.chargingTurns = 5; 
    } else {
        this.chargingTurns = 0;
    }
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
    for (let i = 0; i < definition.size; i++) {
      this.cells.push({
        x: vertical ? x : x + i,
        y: vertical ? y + i : y,
        hit: false
      });
    }
    this.isSunk = false;
    this.isImmobilized = false;
    this.isStealth = definition.isStealth || false;
    this.alwaysVisible = definition.alwaysVisible || false;

    // Passive Logic vars
    this.turnCounter = 0; 
    this.updateCells(x, y, vertical);
  }

  // Cập nhật lại tọa độ các đốt khi di chuyển
    updateCells(x, y, vertical) {
      this.x = x;
      this.y = y;
      this.vertical = vertical;
      // Lưu ý: Khi di chuyển, trạng thái 'hit' (hư hại) vẫn phải giữ nguyên theo index
      // Ví dụ: Đầu tàu bị vỡ, di chuyển đi đâu thì đầu tàu vẫn vỡ.
      for (let i = 0; i < this.cells.length; i++) {
          this.cells[i].x = vertical ? x : x + i;
          this.cells[i].y = vertical ? y + i : y;
      }
    }

    takeDamage(dmg = 1, atX = -1, atY = -1) {
      if (this.isSunk) return 'ALREADY_SUNK';

      if (atX !== -1 && atY !== -1) {
        // Tìm bộ phận tàu tại tọa độ bị bắn
        const cell = this.cells.find(c => c.x === atX && c.y === atY);
        
        if (cell) {
            if (cell.hit) {
                // YÊU CẦU: "Bắn đầu thuyền xong sẽ mất hp, phải bắn tiếp các vị trí khác"
                // -> Nếu bắn vào chỗ đã vỡ rồi, không trừ thêm HP.
                return 'ALREADY_HIT_PART'; 
            }
            // Đánh dấu bộ phận này đã hỏng
            cell.hit = true;
        }
      }

      // Trừ HP tổng
      this.hp -= dmg;

      if (this.hp <= 0) {
        this.hp = 0;
        this.isSunk = true;
        this.isImmobilized = true;
        return 'SUNK';
      }
      
      if (this.hp < this.maxHp * CONSTANTS.CRITICAL_THRESHOLD) {
        this.isImmobilized = true;
        return 'CRITICAL';
      }

      return 'HIT';
    }

    // Hồi máu (Dùng cho Repair Kit / Supply)
    heal(amount) {
        if (this.isSunk) return; // Tàu chìm không thể hồi (hoặc tùy luật)
        
        this.hp = Math.min(this.maxHp, this.hp + amount);
        
        // YÊU CẦU: "Nếu kẻ địch dùng hồi máu... tính damage lại cho chỗ đó"
        // -> Logic: Khi hồi máu, ta cần "sửa chữa" các bộ phận bị hỏng.
        // Cách đơn giản: Reset flag 'hit' của các cell dựa trên tỷ lệ máu hiện tại
        // Hoặc: Reset toàn bộ flag hit nếu hồi đầy.
        // Ở đây ta làm logic thông minh: Sửa chữa các cell bị hỏng từ đầu -> đuôi tương ứng số máu hồi
        if (this.hp > this.maxHp * CONSTANTS.CRITICAL_THRESHOLD) this.isImmobilized = false;
        
        // Reset trạng thái hỏng của các cell (Giả sử hồi máu là thợ sửa chữa đi hàn lại vỏ tàu)
        // Logic đơn giản: Reset hết để bắn lại được (như yêu cầu của bạn)
        // Nếu muốn chặt chẽ hơn: Chỉ reset số lượng cell tương ứng amount.
        this.cells.forEach(c => c.hit = false); 
    }
  }

module.exports = Unit;