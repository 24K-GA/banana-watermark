/**
 * Mask 处理工具函数
 * 用于水印检测和 Reverse Alpha Blending
 */

import { loadImage } from './imageUtils';
import { MASK_CONFIGS } from '../constants';

/**
 * 调试模式开关 - 设为 true 可在控制台看到详细日志
 */
const DEBUG = true;

/**
 * Alpha 强度调整系数
 * 如果水印去除不干净，可以增大这个值（如 1.2）
 * 如果去除后有明显痕迹，可以减小这个值（如 0.8）
 */
export const ALPHA_INTENSITY = 1.0;

/**
 * 预处理 Mask：从 RGB 亮度提取 alpha 值
 * 输入：黑底白字的 mask 图片
 * 输出：RGB 为白色 (255,255,255)，alpha 为亮度值
 * 
 * @param {ImageData} imageData - 原始 mask ImageData
 * @returns {ImageData} 处理后的 ImageData
 */
export function preprocessMask(imageData) {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  
  const processed = new ImageData(width, height);
  const output = processed.data;
  
  let maxLuminance = 0;
  let minLuminance = 255;
  let nonZeroCount = 0;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // 计算亮度作为 alpha (使用 luminance 公式)
    // 白色 (255,255,255) → alpha = 255
    // 黑色 (0,0,0) → alpha = 0
    const luminance = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    
    // 统计调试信息
    if (luminance > maxLuminance) maxLuminance = luminance;
    if (luminance < minLuminance) minLuminance = luminance;
    if (luminance > 10) nonZeroCount++;
    
    // 设置 RGB 为白色（水印颜色），alpha 为亮度
    output[i] = 255;     // R
    output[i + 1] = 255; // G
    output[i + 2] = 255; // B
    output[i + 3] = luminance; // Alpha
  }
  
  if (DEBUG) {
    console.log(`📊 Mask 预处理统计:`, {
      尺寸: `${width}x${height}`,
      最大亮度: maxLuminance,
      最小亮度: minLuminance,
      非零像素数: nonZeroCount,
      总像素数: width * height,
      有效覆盖率: `${((nonZeroCount / (width * height)) * 100).toFixed(2)}%`
    });
  }
  
  return processed;
}

/**
 * 加载所有 Mask 图片并预处理
 * @returns {Promise<Map<number, MaskData>>}
 */
export async function loadMasks() {
  const masks = new Map();
  
  for (const config of MASK_CONFIGS) {
    try {
      const image = await loadImage(config.path);
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      
      const rawImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      if (DEBUG) {
        // 检查原始 mask 的颜色分布
        const data = rawImageData.data;
        let blackCount = 0, whiteCount = 0, otherCount = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          const brightness = (r + g + b) / 3;
          if (brightness < 30) blackCount++;
          else if (brightness > 225) whiteCount++;
          else otherCount++;
        }
        console.log(`🎨 Mask ${config.size}px 原始颜色分布:`, {
          黑色像素: blackCount,
          白色像素: whiteCount,
          其他像素: otherCount,
          实际尺寸: `${image.width}x${image.height}`,
          配置尺寸: config.size,
          边距: config.margin
        });
      }
      
      const processedData = preprocessMask(rawImageData);
      
      masks.set(config.size, {
        image,
        canvas,
        ctx,
        imageData: processedData,
        width: image.width,
        height: image.height,
        margin: config.margin
      });
      
      console.log(`✓ Loaded mask: ${config.size}x${config.size} (actual: ${image.width}x${image.height}, margin: ${config.margin}px)`);
    } catch (error) {
      console.error(`✗ Failed to load mask: ${config.path}`, error);
    }
  }
  
  return masks;
}

/**
 * 根据图片尺寸选择合适的 mask
 * 当图片长宽都大于 1024 时，使用 96px mask
 * 否则使用 48px mask
 * 
 * @param {number} width - 图片宽度
 * @param {number} height - 图片高度
 * @param {Map} masks - mask Map
 * @returns {Object|null} mask 对象
 */
