// client/src/screens/AdminScreen.tsx
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useConfig } from '../contexts/ConfigContext';
import toast from 'react-hot-toast';
import { Save, Lock, Unlock, RefreshCw, LogOut, Search } from 'lucide-react';

const API_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

// Mapping tên tiếng Việt cho constants
const CONSTANTS_NAMES: Record<string, string> = {
  DEFAULT_MAP_SIZE: 'Kích Thước Bản Đồ Mặc Định',
  DEFAULT_POINTS: 'Điểm Khởi Đầu',
  MAX_SLOTS: 'Số Slot Tối Đa',
  MAX_PLAYERS: 'Số Người Chơi Tối Đa',
  MIN_PLAYERS: 'Số Người Chơi Tối Thiểu',
  CRITICAL_THRESHOLD: 'Ngưỡng Nguy Hiểm (HP%)',
  SUICIDE_DAMAGE: 'Sát Thương Cảm Tử',
  NUKE_RADIUS: 'Bán Kính Nổ Hạt Nhân',
  ENGINEER_DISCOUNT: 'Giảm Giá Kỹ Sư',
  MAP_SIZE_BASE: 'Kích Thước Bản Đồ Cơ Bản',
  MAP_SIZE_PER_PLAYER: 'Kích Thước Mỗi Người Chơi',
  RADAR_RANGE: 'Tầm Radar',
  WHITE_HAT_RANGE: 'Tầm White Hat',
  WHITE_HAT_TURNS: 'Số Lượt White Hat',
  JAMMER_DISRUPT_RANGE: 'Tầm Phá Sóng',
  SILO_CHARGE_TURNS: 'Số Lượt Nạp Đạn Bệ Phóng',
  AIRFIELD_SPAWN_TURNS: 'Số Lượt Sinh Máy Bay',
  NUCLEAR_PLANT_SPAWN_TURNS: 'Số Lượt Sinh Đầu Đạn HN',
  SHOT_COOLDOWN_TURNS: 'Số Lượt Hồi Chiêu Bắn',
};

// Mapping tên tiếng Việt cho unit properties
const UNIT_PROPERTY_NAMES: Record<string, string> = {
  code: 'Mã',
  name: 'Tên',
  size: 'Kích Thước',
  hp: 'Máu (HP)',
  vision: 'Tầm Nhìn',
  move: 'Tốc Độ Di Chuyển',
  cost: 'Giá Tiền',
  type: 'Loại',
  range: 'Tầm Bắn',
  rangeFactor: 'Hệ Số Tầm Bắn',
  trajectory: 'Quỹ Đạo',
  isStealth: 'Tàng Hình',
  hasSonar: 'Có Sonar',
  alwaysVisible: 'Luôn Hiển Thị',
  canAttackSurface: 'Bắn Được Tàu',
  canAttackAir: 'Bắn Được Máy Bay',
  passive: 'Kỹ Năng Bị Động',
  isSilo: 'Là Bệ Phóng',
  damage: 'Sát Thương',
  canDetectSub: 'Phát Hiện Tàu Ngầm',
  desc: 'Mô Tả',
  enabled: 'Kích Hoạt',
};

// Mapping tên tiếng Việt cho item properties
const ITEM_PROPERTY_NAMES: Record<string, string> = {
  id: 'Mã',
  name: 'Tên',
  type: 'Loại',
  cost: 'Giá Tiền',
  counter: 'Chống Lại',
  turns: 'Số Lượt',
  reqSilo: 'Cần Bệ Phóng',
  desc: 'Mô Tả',
  enabled: 'Kích Hoạt',
};

// Mapping tên tiếng Việt cho commander properties
const COMMANDER_PROPERTY_NAMES: Record<string, string> = {
  id: 'Mã',
  name: 'Tên',
  desc: 'Mô Tả',
  skill: 'Kỹ Năng',
  passive: 'Bị Động',
  passiveHpBonus: 'Bonus HP Tàu (%)',
  skillVisionBonus: 'Bonus Tầm Nhìn',
  skillDuration: 'Thời Gian Kỹ Năng (Lượt)',
  passiveSubMoveBonus: 'Bonus Tốc Độ Tàu Ngầm',
  passiveDiscount: 'Giảm Giá Công Trình (%)',
  skillRevealDuration: 'Thời Gian Lộ Bản Đồ (Giây)',
  enabled: 'Kích Hoạt',
};

