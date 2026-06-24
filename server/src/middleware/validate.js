/**
 * 请求参数验证中间件
 * 使用 zod 对所有 POST/PUT 端点做输入校验，非法输入返回 400 + 详细错误
 */
const { z } = require('zod');

// ========== 通用 Schema ==========

const idSchema = z.string().min(1, 'ID不能为空').max(64);
const trimStr = z.string().trim();
const optionalStr = z.string().optional().default('');

// ========== Admin 登录 / 改密 ==========

// 密码复杂度：至少 8 位，必须包含字母和数字
const PASSWORD_REGEX = /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/;

const loginSchema = z.object({
  username: trimStr.min(1, '请输入账号'),
  // 登录时不做复杂度校验（用户可能用旧密码），仅非空检查
  password: z.string().min(1, '请输入密码'),
});

const changePasswordSchema = z.object({
  oldPwd: z.string().min(1, '请输入当前密码'),
  newPwd: z.string().regex(PASSWORD_REGEX, '密码至少8位，必须包含字母和数字'),
});

// ========== 分类 ==========

const createCategorySchema = z.object({
  name: trimStr.min(1, '分类名称不能为空').max(100, '名称最多100字'),
  sort: z.coerce.number().int().min(0).default(0),
  enabled: z.union([z.boolean(), z.coerce.number()]).default(true),
  desc: z.string().max(500, '描述最多500字').default(''),
  image: z.string().max(500).default(''),
});

const updateCategorySchema = z.object({
  name: trimStr.min(1).max(100).optional(),
  sort: z.coerce.number().int().min(0).optional(),
  enabled: z.union([z.boolean(), z.coerce.number()]).optional(),
  desc: z.string().max(500).optional(),
  image: z.string().max(500).optional(),
}).refine(d => Object.keys(d).length > 0, { message: '至少提供一个要更新的字段' });

// ========== 商品 ==========

const cardSpecSchema = z.object({
  id: z.string().optional(),
  name: trimStr.min(1, '规格名不能为空').max(50),
  durationSeconds: z.coerce.number().int().min(0).default(0),
  price: z.coerce.number().min(0, '价格不能为负'),
  status: z.enum(['on', 'off']).default('on'),
});

const createProductSchema = z.object({
  name: trimStr.min(1, '商品名称不能为空').max(200),
  categoryId: idSchema,
  status: z.enum(['on', 'off']).default('on'),
  desc: z.string().max(2000).default(''),
  image: z.string().max(500).default(''),
  content: z.string().max(10000).default(''),
  cardSpecs: z.array(cardSpecSchema).default([]),
  // 商品类型：auto 自动发货 / manual 人工处理（参考独角数卡 goods.type）
  type: z.enum(['auto', 'manual']).default('auto'),
  // 限购数量（0=不限购）
  buyLimitNum: z.coerce.number().int().min(0).default(0),
  // 排序权重（越大越靠前）
  ord: z.coerce.number().int().default(0),
  // 批发价配置：每行 "数量=单价"（参考独角数卡 wholesale_price_cnf）
  wholesalePriceCnf: z.string().max(2000).default(''),
  // 其他输入框配置：每行 "字段=描述=是否必填=占位符"（参考独角数卡 other_ipu_cnf）
  otherIpuCnf: z.string().max(2000).default(''),
  // API回调URL（参考独角数卡 api_hook）
  apiHook: z.string().max(500).default(''),
});

const updateProductSchema = z.object({
  name: trimStr.min(1).max(200).optional(),
  categoryId: idSchema.optional(),
  status: z.enum(['on', 'off']).optional(),
  desc: z.string().max(2000).optional(),
  image: z.string().max(500).optional(),
  content: z.string().max(10000).optional(),
  cardSpecs: z.array(cardSpecSchema).optional(),
  type: z.enum(['auto', 'manual']).optional(),
  buyLimitNum: z.coerce.number().int().min(0).optional(),
  ord: z.coerce.number().int().optional(),
  wholesalePriceCnf: z.string().max(2000).optional(),
  otherIpuCnf: z.string().max(2000).optional(),
  apiHook: z.string().max(500).optional(),
}).refine(d => Object.keys(d).length > 0, { message: '至少提供一个要更新的字段' });