export function selectMask(width, height, masks) {
  let selectedSize;
  
  if (width > 1024 && height > 1024) {
    selectedSize = 96;
  } else {
    selectedSize = 48;
  }
  
  const mask = masks.get(selectedSize);
  
  if (DEBUG) {
    console.log(`🔍 Mask 选择:`, {
      图片尺寸: `${width}x${height}`,
      选择的Mask: `${selectedSize}px`,
      Mask是否存在: !!mask,
      Mask实际尺寸: mask ? `${mask.width}x${mask.height}` : 'N/A',
      Mask边距: mask ? mask.margin : 'N/A'
    });
  }
  
  return mask;
}

/**
 * 检测图片是否含有水印
 * 原理：水印是白色半透明叠加，会使原图在水印区域变亮
 * 
 * @param {ImageData} imageData - 图片 ImageData
 * @param {Object} mask - mask 对象
 * @param {number} imgWidth - 图片宽度
 * @param {number} imgHeight - 图片高度
 * @returns {boolean} 是否有水印
 */
export function detectWatermark(imageData, mask, imgWidth, imgHeight) {
  const imgPixels = imageData.data;
  const maskPixels = mask.imageData.data;
  const maskWidth = mask.width;
  const maskHeight = mask.height;
  const margin = mask.margin;
  
  // 计算 mask 在图片右下角的位置
  const offsetX = imgWidth - maskWidth - margin;
  const offsetY = imgHeight - maskHeight - margin;
  
  if (DEBUG) {
    console.log(`📍 水印检测位置:`, {
      图片尺寸: `${imgWidth}x${imgHeight}`,
      Mask尺寸: `${maskWidth}x${maskHeight}`,
      边距: margin,
      偏移X: offsetX,
      偏移Y: offsetY,
      水印区域: `(${offsetX}, ${offsetY}) - (${offsetX + maskWidth}, ${offsetY + maskHeight})`
    });
  }
  
  // 确保位置有效
  if (offsetX < 0 || offsetY < 0) {
    console.warn('⚠️ 水印位置超出图片范围');
    return false;
  }
  
  let watermarkBrightness = 0;
  let watermarkPixelCount = 0;
  let surroundingBrightness = 0;
  let surroundingPixelCount = 0;
  
  // 计算水印区域的亮度 (只计算 mask alpha > 0.1 的区域)
  for (let my = 0; my < maskHeight; my++) {
    for (let mx = 0; mx < maskWidth; mx++) {
      const imgX = offsetX + mx;
      const imgY = offsetY + my;
      
      if (imgX < 0 || imgY < 0 || imgX >= imgWidth || imgY >= imgHeight) continue;
      
      const imgIdx = (imgY * imgWidth + imgX) * 4;
      const maskIdx = (my * maskWidth + mx) * 4;
      
      const alpha = maskPixels[maskIdx + 3] / 255;
      
      if (alpha > 0.1) {
        const r = imgPixels[imgIdx];
        const g = imgPixels[imgIdx + 1];
        const b = imgPixels[imgIdx + 2];
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
        
        watermarkBrightness += brightness * alpha;
        watermarkPixelCount += alpha;
      }
    }
  }
  
  // 计算周围参考区域亮度
  const sampleSize = Math.min(maskWidth, maskHeight);
  
  // 左侧参考区域
  for (let y = offsetY; y < offsetY + maskHeight && y < imgHeight; y++) {
    for (let x = Math.max(0, offsetX - sampleSize); x < offsetX && x >= 0; x++) {
      const imgIdx = (y * imgWidth + x) * 4;
      const brightness = 0.299 * imgPixels[imgIdx] + 
                        0.587 * imgPixels[imgIdx + 1] + 
                        0.114 * imgPixels[imgIdx + 2];
      surroundingBrightness += brightness;
      surroundingPixelCount++;
    }
  }
  
  // 上方参考区域
  for (let y = Math.max(0, offsetY - sampleSize); y < offsetY && y >= 0; y++) {
    for (let x = offsetX; x < offsetX + maskWidth && x < imgWidth; x++) {
      const imgIdx = (y * imgWidth + x) * 4;
      const brightness = 0.299 * imgPixels[imgIdx] + 
                        0.587 * imgPixels[imgIdx + 1] + 
                        0.114 * imgPixels[imgIdx + 2];
      surroundingBrightness += brightness;
      surroundingPixelCount++;
    }
  }
  
  const avgWatermarkBrightness = watermarkPixelCount > 0 
    ? watermarkBrightness / watermarkPixelCount 
    : 0;
  const avgSurroundingBrightness = surroundingPixelCount > 0 
    ? surroundingBrightness / surroundingPixelCount 
    : 128;
  
  const brightnessDiff = avgWatermarkBrightness - avgSurroundingBrightness;
  const threshold = 10;
  
  console.log(`🔍 Watermark detection:`, {
    水印区域亮度: avgWatermarkBrightness.toFixed(1),
    周围区域亮度: avgSurroundingBrightness.toFixed(1),
    亮度差: brightnessDiff.toFixed(1),
    阈值: threshold,
    检测结果: brightnessDiff > threshold ? '✅ 检测到水印' : '❌ 未检测到水印'
  });
  
  return brightnessDiff > threshold;
}

