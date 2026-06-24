/**
 * 媒体管理 API（服务端文件上传，替代浏览器 IndexedDB）
 * 
 * 所有文件上传到 server/uploads/，通过 /api/media/:filename 公开访问。
 * 调用方（ImagePicker、AdminMedia 等）API 签名不变，底层从 IndexedDB 切到服务端。
 */

const BASE = '/api/admin';
import { authHeader } from './_common.js';

/**
 * 上传图片：>1.5MB 自动压缩，POST multipart/form-data
 * @param {File} file
 * @returns {Promise<{id, filename, url, size}>}
 */
export async function uploadImage(file) {
  if (!file) throw new Error('没有选中文件');
  if (!file.type || !file.type.startsWith('image/')) throw new Error('只支持图片文件');

  let blob = file;
  // >1.5MB 自动压缩
  if (file.size > 1.5 * 1024 * 1024) {
    try { blob = await compressImage(file); } catch { /* 压缩失败用原图 */ }
  }

  const formData = new FormData();
  formData.append('file', blob instanceof Blob ? blob : new Blob([blob], { type: file.type }), file.name);

  const r = await fetch(`${BASE}/media/upload`, {
    method: 'POST',
    headers: authHeader(),
    body: formData,
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message || `上传失败 (${r.status})`);
  }
  const { data } = await r.json();
  return data;
}

/** 删除文件 */
export async function deleteFile(id) {
  if (!id) return;
  const r = await fetch(`${BASE}/media/${id}`, { method: 'DELETE', headers: authHeader() });
  if (!r.ok) throw new Error(`删除失败 (${r.status})`);
}

/** 兼容旧接口：返回完整文件记录列表（不再只返回 id） */
export async function listAllFileIds() {
  const r = await fetch(`${BASE}/media`, { headers: authHeader() });
  if (!r.ok) throw new Error(`获取列表失败 (${r.status})`);
  const files = await r.json();
  return Array.isArray(files) ? files : (files.data || []);
}

/**
 * 图片压缩
 */
export function compressImage(file, maxSide = 1280, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        let { width, height } = img;
        if (width > maxSide || height > maxSide) {
          const k = Math.min(maxSide / width, maxSide / height);
          width = Math.round(width * k);
          height = Math.round(height * k);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url);
          blob ? resolve(blob) : reject(new Error('压缩失败'));
        }, 'image/jpeg', quality);
      } catch (e) { URL.revokeObjectURL(url); reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片加载失败')); };
    img.src = url;
  });
}
