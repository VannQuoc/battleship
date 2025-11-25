// client/src/config/constants.ts

export const TERRAIN = {
  WATER: 0,
  ISLAND: 1, // Chặn di chuyển, chặn đạn bắn thẳng
  REEF: 2,   // Chặn tàu to (Size >= 4) và Submarine
  STORM: 3,
  FOG: 4
};

// Đã đổi tên từ UNIT_Qr thành UNIT_DEFINITIONS
export const UNIT_DEFINITIONS: Record<string, any> = {
  CV: { size: 5, name: 'Carrier', type: 'SHIP', vision: 4, range: -1 }, // Range -1 = Infinite
  BB: { size: 4, name: 'Battleship', type: 'SHIP', vision: 5, rangeFactor: 0.8 },
  CL: { size: 3, name: 'Cruiser', type: 'SHIP', vision: 6, range: 6, antiAir: true },
  DD: { size: 2, name: 'Destroyer', type: 'SHIP', vision: 7, range: 5, trajectory: 'DIRECT' },
  SS: { size: 3, name: 'Submarine', type: 'SHIP', vision: 3, range: 4, stealth: true },
  
  // Structures
  LIGHTHOUSE: { size: 2, type: 'STRUCTURE', vision: 8 },
  SUPPLY: { size: 3, type: 'STRUCTURE', vision: 2, passive: 'HEAL' },
  SILO: { size: 3, type: 'STRUCTURE', vision: 2, isSilo: true },
  AIRFIELD: { size: 4, type: 'STRUCTURE', vision: 4 },
  NUCLEAR_PLANT: { size: 4, type: 'STRUCTURE', vision: 2 }
};

export const COMMANDERS = [
  { id: 'ADMIRAL', name: 'Admiral', desc: 'Fleet Vision +2', skill: 'Buff Vision' },
  { id: 'SPY', name: 'The Spy', desc: 'Submarine Move +2', skill: 'Reveal Map (3s)' },
  { id: 'ENGINEER', name: 'Engineer', desc: 'Building Cost -20%', skill: 'Instant Repair' },
];