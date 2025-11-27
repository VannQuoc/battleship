// server/src/logic/CommanderSystem.js
const { COMMANDERS } = require('../config/definitions');

module.exports = {
  activateSkill: (gameRoom, player) => {
    if (!player.commander) throw new Error('No Commander');
    if (player.commanderUsed) throw new Error('Skill already used');

    const commander = COMMANDERS[player.commander];
    if (!commander || commander.enabled === false) {
      throw new Error('Commander not available');
    }

    let result = {};
    const opponent = gameRoom.getOpponent(player.id);

    switch (player.commander) {
      case 'ADMIRAL': // Tăng tầm bắn (Logic game này bắn toàn map -> Tăng DMG hoặc Vision? GDD: "Tăng tầm bắn". Giả sử Vision)
        const visionBonus = commander.skillVisionBonus || 2;
        const visionDuration = commander.skillDuration || 2;
        player.activeEffects.admiralVision = visionDuration; // +Vision trong N lượt
        result = { type: 'SKILL_ADMIRAL', msg: 'Fleet Vision Increased' };
        break;

      case 'SPY': // Hack Map 2s (Gửi full map state 1 lần duy nhất)
        // Flag đặc biệt để hàm getStateFor gửi full data
        result = { type: 'SKILL_SPY', tempReveal: true, duration: commander.skillRevealDuration || 3 };
        break;

      case 'ENGINEER': // Hồi full máu 1 công trình/tàu
        // Logic: Tự động hồi con nào thấp máu nhất hoặc Unit đầu tiên
        const target = player.fleet.find(u => u.hp < u.maxHp && !u.isSunk);
        if (target) {
           target.hp = target.maxHp;
           target.isImmobilized = false;
           result = { type: 'SKILL_ENGINEER', unitId: target.id };
        } else {
           return { error: 'No damaged units' };
        }
        break;
    }

    player.commanderUsed = true;
    return result;
  }
};