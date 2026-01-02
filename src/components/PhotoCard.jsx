import React, { useState } from 'react';
import { X, Check, AlertTriangle, Sparkles } from 'lucide-react';
import { getWobblyRadius, QUEUE_STATUS } from '../constants';

/**
 * 照片卡片组件 - Polaroid 风格
 */
const PhotoCard = ({ item, onClick, onDelete }) => {
  const [radius] = useState(getWobblyRadius());
  const [isHovered, setIsHovered] = useState(false);
  
  const getStatusBadge = () => {
    if (item.status === QUEUE_STATUS.COMPLETED) {
      if (item.noWatermark) {
        return { text: '无水印', bg: 'bg-orange-100 border-orange-300', icon: AlertTriangle, color: 'text-orange-500' };
      }
      return { text: '已完成', bg: 'bg-[#e8f5e9] border-green-300', icon: Check, color: 'text-green-600' };
    }
    return { text: '待处理', bg: 'bg-gray-100 border-gray-300', icon: Sparkles, color: 'text-gray-500' };
  };
  
  const badge = getStatusBadge();
  
  return (
    <div 
      className="relative group cursor-pointer"
      onClick={() => onClick(item.id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        transform: isHovered ? 'scale(1.05) rotate(-1deg)' : 'scale(1) rotate(0deg)',
        transition: 'all 0.2s ease-out'
      }}
    >
      {/* 卡片主体 */}
      <div 
        className={`bg-white p-3 pb-6 border-[3px] border-[#2d2d2d] flex flex-col items-center gap-2 transition-shadow duration-200 ${
          isHovered ? 'shadow-[6px_6px_0px_0px_#2d2d2d]' : 'shadow-[4px_4px_0px_0px_#2d2d2d]'
        }`}
        style={{ borderRadius: radius }}
      >
        {/* 缩略图容器 */}
        <div className="w-full aspect-square overflow-hidden bg-gray-100 border-2 border-[#2d2d2d] relative rounded-sm">
          <img 
            src={item.processedSrc || item.originalSrc} 
            alt="Thumbnail" 
            className={`w-full h-full object-cover transition-transform duration-300 ${isHovered ? 'scale-110' : 'scale-100'}`}
          />
          
          {/* 完成状态覆盖层 */}
          {item.status === QUEUE_STATUS.COMPLETED && !item.noWatermark && (
            <div className="absolute inset-0 bg-[#2d5da1]/20 flex items-center justify-center backdrop-blur-[1px]">
              <div className="bg-white p-2 rounded-full border-2 border-[#2d2d2d] shadow-sm transform rotate-12">
                <Check className="text-[#2d5da1]" size={24} strokeWidth={4} />
              </div>
            </div>
          )}
          
          {/* 无水印状态覆盖层 */}
          {item.status === QUEUE_STATUS.COMPLETED && item.noWatermark && (
            <div className="absolute inset-0 bg-orange-500/10 flex items-center justify-center backdrop-blur-[1px]">
              <div className="bg-white p-2 rounded-full border-2 border-orange-400 shadow-sm transform -rotate-6">
                <AlertTriangle className="text-orange-500" size={24} strokeWidth={3} />
              </div>
            </div>
          )}
          
          {/* 待处理悬停效果 */}
          {item.status === QUEUE_STATUS.PENDING && isHovered && (
            <div className="absolute inset-0 bg-[#ff4d4d]/10 flex items-center justify-center">
              <div className="bg-white px-3 py-1.5 rounded-full border-2 border-[#2d2d2d] shadow-md">
                <span className="marker-font text-sm">点击处理 →</span>
              </div>
            </div>
          )}
        </div>
        
        {/* 文件名和状态 */}
        <div className="w-full flex justify-between items-center px-1 gap-2">
          <span className="hand-font text-sm truncate flex-1 text-gray-600" title={item.name}>
            {item.name}
          </span>
          <span className={`
            marker-font text-xs px-2 py-0.5 border rounded-full whitespace-nowrap flex items-center gap-1
            ${badge.bg}
          `}>
            {badge.icon && <badge.icon size={12} className={badge.color} />}
            <span className={badge.color}>{badge.text}</span>
          </span>
        </div>
      </div>

      {/* 删除按钮 (Hover 显示) */}
      <button 
        onClick={(e) => { 
          e.stopPropagation(); 
          onDelete(item.id); 
        }}
        className="
          absolute -top-2 -right-2 
          bg-[#ff4d4d] text-white p-1.5 
          border-2 border-[#2d2d2d] rounded-full 
          shadow-[2px_2px_0px_0px_#2d2d2d]
          opacity-0 group-hover:opacity-100 
          transition-all duration-200
          hover:scale-110 hover:shadow-[1px_1px_0px_0px_#2d2d2d]
          hover:translate-x-[1px] hover:translate-y-[1px]
          z-10
        "
      >
        <X size={14} strokeWidth={3} />
      </button>

      {/* 胶带装饰 */}
      <div className={`absolute -top-3 left-1/2 -translate-x-1/2 w-14 h-5 bg-[#fff9c4]/80 transform -rotate-2 z-0 border border-[#2d2d2d]/20 transition-all duration-200 ${
        isHovered ? 'w-16 -rotate-3' : ''
      }`} />
    </div>
  );
};

export default PhotoCard;
