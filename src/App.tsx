import { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Beaker, 
  Menu, 
  X, 
  Eraser,
  Moon,
  Sun,
  Settings,
  AlertTriangle
} from 'lucide-react';

// --- Types ---
interface Reagent {
  id: string;
  name: string;
  color: string;
}

interface WellData {
  reagentId: string;
  value: string | null;
  unit: string | null;
}

interface Plate {
  id: string;
  name: string;
  size: number;
  wells: Record<string, WellData>;
}

interface PlateConfig {
  rows: number;
  cols: number;
  label: string;
}

// --- Constants & Helpers ---

const PLATE_SIZES: Record<number, PlateConfig> = {
  6: { rows: 2, cols: 3, label: '6-Well' },
  12: { rows: 3, cols: 4, label: '12-Well' },
  24: { rows: 4, cols: 6, label: '24-Well' },
  48: { rows: 6, cols: 8, label: '48-Well' },
  96: { rows: 8, cols: 12, label: '96-Well' },
  384: { rows: 16, cols: 24, label: '384-Well' },
};

const UNITS = ['µL', 'mL', 'nM', 'µM', 'mM', 'M', '%', 'ng/mL', 'µg/mL'];

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', 
  '#3b82f6', '#6366f1', '#d946ef', '#f43f5e', '#64748b', '#000000'
];

const generateId = () => Math.random().toString(36).substr(2, 9);

const getRowLabel = (index: number) => String.fromCharCode(65 + index); 

// --- Main Component ---

