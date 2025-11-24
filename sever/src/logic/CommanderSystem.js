// server/src/logic/CommanderSystem.js
module.exports = {
  activateSkill: (gameRoom, player) => {
    if (!player.commander) throw new Error('No Commander');
    if (player.commanderUsed) throw new Error('Skill already used');

    let result = {};
    const opponent = gameRoom.getOpponent(player.id);

    switch (player.commander) {
      case 'ADMIRAL': // Tăng tầm bắn (Logic game này bắn toàn map -> Tăng DMG hoặc Vision? GDD: "Tăng tầm bắn". Giả sử Vision)
        player.activeEffects.admiralVision = 2; // +Vision trong 2 lượt
        result = { type: 'SKILL_ADMIRAL', msg: 'Fleet Vision Increased' };
        break;

      case 'SPY': // Hack Map 2s (Gửi full map state 1 lần duy nhất)
        // Flag đặc biệt để hàm getStateFor gửi full data
        result = { type: 'SKILL_SPY', tempReveal: true };
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