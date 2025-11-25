import React, { useState, useEffect, useMemo } from 'react';
import { useGameStore } from '../store/useGameStore';
import { GameMap } from '../components/map/GameMap';
import { UNIT_DEFINITIONS, TERRAIN } from '../config/constants';
import toast from 'react-hot-toast';
import { UnitRenderer } from '../components/map/UnitRenderer'; // Cần thiết cho Preview

// Định nghĩa interface cho đơn vị được đặt
interface PlacedUnit {
    code: string;
    x: number;
    y: number;
    vertical: boolean;
}

export const SetupScreen = () => {
    const { deployFleet, mapData, me } = useGameStore();
    // selectedCode: Mã đơn vị (CV, BB, Structure...) đang được chọn để đặt
    const [selectedCode, setSelectedCode] = useState<string | null>(null); 
    const [vertical, setVertical] = useState(false);
    const [placedUnits, setPlacedUnits] = useState<PlacedUnit[]>([]);
    const [hoverPos, setHoverPos] = useState<{x: number, y: number} | null>(null);

    // --- Logic Inventory ---
    const availableInventory = useMemo<Record<string, number>>(() => {
        const counts: Record<string, number> = {};
        // Tổng inventory ban đầu (chỉ lấy Ship & Structure)
        me?.inventory.forEach(itemCode => {
            if (UNIT_DEFINITIONS[itemCode]?.type === 'SHIP' || UNIT_DEFINITIONS[itemCode]?.type === 'STRUCTURE') {
                counts[itemCode] = (counts[itemCode] || 0) + 1;
            }
        });
        
        // Trừ đi đã đặt
        placedUnits.forEach(u => {
            if (counts[u.code] > 0) counts[u.code]--;
        });
        
        return counts;
    }, [me?.inventory, placedUnits]);

    // --- Handle Keyboard (Rotate 'R') ---
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'r' || event.key === 'R') {
                setVertical(v => !v);
                event.preventDefault();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    // --- Handle Map Click ---
    const handleMapClick = (x: number, y: number) => {
        if (!selectedCode) return;
        const def = UNIT_DEFINITIONS[selectedCode];
        if (!def) return;

        // 1. Check Bounds, Terrain & Overlap
        const size = def.size;
        
        for (let i = 0; i < size; i++) {
            const cx = vertical ? x : x + i;
            const cy = vertical ? y + i : y;
            
            // Check Bounds
            if (cx >= mapData.length || cy >= mapData.length || cx < 0 || cy < 0) {
                toast.error("Vị trí ra ngoài bản đồ!"); return;
            }

            // Check Terrain: V2 chỉ cho đặt lên WATER
            const cellTerrain = mapData[cx][cy];
            if (cellTerrain !== TERRAIN.WATER) {
                toast.error(`Không thể đặt lên ${cellTerrain === TERRAIN.ISLAND ? 'Đảo' : 'Đá ngầm'}!`); 
                return;
            }

            // Check Overlap với unit đã đặt
            const isOverlap = placedUnits.some(u => {
                const uDef = UNIT_DEFINITIONS[u.code];
                for(let j=0; j<uDef.size; j++){
                    const ux = u.vertical ? u.x : u.x + j;
                    const uy = u.vertical ? u.y + j : u.y;
                    if (ux === cx && uy === cy) return true;
                }
                return false;
            });
            if(isOverlap) { toast.error("Bị trùng vị trí!"); return; }
        }

        // 2. Place
        setPlacedUnits([...placedUnits, { code: selectedCode, x, y, vertical }]);
        
        // Auto deselect nếu hết hàng
        if ((availableInventory[selectedCode] || 0) <= 1) {
            setSelectedCode(null);
        }
    };

    const handleConfirm = () => {
        // Check xem còn unit nào chưa đặt không?
        const remaining = Object.values(availableInventory).reduce((a, b) => a + b, 0);
        if (remaining > 0) {
            toast.error(`Vẫn còn ${remaining} đơn vị chưa triển khai!`);
            return;
        }
        
        // Sắp xếp lại format cho hàm deployFleet
        const finalFleet = placedUnits.map(u => ({
            code: u.code,
            x: u.x,
            y: u.y,
            vertical: u.vertical,
        }));

        deployFleet(finalFleet);
    };

    const handleReset = () => {
        setPlacedUnits([]);
        setSelectedCode(null);
        setHoverPos(null);
    };

    // --- Preview Logic ---
    const renderPreviewUnit = () => {
        if (!selectedCode || !hoverPos) return null;

        const def = UNIT_DEFINITIONS[selectedCode];
        if (!def) return null;

        // Tính toán kích thước cho UnitRenderer
        const size = def.size;
        const width = vertical ? '100%' : `${size * 100}%`;
        const height = vertical ? `${size * 100}%` : '100%';

        // Tính toán vị trí trên grid
        // CSS Grid index bắt đầu từ 1
        const gridColumn = hoverPos.y + 1; 
        const gridRow = hoverPos.x + 1;

        return (
            <div 
                className="absolute top-0 left-0 z-20 opacity-70 pointer-events-none transition-transform duration-100"
                style={{ 
                    gridColumn, 
                    gridRow, 
                    width, 
                    height, 
                    // Chỉnh position trong ô grid (Map cell là 32x32px)
                    transform: `translate(calc(var(--unit-size) * ${hoverPos.y}), calc(var(--unit-size) * ${hoverPos.x}))`, 
                    // Sử dụng biến CSS nếu cần thiết, hoặc tính toán lại trong Map
                    // Do Map cell có gap 1px, cần tính toán cẩn thận.
                    // Tạm thời dùng gridColumn/gridRow để đặt vị trí, UnitRenderer sẽ render kích thước tương đối.
                    // GameMap cần được sửa để có một lớp overlay cho preview
                }}
            >
                {/* Đây là cách đặt unit preview bằng Grid Layout, nhưng cần đảm bảo GameMap có lớp overlay 
                  với style display: grid, gap: 1px và kích thước 32px
                */}
                <div 
                    className="absolute z-10"
                    style={{ 
                        width, 
                        height, 
                    }}
                >
                    {/* UnitRenderer nhận dữ liệu giống như unit thực nhưng là trạng thái ảo */}
                    <UnitRenderer 
                        unit={{ 
                            id: 'preview', code: selectedCode, x: hoverPos.x, y: hoverPos.y, vertical, 
                            hp: def.hp, cells: Array(def.size).fill(0).map((_, i) => ({ hit: false, index: i })) 
                        } as any}
                        isEnemy={false}
                        isGhost={true} // Báo cho UnitRenderer biết đây là preview
                    />
                </div>
            </div>
        );
    };

    // --- Render Map with placed units ---
    
    // Gộp placedUnits vào me.fleet ảo để GameMap render
    const mockMe = me ? {
        ...me,
        fleet: placedUnits.map((u, index) => ({
            id: `temp-${index}`, // Cần ID duy nhất
            code: u.code,
            x: u.x,
            y: u.y,
            vertical: u.vertical,
            // Thêm các trường cần thiết cho UnitRenderer
            hp: UNIT_DEFINITIONS[u.code].hp,
            maxHp: UNIT_DEFINITIONS[u.code].hp,
            isSunk: false,
            cells: Array(UNIT_DEFINITIONS[u.code].size).fill(0).map((_, i) => ({ hit: false, index: i })),
            actionUsed: false,
        }))
    } : undefined;


    return (
        <div className="flex h-screen bg-sea-900 text-white overflow-hidden">
            {/* Sidebar */}
            <div className="w-80 bg-sea-800 border-r border-gray-700 flex flex-col p-4">
                <h2 className="text-xl font-mono text-hologram mb-6">TRIỂN KHAI HẠM ĐỘI</h2>
                
                <div className="flex-1 overflow-y-auto space-y-2">
                    {/* Danh sách các unit còn lại */}
                    {Object.entries(availableInventory).map(([code, count]) => {
                        if (count <= 0) return null;
                        const def = UNIT_DEFINITIONS[code];
                        return (
                            <button 
                                key={code}
                                onClick={() => setSelectedCode(code)}
                                className={`w-full p-3 border rounded text-left transition-all flex justify-between items-center ${
                                    selectedCode === code ? 'bg-radar text-black border-radar' : 'border-gray-600 hover:bg-sea-700'
                                }`}
                            >
                                <div>
                                    <div className="font-bold">{def.name} ({code})</div>
                                    <div className="text-[10px] opacity-70">{def.type} - Size: {def.size}</div>
                                </div>
                                <div className="text-xl font-mono font-bold">x{count}</div>
                            </button>
                        );
                    })}
                    {Object.values(availableInventory).every(c => c === 0) && (
                        <div className="text-radar text-center py-4 border border-dashed border-radar rounded bg-radar/10">
                            TẤT CẢ ĐƠN VỊ ĐÃ SẴN SÀNG
                        </div>
                    )}
                </div>

                <div className="mt-4 space-y-3">
                    <label className="flex items-center gap-3 p-3 bg-black/30 rounded cursor-pointer hover:border-hologram border border-transparent">
                        <input 
                            type="checkbox" 
                            className="w-5 h-5 accent-hologram" 
                            checked={vertical} 
                            onChange={e => setVertical(e.target.checked)} 
                        />
                        <span className="font-mono text-sm">XOAY DỌC (Phím R)</span>
                    </label>

                    <div className="flex gap-2">
                        <button onClick={handleReset} className="flex-1 py-2 border border-red-500 text-red-500 font-bold hover:bg-red-500/10 rounded transition-colors">THIẾT LẬP LẠI</button>
                        <button 
                            onClick={handleConfirm} 
                            className={`flex-1 py-2 font-bold rounded transition-opacity ${
                                Object.values(availableInventory).every(c => c === 0)
                                    ? 'bg-hologram text-black hover:bg-cyan-400'
                                    : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                            }`}
                            disabled={!Object.values(availableInventory).every(c => c === 0)}
                        >
                            BẮT ĐẦU TRẬN CHIẾN
                        </button>
                    </div>
                </div>
            </div>

            {/* Map Area */}
            <div className="flex-1 bg-sea-950 flex items-center justify-center relative">
                <div className="absolute top-4 left-4 text-gray-500 font-mono text-xs z-30">
                     UNIT TO PLACE: **{selectedCode || 'NONE'}** ({vertical ? 'VERTICAL' : 'HORIZONTAL'})
                </div>
                
                <div className="scale-90">
                    <GameMap 
                        interactive={true} 
                        // Truyền mockMe để GameMap hiển thị các unit đã đặt
                        me={mockMe as any} 
                        onCellClick={handleMapClick} 
                        hoverMode={selectedCode ? 'deploy' : null}
                        onCellHover={(x, y) => setHoverPos({x, y})}
                        // Cần GameMap có logic để render Preview/Ghost unit
                    />
                </div>
                {/* Để đơn giản, tôi giả định GameMap đã được sửa để nhận mockMe 
                    hoặc ta có thể render preview unit ở đây nếu GameMap không hỗ trợ preview
                */}
                
            </div>
        </div>
    );
};