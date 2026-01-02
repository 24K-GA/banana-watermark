import { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Eraser, Download, Undo, Check, Grid, Plus, AlertCircle } from 'lucide-react';
import HandDrawnButton from './components/HandDrawnButton';
import PhotoCard from './components/PhotoCard';
import { getWobblyRadius, APP_MODES, QUEUE_STATUS } from './constants';
import { loadMasks, selectMask, detectWatermark, reverseAlphaBlend } from './utils/maskUtils';
import { loadImage, downloadFile } from './utils/imageUtils';

export default function App() {
  // ===== Masks State =====
  const [masks, setMasks] = useState(new Map());
  const [masksLoaded, setMasksLoaded] = useState(false);
  const [masksError, setMasksError] = useState(null);
  
  // ===== Intro Animation State =====
  const [showIntro, setShowIntro] = useState(true);
  const [introPhase, setIntroPhase] = useState(0); // 0: 香蕉雨, 1: 聚合, 2: 合体, 3: 标题, 4: 完成
  const [bananas, setBananas] = useState([]);
  
  // ===== Queue State =====
  const [queue, setQueue] = useState([]);
  const [activeId, setActiveId] = useState(null);
  
  // ===== Mode State =====
  const [mode, setMode] = useState(APP_MODES.UPLOAD);
  
  // ===== Editor State =====
  const [image, setImage] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(20);
  const [isProcessing, setIsProcessing] = useState(false);
  const [history, setHistory] = useState([]);
  const [processedSrc, setProcessedSrc] = useState(null);
  
  // ===== Refs =====
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // ===== Initialize Masks =====
  useEffect(() => {
    loadMasks()
      .then(loadedMasks => {
        setMasks(loadedMasks);
        setMasksLoaded(true);
        if (loadedMasks.size === 0) {
          setMasksError('无法加载 Mask 文件，请检查 public/assets 目录');
        }
        console.log('🍌 Nano Banana Watermark Remover initialized');
      })
      .catch(err => {
        setMasksError('Mask 加载失败: ' + err.message);
        console.error('Mask loading error:', err);
      });
  }, []);

  // ===== Intro Animation =====
  useEffect(() => {
    // 生成随机香蕉位置
    const initialBananas = [...Array(24)].map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: -20 - Math.random() * 80,
      rotation: Math.random() * 360,
      scale: 0.6 + Math.random() * 0.6,
      delay: Math.random() * 0.8
    }));
    setBananas(initialBananas);
    
    // 动画序列
    const timers = [
      setTimeout(() => setIntroPhase(1), 100),    // 开始下落
      setTimeout(() => setIntroPhase(2), 1500),   // 开始聚合
      setTimeout(() => setIntroPhase(3), 2500),   // 合体完成，显示标题
      setTimeout(() => setIntroPhase(4), 3500),   // 准备退出
      setTimeout(() => setShowIntro(false), 4200) // 隐藏开场
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  // ===== File Handling =====
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const newItems = Array.from(e.target.files).map(file => ({
        id: crypto.randomUUID(),
        file,
        name: file.name,
        originalSrc: URL.createObjectURL(file),
        processedSrc: null,
        status: QUEUE_STATUS.PENDING
      }));

      setQueue(prev => [...prev, ...newItems]);
      setMode(APP_MODES.GALLERY);
      e.target.value = '';
    }
  };

  // ===== Drag and Drop =====
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/webp'
    );
    
    if (files.length > 0) {
      const newItems = files.map(file => ({
        id: crypto.randomUUID(),
        file,
        name: file.name,
        originalSrc: URL.createObjectURL(file),
        processedSrc: null,
        status: QUEUE_STATUS.PENDING
      }));

      setQueue(prev => [...prev, ...newItems]);
      setMode(APP_MODES.GALLERY);
    }
  }, []);

  const removeItem = (id) => {
    setQueue(prev => {
      const newQueue = prev.filter(item => item.id !== id);
      if (newQueue.length === 0) setMode(APP_MODES.UPLOAD);
      return newQueue;
    });
  };

  // ===== Auto Processing =====
  const startProcessing = async (id) => {
    const item = queue.find(q => q.id === id);
    if (!item) return;

    setActiveId(id);
    setIsProcessing(true);
    setMode(APP_MODES.PROCESSING);

    try {
      const img = await loadImage(item.originalSrc);
      setImage(img);
      
      const mask = selectMask(img.width, img.height, masks);
      if (!mask) {
        // 没有 mask，直接进入手动模式
        setIsProcessing(false);
        const useManual = window.confirm('Mask 未加载，是否使用手动标记模式？');
        if (useManual) {
          setMode(APP_MODES.EDIT);
          setHistory([]);
        } else {
          setMode(APP_MODES.GALLERY);
          setActiveId(null);
        }
        return;
      }

      // 创建 canvas 进行处理
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // 检测水印
      const hasWatermark = detectWatermark(imageData, mask, canvas.width, canvas.height);

      if (!hasWatermark) {
        // 未检测到水印，询问是否使用手动模式
        setIsProcessing(false);
        const useManual = window.confirm('未检测到水印，是否使用手动标记模式？\n\n提示：如果图片确实有水印但未被检测到，可以尝试手动标记。');
        if (useManual) {
          setMode(APP_MODES.EDIT);
          setHistory([]);
        } else {
          // 标记为已完成（无水印）
          setQueue(prev => prev.map(qItem => 
            qItem.id === id 
              ? { ...qItem, processedSrc: item.originalSrc, status: QUEUE_STATUS.COMPLETED, noWatermark: true } 
              : qItem
          ));
          setMode(APP_MODES.GALLERY);
          setActiveId(null);
        }
        return;
      }

      // 执行 Reverse Alpha Blending
      reverseAlphaBlend(imageData, mask, canvas.width, canvas.height);
      ctx.putImageData(imageData, 0, 0);

      const resultDataUrl = canvas.toDataURL('image/png');
      setProcessedSrc(resultDataUrl);

      // 更新队列
      setQueue(prev => prev.map(qItem => 
        qItem.id === id 
          ? { ...qItem, processedSrc: resultDataUrl, status: QUEUE_STATUS.COMPLETED } 
          : qItem
      ));

      setIsProcessing(false);
      setMode(APP_MODES.RESULT);
    } catch (error) {
      console.error('Processing error:', error);
      setIsProcessing(false);
      alert('处理失败: ' + error.message + '\n\n可以尝试使用手动模式。');
      setMode(APP_MODES.GALLERY);
    }
  };

  // ===== Canvas Editor =====
  useEffect(() => {
    if (mode === APP_MODES.EDIT && canvasRef.current && image) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      canvas.width = image.width;
      canvas.height = image.height;
      ctx.drawImage(image, 0, 0);
      saveHistory();
    }
  }, [mode, image]);

  const saveHistory = () => {
    if (canvasRef.current) {
      setHistory(prev => [...prev.slice(-4), canvasRef.current.toDataURL()]);
    }
  };

  const handleUndo = () => {
    if (history.length > 1) {
      const newHistory = [...history];
      newHistory.pop();
      const prevState = newHistory[newHistory.length - 1];
      setHistory(newHistory);
      
      const img = new Image();
      img.onload = () => {
        const ctx = canvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = prevState;
    }
  };

  // Drawing Handlers
  const getCoordinates = (e) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSize;
    ctx.strokeStyle = 'rgba(255, 77, 77, 0.5)';
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      canvasRef.current.getContext('2d').closePath();
      saveHistory();
    }
  };

  // ===== Manual Processing =====
  const handleManualRemove = async () => {
    setIsProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    if (canvasRef.current && image) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // 识别标记的像素 (红色区域)
      const maskPixels = [];
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        if (r > g + 20 && r > b + 20) {
          maskPixels.push(i);
        }
      }

      // 获取原图数据
      const originalCanvas = document.createElement('canvas');
      originalCanvas.width = canvas.width;
      originalCanvas.height = canvas.height;
      originalCanvas.getContext('2d').drawImage(image, 0, 0);
      const originalData = originalCanvas.getContext('2d')
        .getImageData(0, 0, canvas.width, canvas.height).data;

      // 简单修复: 从附近像素采样
      maskPixels.forEach(index => {
        const offset = (Math.random() > 0.5 ? 20 : -20) * 4;
        if (index + offset >= 0 && index + offset < data.length) {
          data[index] = originalData[index + offset];
          data[index + 1] = originalData[index + offset + 1];
          data[index + 2] = originalData[index + offset + 2];
        }
      });
      
      ctx.putImageData(imageData, 0, 0);
      const resultDataUrl = canvas.toDataURL();
      setProcessedSrc(resultDataUrl);

      setQueue(prev => prev.map(item => 
        item.id === activeId 
          ? { ...item, processedSrc: resultDataUrl, status: QUEUE_STATUS.COMPLETED } 
          : item
      ));
    }
    
    setIsProcessing(false);
    setMode(APP_MODES.RESULT);
  };

  // ===== Navigation =====
  const saveAndBack = () => {
    setMode(APP_MODES.GALLERY);
    setActiveId(null);
    setProcessedSrc(null);
  };

  // ===== Download =====
  const downloadAll = () => {
    queue.filter(q => q.status === QUEUE_STATUS.COMPLETED).forEach((item, index) => {
      setTimeout(() => {
        const baseName = item.name.replace(/\.[^.]+$/, '');
        const src = item.processedSrc || item.originalSrc;
        downloadFile(src, `${baseName}_(watermark removed).png`);
      }, index * 300);
    });
  };

  const downloadSingle = () => {
    if (processedSrc && activeItem) {
      const baseName = activeItem.name.replace(/\.[^.]+$/, '');
      downloadFile(processedSrc, `${baseName}_(watermark removed).png`);
    }
  };

  // ===== Get Active Item =====
  const activeItem = queue.find(q => q.id === activeId);

  return (
    <div className="min-h-screen bg-[#fdfbf7] text-[#2d2d2d] overflow-x-hidden pb-20">
      
      {/* ===== 开场动画 ===== */}
      {showIntro && (
        <div 
          className={`fixed inset-0 z-50 bg-[#fdfbf7] flex items-center justify-center overflow-hidden transition-opacity duration-700 ${
            introPhase >= 4 ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          {/* 香蕉雨 - 下落然后聚合到中心 */}
          {bananas.map((banana) => {
            // 计算目标位置（中心点）
            const centerX = 50;
            const centerY = 50;
            
            // 根据阶段计算位置
            let currentX = banana.x;
            let currentY = banana.y;
            let currentRotation = banana.rotation;
            let currentScale = banana.scale;
            let currentOpacity = 1;
            
            if (introPhase >= 1) {
              // 阶段1: 下落到屏幕中
              currentY = 30 + (banana.id % 5) * 12;
            }
            if (introPhase >= 2) {
              // 阶段2: 聚合到中心
              currentX = centerX;
              currentY = centerY;
              currentRotation = 0;
              currentScale = 0.3;
            }
            if (introPhase >= 3) {
              // 阶段3: 消失（合体成大香蕉）
              currentOpacity = 0;
              currentScale = 0;
            }
            
            return (
              <div
                key={banana.id}
                className="absolute text-4xl md:text-5xl pointer-events-none"
                style={{
                  left: `${currentX}%`,
                  top: `${currentY}%`,
                  transform: `translate(-50%, -50%) rotate(${currentRotation}deg) scale(${currentScale})`,
                  opacity: currentOpacity,
                  transition: introPhase >= 2 
                    ? `all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) ${banana.delay * 0.3}s`
                    : `all 1s ease-out ${banana.delay}s`,
                }}
              >
                🍌
              </div>
            );
          })}
          
          {/* 中心大香蕉 - 合体后出现 */}
          <div 
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
            style={{
              transform: `translate(-50%, -50%) scale(${introPhase >= 3 ? 1 : 0})`,
              opacity: introPhase >= 3 ? 1 : 0,
              transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            {/* 光环效果 */}
            <div 
              className="absolute w-48 h-48 md:w-64 md:h-64 rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(255,249,196,0.8) 0%, rgba(255,249,196,0) 70%)',
                animation: introPhase >= 3 ? 'pulse-scale 1s ease-in-out infinite' : 'none',
              }}
            />
            
            {/* 大香蕉 */}
            <div 
              className="text-[100px] md:text-[150px] relative z-10"
              style={{
                animation: introPhase >= 3 ? 'banana-bounce-rotate 1s ease-in-out infinite' : 'none',
              }}
            >
              🍌
            </div>
            
            {/* 星星装饰 */}
            <div className="absolute -top-4 -right-4 text-3xl animate-twinkle">✨</div>
            <div className="absolute -bottom-2 -left-6 text-2xl animate-twinkle" style={{ animationDelay: '0.3s' }}>⭐</div>
            <div className="absolute top-1/2 -right-10 text-xl animate-twinkle" style={{ animationDelay: '0.6s' }}>💫</div>
            
            {/* 标题 */}
            <div 
              className="mt-4 text-center"
              style={{
                opacity: introPhase >= 3 ? 1 : 0,
                transform: `translateY(${introPhase >= 3 ? 0 : 20}px)`,
                transition: 'all 0.5s ease-out 0.3s',
              }}
            >
              <h1 className="marker-font text-4xl md:text-6xl mb-2">
                Nano <span className="text-[#ff4d4d]">Banana</span>
              </h1>
              <p className="hand-font text-lg md:text-xl text-gray-500">水印去除工具</p>
            </div>
          </div>
          
          {/* 底部加载提示 */}
          <div 
            className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3"
            style={{
              opacity: introPhase >= 3 ? 1 : 0,
              transition: 'opacity 0.5s ease-out 0.5s',
            }}
          >
            <div className="flex gap-2">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-2.5 h-2.5 bg-[#ff4d4d] rounded-full"
                  style={{ 
                    animation: 'bounce 0.6s ease-in-out infinite',
                    animationDelay: `${i * 0.15}s` 
                  }}
                />
              ))}
            </div>
            <p className="hand-font text-sm text-gray-400">正在准备香蕉魔法...</p>
          </div>
        </div>
      )}
      {/* Navbar */}
      <nav className="w-full max-w-6xl mx-auto p-6 flex justify-between items-center relative z-10">
        <div 
          className="flex items-center gap-3 cursor-pointer group" 
          onClick={() => setMode(queue.length > 0 ? APP_MODES.GALLERY : APP_MODES.UPLOAD)}
        >
          <div className="relative">
            <div className="w-12 h-12 bg-[#2d2d2d] absolute top-1 left-1 rounded-full opacity-20 group-hover:opacity-30 transition-opacity" />
            <div 
              className="w-12 h-12 bg-gradient-to-br from-[#fff9c4] to-[#ffe082] border-[3px] border-[#2d2d2d] flex items-center justify-center relative z-10 group-hover:scale-110 group-hover:rotate-12 transition-all duration-300 shadow-[2px_2px_0px_0px_#2d2d2d]" 
              style={{ borderRadius: '50% 40% 60% 50%' }}
            >
              <span className="text-2xl group-hover:animate-wiggle">🍌</span>
            </div>
          </div>
          <div>
            <h1 className="marker-font text-2xl md:text-3xl tracking-wide group-hover:rotate-1 transition-transform">
              Nano <span className="text-[#ff4d4d] underline decoration-wavy decoration-2 group-hover:decoration-4 transition-all">Banana</span>
            </h1>
            <p className="hand-font text-xs text-gray-400 hidden md:block">水印去除工具</p>
          </div>
        </div>
        
        {/* Step Indicator */}
        <div className="hidden md:flex items-center gap-2 hand-font text-base">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border-2 transition-all ${
            mode === APP_MODES.UPLOAD 
              ? 'bg-[#fff9c4] border-[#2d2d2d] shadow-[2px_2px_0px_0px_#2d2d2d]' 
              : 'border-transparent text-gray-400'
          }`}>
            <span className="w-6 h-6 bg-[#2d2d2d] text-white rounded-full flex items-center justify-center text-sm">1</span>
            <span>上传</span>
          </div>
          <span className="text-gray-300">→</span>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border-2 transition-all ${
            mode === APP_MODES.GALLERY 
              ? 'bg-[#e8f5e9] border-[#2d2d2d] shadow-[2px_2px_0px_0px_#2d2d2d]' 
              : 'border-transparent text-gray-400'
          }`}>
            <span className="w-6 h-6 bg-[#2d2d2d] text-white rounded-full flex items-center justify-center text-sm">2</span>
            <span>选择</span>
          </div>
          <span className="text-gray-300">→</span>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border-2 transition-all ${
            [APP_MODES.EDIT, APP_MODES.RESULT, APP_MODES.PROCESSING].includes(mode) 
              ? 'bg-[#ffebee] border-[#2d2d2d] shadow-[2px_2px_0px_0px_#2d2d2d]' 
              : 'border-transparent text-gray-400'
          }`}>
            <span className="w-6 h-6 bg-[#2d2d2d] text-white rounded-full flex items-center justify-center text-sm">3</span>
            <span>消除</span>
          </div>
        </div>
      </nav>

      <main className="w-full max-w-6xl mx-auto px-6 flex flex-col items-center">
        
        {/* Mask 加载错误提示 */}
        {masksError && (
          <div className="w-full max-w-3xl mb-6 p-4 bg-red-50 border-2 border-red-300 rounded-lg flex items-center gap-3">
            <AlertCircle className="text-red-500 flex-shrink-0" size={24} />
            <div>
              <p className="marker-font text-red-600">{masksError}</p>
              <p className="hand-font text-sm text-red-500">自动模式可能无法正常工作，但手动模式仍可使用</p>
            </div>
          </div>
        )}

        {/* Mask 加载中提示 */}
        {!masksLoaded && !masksError && (
          <div className="w-full max-w-3xl mb-6 p-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
            <p className="marker-font text-yellow-700">正在加载 Mask 资源...</p>
          </div>
        )}
        
        {/* ===== UPLOAD MODE ===== */}
        {mode === APP_MODES.UPLOAD && (
          <div className="w-full max-w-4xl animate-fade-in mt-6 relative">
            
            {/* 背景装饰香蕉 */}
            <div className="absolute -top-20 -left-20 text-8xl opacity-20 animate-banana-float-around hidden lg:block">🍌</div>
            <div className="absolute -top-10 -right-16 text-6xl opacity-25 animate-banana-swing hidden lg:block" style={{ animationDelay: '0.5s' }}>🍌</div>
            <div className="absolute top-40 -left-24 text-5xl opacity-15 animate-banana-bounce-rotate hidden lg:block" style={{ animationDelay: '1s' }}>🍌</div>
            <div className="absolute top-60 -right-20 text-7xl opacity-20 animate-banana-float-around hidden lg:block" style={{ animationDelay: '1.5s' }}>🍌</div>
            
            {/* Hero Section */}
            <div className="text-center mb-8 relative">
              {/* 主香蕉装饰 */}
              <div className="flex justify-center items-center gap-4 mb-6">
                <span className="text-5xl md:text-6xl animate-banana-swing" style={{ animationDelay: '0s' }}>🍌</span>
                <span className="text-6xl md:text-7xl animate-banana-bounce-rotate">🍌</span>
                <span className="text-5xl md:text-6xl animate-banana-swing" style={{ animationDelay: '0.3s' }}>🍌</span>
              </div>
              
              <h2 className="marker-font text-5xl md:text-6xl mb-4 relative inline-block">
                批量去水印
                <span className="absolute -top-3 -right-8 text-3xl animate-twinkle">✨</span>
                <span className="absolute -bottom-2 -left-6 text-2xl animate-twinkle" style={{ animationDelay: '0.5s' }}>⭐</span>
              </h2>
              <p className="hand-font text-xl text-gray-500 mb-2">一次上传多张图片，自动检测并去除水印</p>
              <p className="hand-font text-sm text-gray-400">🔒 本地处理，图片不会上传到服务器</p>
              
              {/* 特性标签 */}
              <div className="flex flex-wrap justify-center gap-3 mt-6">
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-[#fff9c4] border-2 border-[#2d2d2d] rounded-full text-sm marker-font transform -rotate-1 shadow-[2px_2px_0px_0px_#2d2d2d] hover:shadow-[1px_1px_0px_0px_#2d2d2d] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-default">
                  <span className="text-lg">🚀</span> 自动检测
                </span>
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-[#e8f5e9] border-2 border-[#2d2d2d] rounded-full text-sm marker-font transform rotate-1 shadow-[2px_2px_0px_0px_#2d2d2d] hover:shadow-[1px_1px_0px_0px_#2d2d2d] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-default">
                  <span className="text-lg">🎨</span> 手动修复
                </span>
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-[#e3f2fd] border-2 border-[#2d2d2d] rounded-full text-sm marker-font transform -rotate-2 shadow-[2px_2px_0px_0px_#2d2d2d] hover:shadow-[1px_1px_0px_0px_#2d2d2d] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-default">
                  <span className="text-lg">📦</span> 批量处理
                </span>
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-[#fce4ec] border-2 border-[#2d2d2d] rounded-full text-sm marker-font transform rotate-2 shadow-[2px_2px_0px_0px_#2d2d2d] hover:shadow-[1px_1px_0px_0px_#2d2d2d] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-default">
                  <span className="text-lg">🍌</span> 香蕉魔法
                </span>
              </div>
            </div>

            {/* 上传区域 */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="group relative bg-white w-full h-72 border-4 border-dashed border-[#2d2d2d] cursor-pointer flex flex-col items-center justify-center gap-4 hover:border-[#ff4d4d] hover:bg-[#fff9f9] transition-all duration-300 animate-pulse-scale"
              style={{ borderRadius: getWobblyRadius() }}
            >
              {/* 角落香蕉装饰 */}
              <div className="absolute top-4 left-4 text-3xl opacity-30 group-hover:opacity-60 group-hover:scale-125 transition-all duration-300 group-hover:rotate-12">🍌</div>
              <div className="absolute top-4 right-4 text-3xl opacity-30 group-hover:opacity-60 group-hover:scale-125 transition-all duration-300 group-hover:-rotate-12">🍌</div>
              <div className="absolute bottom-4 left-4 text-3xl opacity-30 group-hover:opacity-60 group-hover:scale-125 transition-all duration-300 group-hover:-rotate-12">🍌</div>
              <div className="absolute bottom-4 right-4 text-3xl opacity-30 group-hover:opacity-60 group-hover:scale-125 transition-all duration-300 group-hover:rotate-12">🍌</div>
              
              {/* 角落装饰线 */}
              <div className="absolute top-3 left-3 w-8 h-8 border-t-4 border-l-4 border-[#ff4d4d] rounded-tl-lg opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute top-3 right-3 w-8 h-8 border-t-4 border-r-4 border-[#ff4d4d] rounded-tr-lg opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute bottom-3 left-3 w-8 h-8 border-b-4 border-l-4 border-[#ff4d4d] rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute bottom-3 right-3 w-8 h-8 border-b-4 border-r-4 border-[#ff4d4d] rounded-br-lg opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="relative">
                <div className="w-28 h-28 bg-gradient-to-br from-[#fff9c4] to-[#ffe082] rounded-full flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 border-3 border-[#2d2d2d] shadow-[4px_4px_0px_0px_#2d2d2d] group-hover:shadow-[2px_2px_0px_0px_#2d2d2d]">
                  <span className="text-5xl group-hover:animate-banana-bounce-rotate">🍌</span>
                </div>
                {/* 小装饰 */}
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-[#ff4d4d] rounded-full border-2 border-[#2d2d2d] flex items-center justify-center animate-pulse">
                  <Upload size={12} className="text-white" />
                </div>
              </div>
              
              <div className="text-center">
                <p className="marker-font text-2xl mb-2 group-hover:text-[#ff4d4d] transition-colors">
                  点击选择或拖拽图片
                </p>
                <p className="hand-font text-lg text-gray-500">支持 JPG, PNG, WebP · 可批量上传</p>
              </div>
              
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept="image/*"
                multiple
              />
            </div>

            {/* 使用说明卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              <div className="bg-white p-5 border-3 border-[#2d2d2d] rounded-lg shadow-[4px_4px_0px_0px_#2d2d2d] transform hover:-translate-y-2 hover:shadow-[6px_6px_0px_0px_#2d2d2d] transition-all group">
                <div className="text-4xl mb-3 group-hover:animate-banana-bounce-rotate">🍌</div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-8 h-8 bg-[#fff9c4] rounded-full flex items-center justify-center border-2 border-[#2d2d2d] marker-font font-bold">1</span>
                  <h3 className="marker-font text-lg">上传图片</h3>
                </div>
                <p className="hand-font text-sm text-gray-500">选择或拖拽带水印的图片到上传区域</p>
              </div>
              <div className="bg-white p-5 border-3 border-[#2d2d2d] rounded-lg shadow-[4px_4px_0px_0px_#2d2d2d] transform hover:-translate-y-2 hover:shadow-[6px_6px_0px_0px_#2d2d2d] transition-all group">
                <div className="text-4xl mb-3 group-hover:animate-wiggle">✨</div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-8 h-8 bg-[#e8f5e9] rounded-full flex items-center justify-center border-2 border-[#2d2d2d] marker-font font-bold">2</span>
                  <h3 className="marker-font text-lg">魔法处理</h3>
                </div>
                <p className="hand-font text-sm text-gray-500">香蕉魔法自动检测并去除水印</p>
              </div>
              <div className="bg-white p-5 border-3 border-[#2d2d2d] rounded-lg shadow-[4px_4px_0px_0px_#2d2d2d] transform hover:-translate-y-2 hover:shadow-[6px_6px_0px_0px_#2d2d2d] transition-all group">
                <div className="text-4xl mb-3 group-hover:animate-bounce">📥</div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-8 h-8 bg-[#e3f2fd] rounded-full flex items-center justify-center border-2 border-[#2d2d2d] marker-font font-bold">3</span>
                  <h3 className="marker-font text-lg">下载结果</h3>
                </div>
                <p className="hand-font text-sm text-gray-500">一键下载所有处理完成的图片</p>
              </div>
            </div>
            
            {/* 底部香蕉装饰 */}
            <div className="flex justify-center items-center gap-2 mt-10 opacity-40">
              {[...Array(7)].map((_, i) => (
                <span 
                  key={i} 
                  className="text-2xl animate-banana-swing"
                  style={{ animationDelay: `${i * 0.2}s` }}
                >
                  🍌
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ===== GALLERY MODE ===== */}
        {mode === APP_MODES.GALLERY && (
          <div className="w-full animate-fade-in">
            <div className="flex justify-between items-end mb-8 border-b-2 border-dashed border-[#2d2d2d]/20 pb-4">
              <div>
                <h2 className="marker-font text-3xl flex items-center gap-3">
                  <span className="text-3xl">📸</span>
                  图片列表 
                  <span className="bg-gradient-to-r from-[#ff4d4d] to-[#ff6b6b] text-white text-sm px-3 py-1 rounded-full marker-font transform -rotate-2 shadow-sm">
                    {queue.length} 张
                  </span>
                </h2>
                <p className="hand-font text-gray-500 mt-1">点击图片开始处理 · 已完成 {queue.filter(q => q.status === QUEUE_STATUS.COMPLETED).length} 张</p>
              </div>
              <div className="flex gap-3">
                <HandDrawnButton variant="icon" onClick={() => fileInputRef.current?.click()} title="添加更多">
                  <Plus size={20} />
                </HandDrawnButton>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" multiple />
                
                {queue.some(q => q.status === QUEUE_STATUS.COMPLETED) && (
                  <HandDrawnButton variant="primary" onClick={downloadAll} icon={Download}>
                    下载全部 ({queue.filter(q => q.status === QUEUE_STATUS.COMPLETED).length})
                  </HandDrawnButton>
                )}
              </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {queue.map(item => (
                <PhotoCard 
                  key={item.id} 
                  item={item} 
                  onClick={startProcessing} 
                  onDelete={removeItem} 
                />
              ))}
              
              {/* Add Card Placeholder */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-[3px] border-dashed border-[#2d2d2d]/30 min-h-[200px] flex flex-col items-center justify-center cursor-pointer hover:bg-white/50 transition-colors rounded-[20px]"
              >
                <Plus size={32} className="text-[#2d2d2d]/30" />
                <span className="marker-font text-[#2d2d2d]/40 mt-2">添加</span>
              </div>
            </div>
          </div>
        )}

        {/* ===== PROCESSING MODE ===== */}
        {mode === APP_MODES.PROCESSING && (
          <div className="w-full flex flex-col items-center justify-center min-h-[450px] animate-fade-in relative">
            {/* 背景香蕉雨 */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className="absolute text-3xl animate-banana-fall"
                  style={{
                    left: `${10 + (i * 7)}%`,
                    animationDelay: `${i * 0.3}s`,
                    animationDuration: `${2.5 + Math.random()}s`,
                    opacity: 0.2 + Math.random() * 0.2
                  }}
                >
                  🍌
                </div>
              ))}
            </div>
            
            {/* 中心动画 */}
            <div className="relative mb-8">
              {/* 环绕的小香蕉 */}
              <div className="absolute inset-0 w-40 h-40 -m-8">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute text-2xl"
                    style={{
                      top: '50%',
                      left: '50%',
                      transform: `rotate(${i * 60}deg) translateY(-60px)`,
                      animation: `spin 4s linear infinite`,
                      animationDelay: `${i * 0.1}s`
                    }}
                  >
                    🍌
                  </div>
                ))}
              </div>
              
              {/* 主香蕉 */}
              <div className="text-[100px] animate-banana-bounce-rotate relative z-10">🍌</div>
              
              {/* 魔法星星 */}
              <div className="absolute -top-4 -right-4 text-3xl animate-twinkle">✨</div>
              <div className="absolute -bottom-2 -left-4 text-2xl animate-twinkle" style={{ animationDelay: '0.3s' }}>⭐</div>
              <div className="absolute top-1/2 -right-8 text-xl animate-twinkle" style={{ animationDelay: '0.6s' }}>💫</div>
            </div>
            
            {/* 进度指示 */}
            <div className="relative w-48 h-3 bg-[#e5e0d8] rounded-full overflow-hidden border-2 border-[#2d2d2d] mb-6">
              <div className="absolute inset-0 bg-gradient-to-r from-[#fff9c4] via-[#ff4d4d] to-[#fff9c4] animate-shimmer" />
            </div>
            
            <p className="marker-font text-3xl mb-2">🍌 香蕉魔法施展中...</p>
            <p className="hand-font text-gray-500">正在使用 Reverse Alpha Blending 算法</p>
            
            {/* 底部香蕉装饰 */}
            <div className="flex gap-2 mt-8">
              {[...Array(5)].map((_, i) => (
                <span 
                  key={i} 
                  className="text-3xl animate-bounce"
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  🍌
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ===== EDIT MODE ===== */}
        {mode === APP_MODES.EDIT && (
          <div className="w-full flex flex-col items-center animate-slide-up">
            {/* Top Bar */}
            <div className="w-full flex justify-between items-center mb-4">
              <button onClick={saveAndBack} className="flex items-center gap-2 hand-font text-lg hover:underline hover:text-[#2d5da1] transition-colors">
                <Grid size={18} /> 返回列表
              </button>
              <div className="flex items-center gap-2">
                <span className="text-2xl">🎨</span>
                <span className="marker-font text-xl text-gray-600">
                  手动标记: {activeItem?.name}
                </span>
              </div>
              <div className="w-20" />
            </div>

            {/* 操作提示 */}
            <div className="mb-4 px-4 py-2 bg-[#fff9c4] border-2 border-[#ffc107] rounded-full flex items-center gap-2">
              <span className="text-xl">💡</span>
              <span className="hand-font text-[#f57c00]">用红色画笔标记水印区域，然后点击"开始消除"</span>
            </div>

            {/* Canvas Container */}
            <div className="relative">
              {/* Toolbar */}
              <div className="absolute top-4 left-4 z-20 flex flex-col gap-3">
                <div className="bg-white p-2.5 rounded-lg border-2 border-[#2d2d2d] shadow-[3px_3px_0px_0px_#2d2d2d] hover:shadow-[1px_1px_0px_0px_#2d2d2d] hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer" onClick={handleUndo} title="撤销">
                  <Undo size={22} className="hover:text-[#2d5da1] transition-colors" />
                </div>
                <div className="bg-white p-3 rounded-lg border-2 border-[#2d2d2d] shadow-[3px_3px_0px_0px_#2d2d2d] flex flex-col items-center gap-2">
                  <span className="text-xs marker-font text-gray-500">画笔</span>
                  <div className="w-4 h-4 bg-[#ff4d4d] rounded-full border-2 border-[#2d2d2d]" style={{ transform: `scale(${brushSize / 30})` }} />
                  <input 
                    type="range" 
                    min="5" max="50" 
                    value={brushSize} 
                    onChange={(e) => setBrushSize(parseInt(e.target.value))}
                    className="h-20 w-2 bg-[#e5e0d8] rounded-lg appearance-none cursor-pointer border border-[#2d2d2d]"
                    style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
                  />
                  <span className="text-xs hand-font text-gray-400">{brushSize}px</span>
                </div>
              </div>

              <div className="relative bg-white border-[3px] border-[#2d2d2d] shadow-[8px_8px_0px_0px_#2d2d2d] overflow-hidden cursor-crosshair touch-none select-none rounded-md">
                {isProcessing && (
                  <div className="absolute inset-0 z-50 bg-white/95 flex flex-col items-center justify-center">
                    <div className="text-6xl animate-bounce-slow mb-4">🍌</div>
                    <div className="w-12 h-12 border-4 border-[#2d2d2d] border-t-[#ff4d4d] rounded-full animate-spin mb-4" />
                    <p className="marker-font text-xl animate-pulse">魔法消除中...</p>
                  </div>
                )}

                <canvas
                  ref={canvasRef}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="max-w-full md:max-h-[55vh] block"
                />
                
                {/* 画布标签 */}
                <div className="absolute top-4 right-4 bg-[#ff4d4d]/90 text-white px-3 py-1 rounded-full text-sm marker-font shadow-md">
                  🖌️ 标记模式
                </div>
              </div>
            </div>

            {/* Bottom Controls */}
            <div className="flex gap-4 mt-8 items-center">
              <HandDrawnButton onClick={handleManualRemove} variant="primary" icon={Eraser} disabled={isProcessing}>
                开始消除
              </HandDrawnButton>
            </div>
          </div>
        )}

        {/* ===== RESULT MODE ===== */}
        {mode === APP_MODES.RESULT && (
          <div className="w-full flex flex-col items-center animate-slide-up">
            {/* Top Bar */}
            <div className="w-full flex justify-between items-center mb-4">
              <button onClick={saveAndBack} className="flex items-center gap-2 hand-font text-lg hover:underline hover:text-[#2d5da1] transition-colors">
                <Grid size={18} /> 返回列表
              </button>
              <div className="flex items-center gap-2">
                <span className="text-2xl">✅</span>
                <span className="marker-font text-xl text-gray-600">
                  处理完成: {activeItem?.name}
                </span>
              </div>
              <div className="w-20" />
            </div>

            {/* 成功提示 */}
            <div className="mb-4 px-4 py-2 bg-[#e8f5e9] border-2 border-[#4caf50] rounded-full flex items-center gap-2">
              <span className="text-xl">🎉</span>
              <span className="marker-font text-[#2e7d32]">水印已成功去除！</span>
            </div>

            {/* Result Image */}
            <div 
              className="relative bg-white border-[3px] border-[#2d2d2d] shadow-[8px_8px_0px_0px_#2d2d2d] overflow-hidden rounded-md cursor-pointer"
              onMouseEnter={() => {
                const img = document.getElementById('result-image');
                if (img && activeItem?.originalSrc) img.src = activeItem.originalSrc;
              }}
              onMouseLeave={() => {
                const img = document.getElementById('result-image');
                if (img && processedSrc) img.src = processedSrc;
              }}
            >
              <div className="relative">
                <img 
                  id="result-image"
                  src={processedSrc} 
                  alt="Processed" 
                  className="max-w-full md:max-h-[55vh] object-contain"
                />
                
                {/* 处理后标签 */}
                <div className="absolute top-4 left-4 bg-[#4caf50] text-white px-3 py-1 rounded-full text-sm marker-font shadow-md">
                  ✨ 已处理
                </div>
              </div>
            </div>

            {/* 对比原图提示 - 移到图片外面 */}
            <div className="mt-4 px-4 py-2 bg-[#fff9c4] border-2 border-[#ffc107] rounded-full flex items-center gap-2">
              <span className="text-xl">👆</span>
              <span className="hand-font text-[#f57c00]">鼠标悬停在图片上可对比原图</span>
            </div>

            {/* Bottom Controls */}
            <div className="flex gap-4 mt-8 items-center flex-wrap justify-center">
              <HandDrawnButton onClick={downloadSingle} variant="secondary" icon={Download}>
                下载此图
              </HandDrawnButton>
              <HandDrawnButton onClick={saveAndBack} variant="primary" icon={Check}>
                完成并返回
              </HandDrawnButton>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full max-w-6xl mx-auto px-6 py-8 mt-12 border-t-2 border-dashed border-[#2d2d2d]/20">
        <div className="flex flex-col items-center gap-4">
          {/* 香蕉装饰 */}
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <span 
                key={i} 
                className="text-xl opacity-60 animate-banana-swing"
                style={{ animationDelay: `${i * 0.15}s` }}
              >
                🍌
              </span>
            ))}
          </div>
          
          <div className="flex items-center gap-2 text-gray-600 marker-font">
            <span className="text-2xl">🍌</span>
            <span className="text-lg">Nano Banana Watermark Remover</span>
          </div>
          
          <div className="flex flex-wrap justify-center items-center gap-3 text-sm hand-font text-gray-400">
            <span className="flex items-center gap-1">
              <span>✨</span> Reverse Alpha Blending
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <span>🔒</span> 本地处理
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <span>💚</span> 隐私安全
            </span>
          </div>
          
          <p className="text-xs text-gray-300 hand-font">Made with 🍌 and ❤️</p>
        </div>
      </footer>
    </div>
  );
}