// ========== 卡密导入 ==========

const importCardsSchema = z.object({
  productId: idSchema,
  specId: z.string().max(64).optional(),
  contents: z.union([
    z.array(z.string()).min(1),
    z.string().min(1),
  ]),
  // 循环卡密：1=循环（可重复分配），0=普通（参考独角数卡 carmis.is_loop）
  // 注意：卡密时长强制取自规格 spec.durationSeconds，不再支持 durationSeconds 覆盖参数
  isLoop: z.coerce.number().int().min(0).max(1).optional(),
});

// ========== 订单创建（后台） ==========

const createOrderSchema = z.object({
  productId: idSchema,
  specId: idSchema,
  contact: trimStr.min(1, '请输入联系方式'),
  email: z.string().email('邮箱格式不正确').optional().or(z.literal('')),
  qty: z.coerce.number().int().min(1, '至少购买1个').max(50, '最多50个'),
  status: z.enum(['pending', 'paid', 'delivered', 'refunded', 'failed']).default('paid'),
});

const updateOrderSchema = z.object({
  // 订单状态：与 orderStateMachine.js / constants.js 保持一致（无 abnormal）
  status: z.enum(['pending', 'paid', 'delivered', 'refunded', 'failed', 'expired']).optional(),
  contact: trimStr.min(1).optional(),
  email: z.string().email('邮箱格式不正确').optional().or(z.literal('')).optional(),
}).refine(d => Object.keys(d).length > 0, { message: '至少提供一个要更新的字段' });

// ========== 前台下单 ==========

const storeOrderSchema = z.object({
  productId: idSchema,
  specId: idSchema,
  contact: trimStr.min(1, '请输入联系方式'),
  email: z.string().email('邮箱格式不正确').optional().or(z.literal('')),
  qty: z.coerce.number().int().min(1, '至少购买1个').max(50, '最多50个'),
  couponCode: z.string().trim().max(50).optional(),
  // 查询密码（参考独角数卡 search_pwd，开启开关时必填）
  searchPwd: z.string().max(100).optional(),
  // 其他输入框内容（manual 类型商品，JSON 字符串）
  otherIpu: z.string().max(2000).optional(),
  // 安全修复：移除 createPending 字段，防止前端绕过支付
});

// ========== 订单查询 ==========

const orderQuerySchema = z.object({
  orderNo: trimStr.min(1, '请输入订单号'),
  contact: trimStr.min(1, '请输入联系方式'),
});

const orderQueryByContactSchema = z.object({
  contact: trimStr.min(1, '请输入联系方式'),
  days: z.coerce.number().int().min(1).max(30).default(3),
});

// ========== 系统设置 ==========

// 允许的设置键白名单（防止写入任意键）
const ALLOWED_SETTING_KEYS = [
  'site.name', 'site.description', 'site.announcement', 'site.logo', 'site.favicon',
  // 支付渠道已改为数据库驱动（payment_methods 表），不再通过 site_settings 配置
  'mail.driver', 'mail.smtp_host', 'mail.smtp_port', 'mail.smtp_secure',
  'mail.from_addr', 'mail.smtp_pass', 'mail.from_name',
  // Resend 驱动
  'mail.resend_api_key',
  // 阿里云邮件推送驱动
  'mail.aliyun_access_key_id', 'mail.aliyun_access_key_secret', 'mail.aliyun_region',
  // 腾讯云 SES 驱动
  'mail.tencent_secret_id', 'mail.tencent_secret_key', 'mail.tencent_region',
  // 订单设置
  'order.search_pwd_enabled', 'order.manage_email',
];

// 敏感字段（GET 时脱敏，PUT 时若值为掩码则跳过更新）
const SENSITIVE_KEYS = [
  'mail.smtp_pass', 'mail.resend_api_key',
  'mail.aliyun_access_key_secret', 'mail.tencent_secret_key',
];

const updateSettingsSchema = z.record(z.string(), z.unknown())
  .refine((obj) => {
    return Object.keys(obj).every(k => ALLOWED_SETTING_KEYS.includes(k));
  }, { message: '包含不允许的设置项' });

