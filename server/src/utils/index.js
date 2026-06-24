/**
 * 工具函数统一出口
 * 通过 index.js 聚合 id / response / validation，保持向后兼容：
 *   const { genId, ok, fail, createLogger } = require('../utils');
 */

const { genId, genOrderNo } = require('./id');
const { row, rows, nowISO, nowISOPlus, ok, fail, paginate } = require('./response');
const { createLogger } = require('./validation');

module.exports = {
  genId,
  genOrderNo,
  row,
  rows,
  nowISO,
  nowISOPlus,
  ok,
  fail,
  paginate,
  createLogger,
};
