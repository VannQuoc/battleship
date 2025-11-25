export const TERRAIN = {
  WATER: 0,
  ISLAND: 1, // Chặn di chuyển, chặn đạn bắn thẳng
  REEF: 2,   // Chặn tàu to (Size >= 4) và Submarine
  STORM: 3,
  FOG: 4
};

export const UNIT_DEFINITIONS: Record<string, any> = {
  CV: { code: 'CV', name: 'Carrier', size: 5, type: 'SHIP', range: 999 },
  BB: { code: 'BB', name: 'Battleship', size: 4, type: 'SHIP', rangeFactor: 0.8 },
  CL: { code: 'CL', name: 'Cruiser', size: 3, type: 'SHIP', range: 6, antiAir: true },
  DD: { code: 'DD', name: 'Destroyer', size: 2, type: 'SHIP', range: 5, trajectory: 'DIRECT' },
  SS: { code: 'SS', name: 'Submarine', size: 3, type: 'SHIP', range: 4, stealth: true },
  
  // Structures
  LIGHTHOUSE: { code: 'LIGHTHOUSE', name: 'Hải Đăng', size: 2, type: 'STRUCTURE' },
  SUPPLY: { code: 'SUPPLY', name: 'Trạm Tiếp Tế', size: 3, type: 'STRUCTURE' },
  SILO: { code: 'SILO', name: 'Bệ Phóng HN', size: 3, type: 'STRUCTURE', isSilo: true },
  AIRFIELD: { code: 'AIRFIELD', name: 'Sân Bay', size: 4, type: 'STRUCTURE' },
  NUCLEAR_PLANT: { code: 'NUCLEAR_PLANT', name: 'Nhà Máy HN', size: 4, type: 'STRUCTURE' }
};

export const COMMANDERS = [
  { id: 'ADMIRAL', name: 'Admiral', desc: 'Fleet Vision +2', skill: 'Buff Vision' },
  { id: 'SPY', name: 'The Spy', desc: 'Submarine Move +2', skill: 'Reveal Map (3s)' },
  { id: 'ENGINEER', name: 'Engineer', desc: 'Building Cost -20%', skill: 'Instant Repair' },
];