import React, { useState } from 'react';
import { getWobblyRadius } from '../constants';

/**
 * 手绘风格按钮组件
 */
const HandDrawnButton = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className = '', 
  icon: Icon, 
  disabled = false, 
  title 
}) => {
  const [radius] = useState(getWobblyRadius());
  const [isPressed, setIsPressed] = useState(false);
  
  const baseStyles = `
    relative flex items-center justify-center gap-2 
    px-5 py-2.5 marker-font text-lg 
    transition-all duration-150 
    border-[3px] border-[#2d2d2d] 
    disabled:opacity-50 disabled:cursor-not-allowed 
    disabled:active:shadow-[4px_4px_0px_0px_#2d2d2d] 
    disabled:active:translate-x-0 disabled:active:translate-y-0
    select-none
  `;
  
  const variants = {
    primary: `
      bg-white text-[#2d2d2d] 
      hover:bg-[#ff4d4d] hover:text-white 
      shadow-[4px_4px_0px_0px_#2d2d2d] 
      hover:shadow-[2px_2px_0px_0px_#2d2d2d] 
      hover:-rotate-1
      active:shadow-none active:translate-x-[4px] active:translate-y-[4px]
    `,
    secondary: `
      bg-[#f5f5f5] text-[#2d2d2d] 
      hover:bg-[#e3f2fd] hover:border-[#2d5da1]
      shadow-[4px_4px_0px_0px_#2d2d2d] 
      hover:shadow-[2px_2px_0px_0px_#2d2d2d] 
      hover:rotate-1
      active:shadow-none active:translate-x-[4px] active:translate-y-[4px]
    `,
    icon: `
      p-2.5 bg-white 
      hover:bg-[#fff9c4] 
      shadow-[3px_3px_0px_0px_#2d2d2d] 
      hover:shadow-[1px_1px_0px_0px_#2d2d2d]
      hover:rotate-6
      active:shadow-none active:translate-x-[3px] active:translate-y-[3px]
    `,
    danger: `
      bg-white text-[#2d2d2d] 
      hover:bg-[#ffebee] hover:text-[#c62828] hover:border-[#c62828]
      shadow-[4px_4px_0px_0px_#2d2d2d] 
      hover:shadow-[2px_2px_0px_0px_#c62828]
      active:shadow-none active:translate-x-[4px] active:translate-y-[4px]
    `
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      className={`${baseStyles} ${variants[variant]} ${className}`}
      style={{ 
        borderRadius: radius,
        transform: isPressed && !disabled ? 'translateX(4px) translateY(4px)' : undefined,
        boxShadow: isPressed && !disabled ? 'none' : undefined
      }}
    >
      {Icon && <Icon size={20} strokeWidth={2.5} />}
      {children}
    </button>
  );
};

export default HandDrawnButton;