/**
 * 执行 Reverse Alpha Blending
 * 公式：Original = (Composite - Watermark × α) / (1 - α)
 * 
 * @param {ImageData} imageData - 原图 ImageData
 * @param {Object} mask - mask 对象
 * @param {number} imgWidth - 图片宽度
 * @param {number} imgHeight - 图片高度
 * @param {number} alphaIntensity - Alpha 强度调整系数 (默认 1.0)
 */
export function reverseAlphaBlend(imageData, mask, imgWidth, imgHeight, alphaIntensity = ALPHA_INTENSITY) {
  const imgPixels = imageData.data;
  const maskPixels = mask.imageData.data;
  const maskWidth = mask.width;
  const maskHeight = mask.height;
  const margin = mask.margin;
  
  const offsetX = imgWidth - maskWidth - margin;
  const offsetY = imgHeight - maskHeight - margin;
  
  let processedPixels = 0;
  let skippedLowAlpha = 0;
  let skippedFullAlpha = 0;
  
  if (DEBUG) {
    console.log(`🔧 开始 Reverse Alpha Blending:`, {
      处理区域: `(${offsetX}, ${offsetY}) - (${offsetX + maskWidth}, ${offsetY + maskHeight})`,
      Alpha强度系数: alphaIntensity
    });
  }
  
  for (let my = 0; my < maskHeight; my++) {
    for (let mx = 0; mx < maskWidth; mx++) {
      const imgX = offsetX + mx;
      const imgY = offsetY + my;
      
      if (imgX < 0 || imgY < 0 || imgX >= imgWidth || imgY >= imgHeight) continue;
      
      const imgIdx = (imgY * imgWidth + imgX) * 4;
      const maskIdx = (my * maskWidth + mx) * 4;
      
      // 应用 alpha 强度调整
      let alpha = (maskPixels[maskIdx + 3] / 255) * alphaIntensity;
      alpha = Math.min(alpha, 0.99); // 限制最大值防止除零
      
      // 跳过非水印区域
      if (alpha < 0.01) {
        skippedLowAlpha++;
        continue;
      }
      
      const invAlpha = 1 - alpha;
      
      // 完全被水印覆盖，无法还原
      if (invAlpha < 0.01) {
        skippedFullAlpha++;
        continue;
      }
      
      const wmR = maskPixels[maskIdx];
      const wmG = maskPixels[maskIdx + 1];
      const wmB = maskPixels[maskIdx + 2];
      
      const compR = imgPixels[imgIdx];
      const compG = imgPixels[imgIdx + 1];
      const compB = imgPixels[imgIdx + 2];
      
      // Reverse Alpha Blending
      let origR = (compR - wmR * alpha) / invAlpha;
      let origG = (compG - wmG * alpha) / invAlpha;
      let origB = (compB - wmB * alpha) / invAlpha;
      
      // 限制在 0-255 范围内
      imgPixels[imgIdx] = Math.max(0, Math.min(255, Math.round(origR)));
      imgPixels[imgIdx + 1] = Math.max(0, Math.min(255, Math.round(origG)));
      imgPixels[imgIdx + 2] = Math.max(0, Math.min(255, Math.round(origB)));
      
      processedPixels++;
    }
  }
  
  console.log(`✅ Reverse Alpha Blending 完成:`, {
    处理像素数: processedPixels,
    跳过低Alpha: skippedLowAlpha,
    跳过全覆盖: skippedFullAlpha,
    总Mask像素: maskWidth * maskHeight
  });
}
