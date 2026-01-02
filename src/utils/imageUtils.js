/**
 * 图片处理工具函数
 */

/**
 * 加载图片并返回 Promise
 * @param {string} src - 图片路径或 URL
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

/**
 * 从 File 对象加载图片
 * @param {File} file - 图片文件
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image from file'));
    };
    img.src = url;
  });
}

/**
 * 将 Canvas 转换为 Blob
 * @param {HTMLCanvasElement} canvas 
 * @param {string} type - MIME 类型
 * @returns {Promise<Blob>}
 */
export function canvasToBlob(canvas, type = 'image/png') {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type);
  });
}

/**
 * 下载文件
 * @param {Blob|string} data - Blob 或 dataURL
 * @param {string} filename - 文件名
 */
export function downloadFile(data, filename) {
  const url = data instanceof Blob ? URL.createObjectURL(data) : data;
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  if (data instanceof Blob) {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
