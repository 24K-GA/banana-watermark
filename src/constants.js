/**
 * 全局颜色常量
 */
export const COLORS = {
  bg: '#fdfbf7',
  text: '#2d2d2d',
  accent: '#ff4d4d',
  accentHover: '#ff3333',
  secondary: '#2d5da1',
  muted: '#e5e0d8',
  white: '#ffffff',
  yellow: '#fff9c4',
};

/**
 * Mask 配置
 * size: mask 尺寸 (用于 Map 的 key)
 * path: mask 图片路径
 * margin: 水印距离右下角的边距
 * 
 * 注意：
 * - mask 图片必须是黑底白字（白色区域为水印）
 * - margin 值需要根据实际水印位置调整
 * - 如果效果不好，可以尝试调整 margin 值
 */
export const MASK_CONFIGS = [
  { size: 96, path: '/assets/mask_96.png', margin: 64 },
  { size: 48, path: '/assets/mask_48.png', margin: 32 }
];

/**
 * 生成不规则边框半径
 * 用于创建手绘风格的边框效果
 */
export const getWobblyRadius = () => {
  return `${Math.random() > 0.5 ? 255 : 225}px 15px 225px 15px / 15px 225px 15px 255px`;
};

/**
 * 应用模式
 */
export const APP_MODES = {
  UPLOAD: 'upload',
  GALLERY: 'gallery',
  PROCESSING: 'processing',
  EDIT: 'edit',
  RESULT: 'result',
};

/**
 * 队列项状态
 */
export const QUEUE_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
};
