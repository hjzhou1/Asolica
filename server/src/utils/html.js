/**
 * HTML 工具函数
 */

/**
 * HTML 转义，防止邮件 XSS
 * @param {string} s
 * @returns {string}
 */
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

module.exports = { escapeHtml };