export default function LabPlanner() {
  
  const loadState = <T,>(key: string, defaultVal: T): T => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : defaultVal;
    } catch (e) {
      return defaultVal;
    }
  };

  const [darkMode, setDarkMode] = useState<boolean>(() => loadState('lp_dark', false));

  const [reagents, setReagents] = useState<Reagent[]>(() => loadState('lp_reagents', [
    { id: 'r1', name: 'Control (PBS)', color: '#94a3b8' },
    { id: 'r2', name: 'Compound A', color: '#3b82f6' },
  ]));

  const [plates, setPlates] = useState<Plate[]>(() => loadState('lp_plates', [
    { id: 'p1', name: 'Plate 1', size: 96, wells: {} }
  ]));

  const [activePlateId, setActivePlateId] = useState<string>(() => {
    const savedId = localStorage.getItem('lp_activePlateId');
    return savedId || 'p1';
  });

  const [activeReagentId, setActiveReagentId] = useState<string>('r1');
  const [fillValue, setFillValue] = useState('100');
  const [fillUnit, setFillUnit] = useState('µL');
  const [useConcentration, setUseConcentration] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create'); 
  const [modalData, setModalData] = useState<{ name: string; size: number | string }>({ name: '', size: 96 });

  const [confirmConfig, setConfirmConfig] = useState<{ isOpen: boolean; title: string; message: string; action: (() => void) | null }>({ 
    isOpen: false, 
    title: '', 
    message: '', 
    action: null 
  });

  useEffect(() => {
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  }, []);

  useEffect(() => { localStorage.setItem('lp_reagents', JSON.stringify(reagents)); }, [reagents]);
  useEffect(() => { localStorage.setItem('lp_plates', JSON.stringify(plates)); }, [plates]);
  useEffect(() => { localStorage.setItem('lp_dark', JSON.stringify(darkMode)); }, [darkMode]);
  useEffect(() => { 
    if (activePlateId) localStorage.setItem('lp_activePlateId', activePlateId); 
  }, [activePlateId]);

  const activePlate = plates.find(p => p.id === activePlateId) || plates[0];
  
  const triggerConfirm = (title: string, message: string, action: () => void) => {
    setConfirmConfig({
      isOpen: true,
      title,
      message,
      action: () => {
        action();
        setConfirmConfig({ isOpen: false, title: '', message: '', action: null });
      }
    });
  };

  const initiateAddPlate = () => {
    setModalMode('create');
    setModalData({ name: `Plate ${plates.length + 1}`, size: 96 });
    setModalOpen(true);
  };

  const initiateEditPlate = () => {
    setModalMode('edit');
    setModalData({ name: activePlate.name, size: activePlate.size });
    setModalOpen(true);
  };

  const handleModalSave = () => {
    const performSave = () => {
      if (modalMode === 'create') {
        const newId = generateId();
        const newPlate: Plate = {
          id: newId,
          name: modalData.name || `Plate ${plates.length + 1}`,
          size: Number(modalData.size),
          wells: {}
        };
        setPlates([...plates, newPlate]);
        setActivePlateId(newId);
      } else {
        const sizeChanged = Number(modalData.size) !== activePlate.size;
        setPlates(plates.map(p => {
          if (p.id === activePlate.id) {
            return {
              ...p,
              name: modalData.name,
              size: Number(modalData.size),
              wells: sizeChanged ? {} : p.wells 
            };
          }
          return p;
        }));
      }
      setModalOpen(false);
    };

    if (modalMode === 'edit') {
        const sizeChanged = Number(modalData.size) !== activePlate.size;
        if (sizeChanged) {
            triggerConfirm(
                "Change Layout?", 
                "Changing the plate layout will clear all wells on this plate. This cannot be undone.", 
                performSave
            );
            return;
        }
    }
    performSave();
  };

  const requestDeletePlate = () => {
    if (plates.length <= 1) return; 

    triggerConfirm(
        "Delete Plate?",
        `Are you sure you want to permanently delete "${activePlate.name}"?`,
        () => {
            const newPlates = plates.filter(p => p.id !== activePlate.id);
            setPlates(newPlates);
            setActivePlateId(newPlates[0].id);
            setModalOpen(false);
        }
    );
  };

  const addReagent = () => {
    const randomColor = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
    const newId = generateId();
    setReagents([...reagents, { id: newId, name: 'New Reagent', color: randomColor }]);
    setActiveReagentId(newId);
  };

  const updateReagent = (id: string, field: keyof Reagent, value: string) => {
    setReagents(reagents.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const deleteReagent = (id: string) => {
    triggerConfirm(
        "Delete Reagent?",
        "Remove this reagent? Wells filled with it will remain colored but unlinked.",
        () => {
            setReagents(reagents.filter(r => r.id !== id));
            if (activeReagentId === id) setActiveReagentId('eraser');
        }
    );
  };

  const handleWellClick = (rowIndex: number, colIndex: number) => {
    const key = `${rowIndex}-${colIndex}`;
    const currentWells = { ...activePlate.wells };

    if (activeReagentId === 'eraser') {
      delete currentWells[key];
    } else {
      currentWells[key] = {
        reagentId: activeReagentId,
        value: useConcentration ? fillValue : null,
        unit: useConcentration ? fillUnit : null
      };
    }

    setPlates(plates.map(p => 
      p.id === activePlateId ? { ...p, wells: currentWells } : p
    ));
  };

  const getWellStyle = (rowIndex: number, colIndex: number) => {
    const key = `${rowIndex}-${colIndex}`;
    const wellData = activePlate.wells[key];
    
    if (!wellData) return { backgroundColor: darkMode ? '#1e293b' : 'white' }; 
    
    const reagent = reagents.find(r => r.id === wellData.reagentId);
    return { 
      backgroundColor: reagent ? reagent.color : (darkMode ? '#1e293b' : 'white'),
      color: reagent ? getContrastColor(reagent.color) : (darkMode ? '#94a3b8' : 'black')
    };
  };

  const getContrastColor = (hexColor: string) => {
    if (!hexColor) return 'black';
    const r = parseInt(hexColor.substr(1, 2), 16);
    const g = parseInt(hexColor.substr(3, 2), 16);
    const b = parseInt(hexColor.substr(5, 2), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return yiq >= 128 ? 'black' : 'white';
  };

  // --- Theme Classes ---
  const bgMain = darkMode ? 'bg-slate-950' : 'bg-slate-50';
  const bgSurface = darkMode ? 'bg-slate-900' : 'bg-white';
  const textMain = darkMode ? 'text-slate-100' : 'text-slate-800';
  const textMuted = darkMode ? 'text-slate-400' : 'text-slate-500';
  const border = darkMode ? 'border-slate-700' : 'border-slate-200';
  const inputBg = darkMode ? 'bg-slate-800' : 'bg-white';
  const hoverBg = darkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50';
  const activeItemBg = darkMode ? 'bg-slate-800' : 'bg-white';

  return (
    <div className={`flex h-screen w-full font-sans overflow-hidden transition-colors duration-200 ${bgMain} ${textMain}`}>
      
      {/* Custom Confirmation Modal */}
      {confirmConfig.isOpen && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className={`${bgSurface} p-6 rounded-xl shadow-2xl w-full max-w-sm border ${border} transform scale-100 animate-in fade-in zoom-in duration-200`}>
                <div className="flex items-center gap-3 text-amber-500 mb-4">
                    <AlertTriangle className="w-6 h-6" />
                    <h3 className={`text-lg font-bold ${textMain}`}>{confirmConfig.title}</h3>
                </div>
                <p className={`${textMuted} mb-6`}>{confirmConfig.message}</p>
                <div className="flex gap-3">
                    <button 
                        onClick={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
                        className={`flex-1 p-2.5 rounded-lg font-medium ${darkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200'}`}
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={confirmConfig.action!}
                        className="flex-1 p-2.5 rounded-lg font-medium bg-red-600 hover:bg-red-700 text-white shadow-md"
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Settings Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className={`${bgSurface} p-6 rounded-xl shadow-2xl w-full max-w-sm border ${border}`}>
            <h2 className="text-lg font-bold mb-4">{modalMode === 'create' ? 'Create New Plate' : 'Edit Plate'}</h2>
            
            <div className="space-y-4">
              <div>
                <label className={`block text-xs font-bold ${textMuted} uppercase tracking-wider mb-1`}>Plate Name</label>
                <input 
                  type="text" 
                  value={modalData.name}
                  onChange={(e) => setModalData({...modalData, name: e.target.value})}
                  className={`w-full p-2 rounded border ${border} ${inputBg} outline-none focus:ring-2 focus:ring-blue-500`}
                  autoFocus
                />
              </div>

              <div>
                <label className={`block text-xs font-bold ${textMuted} uppercase tracking-wider mb-1`}>Layout Size</label>
                <select 
                  value={modalData.size}
                  onChange={(e) => setModalData({...modalData, size: e.target.value})}
                  className={`w-full p-2 rounded border ${border} ${inputBg} outline-none`}
                >
                  {Object.entries(PLATE_SIZES).map(([size, config]) => (
                    <option key={size} value={size}>{config.label} ({config.rows}x{config.cols})</option>
                  ))}
                </select>
                {modalMode === 'edit' && (
                  <p className="text-xs text-red-500 mt-1">Warning: Changing size clears the plate.</p>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              {modalMode === 'edit' && plates.length > 1 && (
                <button 
                  onClick={requestDeletePlate}
                  className="p-2 rounded font-medium bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors"
                  title="Delete Plate"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
              <button 
                onClick={() => setModalOpen(false)}
                className={`flex-1 p-2 rounded font-medium ${darkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200'}`}
              >
                Cancel
              </button>
              <button 
                onClick={handleModalSave}
                className="flex-1 p-2 rounded font-medium bg-blue-600 hover:bg-blue-700 text-white"
              >
                {modalMode === 'create' ? 'Create' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed md:relative z-30 w-80 h-full ${bgSurface} border-r ${border} shadow-xl md:shadow-none transform transition-transform duration-200 ease-in-out flex flex-col
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          ${!isSidebarOpen && 'md:-ml-80'} 
        `}
      >
        <div className={`p-4 border-b ${border} flex justify-between items-center ${darkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
          <h1 className="font-bold text-lg flex items-center gap-2">
            <Beaker className="w-5 h-5 text-blue-500" />
            LabPlanner
          </h1>
          <button onClick={() => setIsSidebarOpen(false)} className={`md:hidden p-1 ${textMuted}`}>
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          
          {/* Paint Settings */}
          <section className={`p-4 rounded-xl border ${darkMode ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-100'}`}>
            <h3 className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-3">Fill Settings</h3>
            
            <div className="flex items-center gap-2 mb-3">
              <input 
                type="checkbox" 
                id="useConc" 
                checked={useConcentration} 
                onChange={(e) => setUseConcentration(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="useConc" className={`text-xs font-bold cursor-pointer select-none ${textMuted}`}>
                Include Concentration
              </label>
            </div>

            {useConcentration && (
              <div className="flex gap-2 mb-3">
                <div className="flex-1">
                  <label className={`block text-xs ${textMuted} mb-1`}>Amount</label>
                  <input 
                    type="text" 
                    value={fillValue}
                    onChange={(e) => setFillValue(e.target.value)}
                    className={`w-full p-2 rounded border ${border} ${inputBg} text-sm focus:ring-2 focus:ring-blue-500 outline-none`}
                  />
                </div>
                <div className="w-20">
                  <label className={`block text-xs ${textMuted} mb-1`}>Unit</label>
                  <select 
                    value={fillUnit}
                    onChange={(e) => setFillUnit(e.target.value)}
                    className={`w-full p-2 rounded border ${border} ${inputBg} text-sm outline-none`}
                  >
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
            )}
          </section>

          {/* Reagents List */}
          <section>
            <div className="flex justify-between items-center mb-3">
              <h3 className={`text-xs font-bold ${textMuted} uppercase tracking-wider`}>Reagents</h3>
              <button 
                onClick={addReagent}
                className="text-xs bg-slate-700 text-white px-2 py-1 rounded hover:bg-slate-600 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>

            <div className="space-y-2">
              {/* Eraser Tool */}
              <div 
                onClick={() => setActiveReagentId('eraser')}
                className={`
                  flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-all
                  ${activeReagentId === 'eraser' 
                    ? `${activeItemBg} border-slate-400 ring-1 ring-slate-400` 
                    : `border-transparent ${hoverBg}`}
                `}
              >
                <div className={`w-8 h-8 rounded-full border-2 ${darkMode ? 'border-slate-600 bg-slate-800' : 'border-slate-300 bg-white'} flex items-center justify-center ${textMuted}`}>
                  <Eraser className="w-4 h-4" />
                </div>
                <span className={`font-medium text-sm ${textMuted}`}>Eraser (Clear Well)</span>
              </div>

              {/* Reagent Items */}
              {reagents.map(reagent => (
                <div 
                  key={reagent.id}
                  className={`
                    relative group p-3 rounded-lg border transition-all
                    ${activeReagentId === reagent.id 
                      ? `${activeItemBg} border-blue-500 ring-1 ring-blue-500 shadow-sm` 
                      : `border-transparent ${hoverBg}`}
                  `}
                  onClick={() => setActiveReagentId(reagent.id)}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <input 
                      type="color" 
                      value={reagent.color}
                      onChange={(e) => updateReagent(reagent.id, 'color', e.target.value)}
                      className="w-8 h-8 rounded-full cursor-pointer border-none bg-transparent p-0 overflow-hidden shrink-0"
                    />
                    <input 
                      type="text"
                      value={reagent.name}
                      onChange={(e) => updateReagent(reagent.id, 'name', e.target.value)}
                      onClick={(e) => e.stopPropagation()} 
                      className={`flex-1 bg-transparent text-sm font-medium focus:border-b ${border} outline-none ${textMain}`}
                    />
                    <button 
                      onClick={(e) => { e.stopPropagation(); deleteReagent(reagent.id); }}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Color Presets Grid */}
                  <div className="flex flex-wrap gap-1.5 pl-11">
                    {PRESET_COLORS.map(color => (
                      <button
                        key={color}
                        onClick={(e) => { e.stopPropagation(); updateReagent(reagent.id, 'color', color); }}
                        className={`
                          w-4 h-4 rounded-full border border-black/10 transition-transform hover:scale-110
                          ${reagent.color === color ? 'ring-2 ring-slate-400 scale-110' : ''}
                        `}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* Top Bar */}
        <header className={`${bgSurface} border-b ${border} h-16 flex items-center justify-between px-4 shrink-0 z-10`}>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`p-2 rounded hover:${darkMode ? 'bg-slate-800' : 'bg-slate-100'} ${textMuted}`}
            >
              <Menu className="w-5 h-5" />
            </button>
            
            {/* Plate Tabs */}
            <div className="flex gap-1 overflow-x-auto max-w-[200px] md:max-w-md hide-scrollbar">
              {plates.map(plate => (
                <button
                  key={plate.id}
                  onClick={() => setActivePlateId(plate.id)}
                  className={`
                    px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors
                    ${activePlateId === plate.id 
                      ? 'bg-slate-800 text-white' 
                      : `${darkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200'} ${textMuted}`}
                  `}
                >
                  {plate.name}
                </button>
              ))}
            </div>
            <button 
              onClick={initiateAddPlate} 
              className={`p-1.5 rounded-full ${darkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200'} ${textMuted}`}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Edit Plate Button */}
            <button 
              onClick={initiateEditPlate}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${darkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200'} ${textMain}`}
              title="Plate Settings"
            >
               <Settings className="w-4 h-4" />
               <span className="hidden sm:inline">Settings</span>
            </button>

            <div className={`w-px h-6 mx-2 ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>

            {/* Dark Mode Toggle */}
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-full ${darkMode ? 'bg-slate-800 text-yellow-400' : 'bg-slate-100 text-slate-600'}`}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Plate Viewport */}
        <div className={`flex-1 overflow-auto ${bgMain} p-4 md:p-8 relative touch-pan-x touch-pan-y`}>
          
          {/* Grid Container */}
          <div className={`min-w-fit mx-auto ${bgSurface} p-4 md:p-8 rounded-xl shadow-sm border ${border}`}>
            
            {/* Grid Header (Column Numbers) */}
            <div 
              className="grid gap-1 mb-2 ml-8"
              style={{ 
                gridTemplateColumns: `repeat(${PLATE_SIZES[activePlate.size].cols}, minmax(3rem, 1fr))` 
              }}
            >
              {Array.from({ length: PLATE_SIZES[activePlate.size].cols }).map((_, i) => (
                <div key={i} className={`text-center text-xs font-bold ${textMuted} select-none`}>
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Rows */}
            <div className="grid gap-2">
              {Array.from({ length: PLATE_SIZES[activePlate.size].rows }).map((_, rowIndex) => (
                <div key={rowIndex} className="flex gap-2 items-center">
                  {/* Row Label (Letters) */}
                  <div className={`w-6 text-right text-xs font-bold ${textMuted} select-none`}>
                    {getRowLabel(rowIndex)}
                  </div>
                  
                  {/* Wells */}
                  <div 
                    className="grid gap-1 md:gap-2 flex-1"
                    style={{ 
                      gridTemplateColumns: `repeat(${PLATE_SIZES[activePlate.size].cols}, minmax(3rem, 1fr))` // Min size ensures scrolling on mobile
                    }}
                  >
                    {Array.from({ length: PLATE_SIZES[activePlate.size].cols }).map((_, colIndex) => {
                      const wellKey = `${rowIndex}-${colIndex}`;
                      const wellData = activePlate.wells[wellKey];
                      const style = getWellStyle(rowIndex, colIndex);
                      
                      return (
                        <button
                          key={colIndex}
                          onClick={() => handleWellClick(rowIndex, colIndex)}
                          className={`
                            aspect-square rounded-full border ${darkMode ? 'border-slate-700 hover:border-slate-500' : 'border-slate-200 hover:border-slate-400'} transition-all relative group
                            flex items-center justify-center overflow-hidden shadow-inner
                          `}
                          style={style}
                          title={wellData ? `Row ${getRowLabel(rowIndex)} Col ${colIndex + 1}: ${wellData.value || ''}${wellData.unit || ''}` : 'Empty'}
                        >
                          {/* Well Content */}
                          {wellData && wellData.value && (
                            <>
                              <span className="text-[10px] md:text-xs font-semibold truncate w-full px-1">
                                {wellData.value}
                                <span className="opacity-75 text-[8px] md:text-[10px] block -mt-0.5">{wellData.unit}</span>
                              </span>
                            </>
                          )}
                          
                          {/* Hover Effect (Light highlight) */}
                          <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}