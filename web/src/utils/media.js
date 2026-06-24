/**
 * 媒体地址解析工具
 *
 * - 服务端文件: resolveImageUrl 直接返回 /api/media/:filename 地址
 * - 旧 IndexedDB 文件: 通过 blob URL 继续支持（向后兼容）
 * - 上传新文件后: 无需刷新，服务端 URL 直接可用
 */

import { reactive } from 'vue';

const state = reactive({
  urls: Object.create(null),
});

/**
 * 解析图片地址
 * 支持: /api/media/xxx.jpg | media_xxx (服务端 ID) | m_xxx (旧IndexedDB) | data: | http(s)://
 *
 * 注意：服务端返回的 id 是 "media_xxx"，但实际文件名是 "xxx.jpg"。
 * 因此引用应存储 filename 而非 id。此处 media_ 前缀分支仅作向后兼容。
 */
export function resolveImageUrl(ref) {
  if (!ref) return '';
  if (ref.startsWith('data:')) return ref;
  if (/^https?:\/\//i.test(ref)) return ref;
  if (ref.startsWith('/api/media/')) return ref;
  // 旧 IndexedDB ID: m_xxx
  if (ref.startsWith('m_')) return state.urls[ref] || '';
  // 纯文件名（含扩展名）：直接拼接为 URL
  if (ref.includes('.')) return `/api/media/${ref}`;
  // 其他情况原样返回
  return ref;
}