export function AdminScreen() {
  const { config, loading, error, reload } = useConfig();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [editedConfig, setEditedConfig] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Check if already authenticated
    const savedToken = localStorage.getItem('admin_token');
    if (savedToken) {
      setToken(savedToken);
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (config) {
      setEditedConfig(JSON.parse(JSON.stringify(config))); // Deep copy
    }
  }, [config]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (data.success && data.token) {
        setToken(data.token);
        setIsAuthenticated(true);
        localStorage.setItem('admin_token', data.token);
        toast.success('Đăng nhập thành công!');
        setUsername('');
        setPassword('');
      } else {
        toast.error(data.error || 'Đăng nhập thất bại');
      }
    } catch (error: any) {
      toast.error('Lỗi kết nối: ' + error.message);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setIsAuthenticated(false);
    localStorage.removeItem('admin_token');
    toast.success('Đã đăng xuất');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu mới không khớp!');
      return;
    }
    if (newPassword.length < 3) {
      toast.error('Mật khẩu phải có ít nhất 3 ký tự!');
      return;
    }
    try {
      const response = await fetch(`${API_URL}/api/admin/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Đổi mật khẩu thành công!');
        setShowChangePassword(false);
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error(data.error || 'Đổi mật khẩu thất bại');
      }
    } catch (error: any) {
      toast.error('Lỗi: ' + error.message);
    }
  };

  const handleSaveConfig = async () => {
    if (!editedConfig) return;
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(editedConfig),
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Đã lưu cấu hình!');
        await reload();
      } else {
        toast.error(data.error || 'Lưu thất bại');
      }
    } catch (error: any) {
      toast.error('Lỗi: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const updateConfigValue = useCallback((path: string[], value: any) => {
    if (!editedConfig) return;
    setEditedConfig((prev: any) => {
      const newConfig = JSON.parse(JSON.stringify(prev));
      let current: any = newConfig;
      for (let i = 0; i < path.length - 1; i++) {
        if (!current[path[i]]) current[path[i]] = {};
        current = current[path[i]];
      }
      current[path[path.length - 1]] = value;
      return newConfig;
    });
  }, [editedConfig]);

  // Filtered units and items based on search
  const filteredUnits = useMemo(() => {
    if (!editedConfig?.units || !searchTerm) return Object.entries(editedConfig?.units || {});
    const term = searchTerm.toLowerCase();
    return Object.entries(editedConfig.units).filter(([code, unit]: [string, any]) => 
      (unit.name || code).toLowerCase().includes(term) || code.toLowerCase().includes(term)
    );
  }, [editedConfig, searchTerm]);

  const filteredItems = useMemo(() => {
    if (!editedConfig?.items || !searchTerm) return Object.entries(editedConfig?.items || {});
    const term = searchTerm.toLowerCase();
    return Object.entries(editedConfig.items).filter(([id, item]: [string, any]) => 
      (item.name || id).toLowerCase().includes(term) || id.toLowerCase().includes(term)
    );
  }, [editedConfig, searchTerm]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-cyan-500/30 rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <h1 className="text-3xl font-bold text-cyan-400 mb-6 text-center">Admin Login</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-slate-300 mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 focus:border-cyan-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-slate-300 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 focus:border-cyan-500 outline-none"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-900 font-bold rounded-lg hover:from-cyan-400 hover:to-emerald-400 transition-all"
            >
              Đăng Nhập
            </button>
          </form>
          <p className="text-xs text-slate-500 mt-4 text-center">
            Mặc định: admin / admin
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-cyan-400 text-xl">Đang tải...</div>
      </div>
    );
  }

  if (error || !editedConfig) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-red-400 text-xl">Lỗi: {error || 'Không tải được config'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto h-screen flex flex-col">
        {/* Header - Fixed */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-cyan-500/30 rounded-2xl shadow-2xl p-4 md:p-6 mb-4 flex-shrink-0">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <h1 className="text-2xl md:text-3xl font-bold text-cyan-400">Admin Panel</h1>
            <div className="flex gap-3">
              <button
                onClick={() => setShowChangePassword(!showChangePassword)}
                className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:border-cyan-500 transition-all flex items-center gap-2 text-sm"
              >
                {showChangePassword ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                <span className="hidden sm:inline">Đổi Mật Khẩu</span>
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 rounded-lg text-white hover:bg-red-500 transition-all flex items-center gap-2 text-sm"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Đăng Xuất</span>
              </button>
            </div>
          </div>
        </div>

        {/* Change Password Form - Fixed */}
        {showChangePassword && (
          <div className="bg-slate-900/90 backdrop-blur-xl border border-cyan-500/30 rounded-2xl shadow-2xl p-4 md:p-6 mb-4 flex-shrink-0">
            <h2 className="text-xl font-bold text-cyan-400 mb-4">Đổi Mật Khẩu</h2>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-slate-300 mb-2">Mật khẩu cũ</label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 focus:border-cyan-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-2">Mật khẩu mới</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 focus:border-cyan-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-2">Xác nhận mật khẩu mới</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 focus:border-cyan-500 outline-none"
                  required
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="px-6 py-2 bg-cyan-500 text-slate-900 font-bold rounded-lg hover:bg-cyan-400 transition-all"
                >
                  Lưu
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowChangePassword(false);
                    setOldPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  className="px-6 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-all"
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Config Editor - Scrollable */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-cyan-500/30 rounded-2xl shadow-2xl p-4 md:p-6 flex-1 flex flex-col min-h-0">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 md:mb-6 gap-4 flex-shrink-0">
            <h2 className="text-xl md:text-2xl font-bold text-cyan-400">Cấu Hình Game</h2>
            <div className="flex gap-3">
              <button
                onClick={reload}
                className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:border-cyan-500 transition-all flex items-center gap-2 text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Tải Lại</span>
              </button>
              <button
                onClick={handleSaveConfig}
                disabled={saving}
                className="px-4 md:px-6 py-2 bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-900 font-bold rounded-lg hover:from-cyan-400 hover:to-emerald-400 transition-all flex items-center gap-2 disabled:opacity-50 text-sm"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mb-4 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Tìm kiếm đơn vị/vật phẩm..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-slate-100 focus:border-cyan-500 outline-none"
              />
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto pr-2 space-y-6">
            {/* Constants */}
            <div>
              <h3 className="text-lg md:text-xl font-bold text-slate-300 mb-4">Hằng Số Game</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                {Object.entries(editedConfig.constants || {}).map(([key, value]: [string, any]) => (
                  <div key={key}>
                    <label className="block text-slate-400 text-xs md:text-sm mb-1">
                      {CONSTANTS_NAMES[key] || key}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={value}
                      onChange={(e) => updateConfigValue(['constants', key], parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-cyan-500 outline-none text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Units */}
            <div>
              <h3 className="text-lg md:text-xl font-bold text-slate-300 mb-4">
                Đơn Vị ({filteredUnits.length})
              </h3>
              <div className="space-y-3 md:space-y-4">
                {filteredUnits.map(([code, unit]: [string, any]) => (
                  <div key={code} className="bg-slate-800/50 rounded-lg p-3 md:p-4 border border-slate-700">
                    <h4 className="text-base md:text-lg font-bold text-cyan-400 mb-3">
                      {unit.name || code}
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
                      {Object.entries(unit).map(([key, value]: [string, any]) => {
                        if (key === 'code' || key === 'name' || key === 'desc' || key === 'type') return null;
                        const displayName = UNIT_PROPERTY_NAMES[key] || key;
                        // Default enabled to true if not set
                        const actualValue = key === 'enabled' && value === undefined ? true : value;
                        return (
                          <div key={key}>
                            <label className="block text-slate-400 text-xs mb-1">{displayName}</label>
                            <input
                              type={typeof actualValue === 'number' ? 'number' : typeof actualValue === 'boolean' ? 'checkbox' : 'text'}
                              checked={typeof actualValue === 'boolean' ? actualValue : undefined}
                              value={typeof actualValue === 'boolean' ? undefined : actualValue}
                              onChange={(e) => {
                                let newValue: any;
                                if (typeof actualValue === 'boolean') {
                                  newValue = e.target.checked;
                                } else if (typeof actualValue === 'number') {
                                  newValue = parseFloat(e.target.value) || 0;
                                } else {
                                  newValue = e.target.value;
                                }
                                updateConfigValue(['units', code, key], newValue);
                              }}
                              className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs md:text-sm text-slate-100 focus:border-cyan-500 outline-none"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Items */}
            <div>
              <h3 className="text-lg md:text-xl font-bold text-slate-300 mb-4">
                Vật Phẩm ({filteredItems.length})
              </h3>
              <div className="space-y-3 md:space-y-4">
                {filteredItems.map(([id, item]: [string, any]) => (
                  <div key={id} className="bg-slate-800/50 rounded-lg p-3 md:p-4 border border-slate-700">
                    <h4 className="text-base md:text-lg font-bold text-cyan-400 mb-3">
                      {item.name || id}
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
                      {Object.entries(item).map(([key, value]: [string, any]) => {
                        if (key === 'id' || key === 'name' || key === 'desc') return null;
                        const displayName = ITEM_PROPERTY_NAMES[key] || key;
                        return (
                          <div key={key}>
                            <label className="block text-slate-400 text-xs mb-1">{displayName}</label>
                            <input
                              type={typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'checkbox' : 'text'}
                              checked={typeof value === 'boolean' ? value : undefined}
                              value={typeof value === 'boolean' ? undefined : value}
                              onChange={(e) => {
                                let newValue: any;
                                if (typeof value === 'boolean') {
                                  newValue = e.target.checked;
                                } else if (typeof value === 'number') {
                                  newValue = parseFloat(e.target.value) || 0;
                                } else {
                                  newValue = e.target.value;
                                }
                                updateConfigValue(['items', id, key], newValue);
                              }}
                              className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs md:text-sm text-slate-100 focus:border-cyan-500 outline-none"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Commanders */}
            {editedConfig.commanders && (
              <div>
                <h3 className="text-lg md:text-xl font-bold text-slate-300 mb-4">
                  Chỉ Huy ({Object.keys(editedConfig.commanders).length})
                </h3>
                <div className="space-y-3 md:space-y-4">
                  {Object.entries(editedConfig.commanders).map(([id, commander]: [string, any]) => (
                    <div key={id} className="bg-slate-800/50 rounded-lg p-3 md:p-4 border border-slate-700">
                      <h4 className="text-base md:text-lg font-bold text-cyan-400 mb-3">
                        {commander.name || id}
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
                        {Object.entries(commander).map(([key, value]: [string, any]) => {
                          if (key === 'id' || key === 'name' || key === 'desc' || key === 'skill' || key === 'passive') return null;
                          const displayName = COMMANDER_PROPERTY_NAMES[key] || key;
                          return (
                            <div key={key}>
                              <label className="block text-slate-400 text-xs mb-1">{displayName}</label>
                              <input
                                type={typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'checkbox' : 'text'}
                                checked={typeof value === 'boolean' ? value : undefined}
                                value={typeof value === 'boolean' ? undefined : value}
                                onChange={(e) => {
                                  let newValue: any;
                                  if (typeof value === 'boolean') {
                                    newValue = e.target.checked;
                                  } else if (typeof value === 'number') {
                                    newValue = parseFloat(e.target.value) || 0;
                                  } else {
                                    newValue = e.target.value;
                                  }
                                  updateConfigValue(['commanders', id, key], newValue);
                                }}
                                className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs md:text-sm text-slate-100 focus:border-cyan-500 outline-none"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