// ========== 支付创建 ==========

const createPaymentSchema = z.object({
  orderId: idSchema,
  // payCheck: 支付方式记录 ID（数据库 payment_methods.id，如 pm_xxx）
  payCheck: z.string().min(1, '请选择支付方式').regex(/^pm_[a-zA-Z0-9_-]+$/, '无效的支付方式'),
  // contact: 下单时填写的联系方式，用于校验订单归属，防止他人凭 orderId 为订单创建支付
  contact: z.string().min(1, '请提供联系方式').max(100, '联系方式过长'),
});

// ========== 支付方式管理 ==========

const createPaymentMethodSchema = z.object({
  name: trimStr.min(1, '支付方式名称不能为空').max(100, '名称最多100字'),
  adapter: z.string().min(1, '请选择适配器'),
  method: z.enum(['alipay', 'wechat'], { message: '请选择支付方式' }),
  config: z.record(z.unknown()).default({}),
  sort: z.coerce.number().int().min(0).default(0),
  enabled: z.union([z.boolean(), z.coerce.number()]).default(true),
  icon: z.string().max(500).default(''),
});

const updatePaymentMethodSchema = z.object({
  name: trimStr.min(1).max(100).optional(),
  adapter: z.string().min(1).optional(),
  method: z.enum(['alipay', 'wechat']).optional(),
  config: z.record(z.unknown()).optional(),
  sort: z.coerce.number().int().min(0).optional(),
  enabled: z.union([z.boolean(), z.coerce.number()]).optional(),
  icon: z.string().max(500).optional(),
}).refine(d => Object.keys(d).length > 0, { message: '至少提供一个要更新的字段' });

// ========== 优惠码 ==========

const createCouponSchema = z.object({
  code: trimStr.min(1, '请输入优惠码').max(50, '优惠码过长'),
  discount: z.number().min(0, '优惠金额不能为负').max(999999, '优惠金额过大'),
  ret: z.number().int().min(-1, '剩余次数最小为-1（无限）').default(-1),
  note: z.string().max(200, '备注过长').optional().default(''),
  productIds: z.array(idSchema).optional().default([]),
});

const updateCouponSchema = z.object({
  code: trimStr.min(1, '请输入优惠码').max(50, '优惠码过长').optional(),
  discount: z.number().min(0, '优惠金额不能为负').max(999999, '优惠金额过大').optional(),
  isOpen: z.boolean().optional(),
  ret: z.number().int().min(-1, '剩余次数最小为-1（无限）').optional(),
  note: z.string().max(200, '备注过长').optional(),
  productIds: z.array(idSchema).optional(),
});

// 优惠码验证（前台下单时）
const validateCouponSchema = z.object({
  code: trimStr.min(1, '请输入优惠码'),
  productId: idSchema,
});

// ========== 验证中间件工厂 ==========

/**
 * 创建验证中间件
 * @param {z.ZodSchema} schema - zod schema
 * @param {'body'|'query'} source - 从哪儿取数据
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const data = source === 'query' ? req.query : req.body;
    const result = schema.safeParse(data);

    if (!result.success) {
      const errors = result.error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      return res.status(400).json({
        ok: false,
        message: errors[0]?.message || '请求参数不合法',
        errors,
      });
    }

    // 把校验后的数据回写，确保类型安全
    if (source === 'body') {
      req.body = result.data;
    } else {
      req.query = { ...req.query, ...result.data };
    }
    next();
  };
}

module.exports = {
  validate,
  schemas: {
    loginSchema,
    changePasswordSchema,
    createCategorySchema,
    updateCategorySchema,
    createProductSchema,
    updateProductSchema,
    importCardsSchema,
    createOrderSchema,
    updateOrderSchema,
    storeOrderSchema,
    orderQuerySchema,
    orderQueryByContactSchema,
    updateSettingsSchema,
    createPaymentSchema,
    createPaymentMethodSchema,
    updatePaymentMethodSchema,
    createCouponSchema,
    updateCouponSchema,
    validateCouponSchema,
  },
  ALLOWED_SETTING_KEYS,
  SENSITIVE_KEYS,
};
