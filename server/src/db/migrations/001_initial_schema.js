/**
 * 初始迁移 v1: 完整数据库 schema（首发纯净版）
 *
 * 本文件为项目首次正式发布的唯一初始化迁移脚本。
 * 执行一次即可建出全部 15 张业务表 + schema_version 记录表，
 * 含全部索引、约束、默认邮件模板与默认支付渠道（全部未启用）。
 *
 * 表清单（15 张）：
 *   admins / categories / products / cards / orders / payments /
 *   operation_logs / site_settings / email_queue / media_files /
 *   coupons / coupon_products / coupon_usages /
 *   email_templates / payment_methods
 *
 * 说明：
 * - 站点设置（site_settings）与默认管理员（admins）由 seeds/index.js 负责写入
 * - 支付渠道预置 4 条（虎皮椒+彩虹易支付 × 支付宝/微信），全部 enabled=0，
 *   config 为空 JSON，部署后由管理员在后台填写密钥并启用
 * - 邮件模板预置 5 个，覆盖自动发货/人工处理/待处理/完成/失败场景
 */

module.exports = {
  version: 1,
  name: 'initial_schema',
  up: (db) => {
    // ========== 1. 管理员表 ==========
    db.exec(`
      CREATE TABLE IF NOT EXISTS admins (
        id                   TEXT PRIMARY KEY,
        username             TEXT UNIQUE NOT NULL,
        password             TEXT NOT NULL,
        name                 TEXT DEFAULT '',
        role                 TEXT DEFAULT 'admin',
        failed_attempts      INTEGER DEFAULT 0,
        locked_until         TEXT DEFAULT NULL,
        token_invalidated_at TEXT DEFAULT NULL,
        created_at           TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // ========== 2. 商品分类表 ==========
    db.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        sort        INTEGER DEFAULT 0,
        enabled     INTEGER DEFAULT 1,
        desc        TEXT DEFAULT '',
        image       TEXT DEFAULT '',
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at  TEXT DEFAULT NULL
      )
    `);

    // ========== 3. 商品表 ==========
    db.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id                   TEXT PRIMARY KEY,
        category_id          TEXT NOT NULL,
        name                 TEXT NOT NULL,
        status               TEXT DEFAULT 'on' CHECK(status IN ('on', 'off')),
        desc                 TEXT DEFAULT '',
        image                TEXT DEFAULT '',
        content              TEXT DEFAULT '',
        card_specs           TEXT DEFAULT '[]',
        created_at           TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at           TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at           TEXT DEFAULT NULL,
        type                 TEXT NOT NULL DEFAULT 'auto',
        buy_limit_num        INTEGER NOT NULL DEFAULT 0,
        sales_volume         INTEGER NOT NULL DEFAULT 0,
        ord                  INTEGER NOT NULL DEFAULT 0,
        wholesale_price_cnf  TEXT DEFAULT '',
        other_ipu_cnf        TEXT DEFAULT '',
        api_hook             TEXT DEFAULT '',
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
      )
    `);

    // ========== 4. 订单表 ==========
    // status CHECK 收紧为 6 种合法状态（v18 最终态，已移除 abnormal）
    db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id                TEXT PRIMARY KEY,
        order_no          TEXT UNIQUE NOT NULL,
        product_id        TEXT NOT NULL,
        product_name      TEXT NOT NULL,
        spec_id           TEXT DEFAULT '',
        spec_name         TEXT DEFAULT '',
        unit_price        REAL NOT NULL DEFAULT 0,
        contact           TEXT NOT NULL,
        email             TEXT DEFAULT NULL,
        qty               INTEGER NOT NULL DEFAULT 1,
        amount            REAL NOT NULL DEFAULT 0,
        status            TEXT DEFAULT 'pending' CHECK(status IN ('pending','paid','delivered','refunded','failed','expired')),
        card_ids          TEXT DEFAULT '[]',
        payment_method    TEXT DEFAULT '',
        payment_trade_no  TEXT DEFAULT '',
        expires_at        TEXT DEFAULT NULL,
        paid_at           TEXT DEFAULT NULL,
        delivered_at      TEXT DEFAULT NULL,
        coupon_id         TEXT DEFAULT NULL,
        coupon_code       TEXT DEFAULT '',
        coupon_discount   REAL NOT NULL DEFAULT 0,
        original_amount   REAL NOT NULL DEFAULT 0,
        buy_ip            TEXT DEFAULT '',
        type              TEXT NOT NULL DEFAULT 'auto',
        search_pwd        TEXT DEFAULT '',
        info              TEXT DEFAULT '',
        created_at        TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
      )
    `);

    // ========== 5. 卡密表 ==========
    // status 含 sold 状态（v4 重建后最终态）
    db.exec(`
      CREATE TABLE IF NOT EXISTS cards (
        id                TEXT PRIMARY KEY,
        product_id        TEXT NOT NULL,
        spec_id           TEXT DEFAULT '',
        content           TEXT NOT NULL,
        type              TEXT DEFAULT '',
        duration_seconds  INTEGER DEFAULT 0,
        status            TEXT DEFAULT 'available' CHECK(status IN ('available', 'assigned', 'sold')),
        order_id          TEXT DEFAULT NULL,
        assigned_at       TEXT DEFAULT NULL,
        created_at        TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at        TEXT DEFAULT NULL,
        is_loop           INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
      )
    `);

    // ========== 6. 支付记录表 ==========
    // trade_no 无列级 UNIQUE（v20 重建后最终态），仅由部分唯一索引约束非空值
    db.exec(`
      CREATE TABLE IF NOT EXISTS payments (
        id              TEXT PRIMARY KEY,
        order_id        TEXT NOT NULL,
        order_no        TEXT NOT NULL,
        channel         TEXT NOT NULL,
        trade_no        TEXT DEFAULT '',
        amount          REAL NOT NULL,
        status          TEXT DEFAULT 'pending' CHECK(status IN ('pending','paid','failed','refunded')),
        qr_code         TEXT DEFAULT '',
        pay_url         TEXT DEFAULT '',
        callback_data   TEXT DEFAULT '',
        paid_at         TEXT DEFAULT NULL,
        created_at      TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      )
    `);

    // ========== 7. 操作日志表 ==========
    db.exec(`
      CREATE TABLE IF NOT EXISTS operation_logs (
        id            TEXT PRIMARY KEY,
        admin_id      TEXT DEFAULT NULL,
        admin_name    TEXT DEFAULT '',
        action        TEXT NOT NULL,
        target_type   TEXT DEFAULT '',
        target_id     TEXT DEFAULT '',
        detail        TEXT DEFAULT '',
        ip            TEXT DEFAULT '',
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
      )
    `);

    // ========== 8. 站点设置表 ==========
    db.exec(`
      CREATE TABLE IF NOT EXISTS site_settings (
        key           TEXT PRIMARY KEY,
        value         TEXT NOT NULL,
        updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // ========== 9. 媒体文件表 ==========
    db.exec(`
      CREATE TABLE IF NOT EXISTS media_files (
        id              TEXT PRIMARY KEY,
        filename        TEXT NOT NULL,
        original_name   TEXT NOT NULL,
        mime_type       TEXT NOT NULL,
        size            INTEGER NOT NULL DEFAULT 0,
        path            TEXT NOT NULL,
        created_at      TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // ========== 10. 邮件队列表 ==========
    // 含 updated_at 列（v19 补充，emailService 依赖）
    db.exec(`
      CREATE TABLE IF NOT EXISTS email_queue (
        id            TEXT PRIMARY KEY,
        to_addr       TEXT NOT NULL,
        subject       TEXT NOT NULL,
        body          TEXT NOT NULL,
        status        TEXT DEFAULT 'pending' CHECK(status IN ('pending','sent','failed')),
        order_id      TEXT DEFAULT NULL,
        attempts      INTEGER DEFAULT 0,
        last_error    TEXT DEFAULT NULL,
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        sent_at       TEXT DEFAULT NULL,
        updated_at    TEXT,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
      )
    `);

    // ========== 11. 优惠券表 ==========
    // 含软删除 + 过期时间 + 最低消费 + 单用户限制（v17 增强后最终态）
    db.exec(`
      CREATE TABLE IF NOT EXISTS coupons (
        id              TEXT PRIMARY KEY,
        code            TEXT NOT NULL UNIQUE,
        discount        REAL NOT NULL DEFAULT 0,
        is_open         INTEGER NOT NULL DEFAULT 1,
        ret             INTEGER NOT NULL DEFAULT -1,
        used_count      INTEGER NOT NULL DEFAULT 0,
        note            TEXT DEFAULT '',
        created_at      TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at      TEXT DEFAULT NULL,
        expires_at      TEXT DEFAULT NULL,
        min_amount      REAL NOT NULL DEFAULT 0,
        per_user_limit  INTEGER NOT NULL DEFAULT 0
      )
    `);

    // ========== 12. 优惠券-商品关联表 ==========
    db.exec(`
      CREATE TABLE IF NOT EXISTS coupon_products (
        coupon_id   TEXT NOT NULL,
        product_id  TEXT NOT NULL,
        PRIMARY KEY (coupon_id, product_id),
        FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);

    // ========== 13. 优惠券使用记录表 ==========
    db.exec(`
      CREATE TABLE IF NOT EXISTS coupon_usages (
        id          TEXT PRIMARY KEY,
        coupon_id   TEXT NOT NULL,
        order_id    TEXT NOT NULL,
        contact     TEXT NOT NULL,
        used_at     TEXT NOT NULL,
        FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      )
    `);

    // ========== 14. 邮件模板表 ==========
    db.exec(`
      CREATE TABLE IF NOT EXISTS email_templates (
        id            TEXT PRIMARY KEY,
        tpl_name      TEXT NOT NULL,
        tpl_content   TEXT NOT NULL,
        tpl_token     TEXT UNIQUE NOT NULL,
        enabled       INTEGER NOT NULL DEFAULT 1,
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // ========== 15. 支付渠道表 ==========
    db.exec(`
      CREATE TABLE IF NOT EXISTS payment_methods (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        adapter     TEXT NOT NULL,
        method      TEXT NOT NULL,
        config      TEXT NOT NULL DEFAULT '{}',
        sort        INTEGER NOT NULL DEFAULT 0,
        enabled     INTEGER NOT NULL DEFAULT 1,
        icon        TEXT DEFAULT '',
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // ========== 索引（一次性创建全部最终索引）==========

    // cards 索引
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_cards_product_spec ON cards(product_id, spec_id, status);
      CREATE INDEX IF NOT EXISTS idx_cards_status ON cards(status);
      CREATE INDEX IF NOT EXISTS idx_cards_product_spec_status_created ON cards(product_id, spec_id, status, created_at);
      CREATE INDEX IF NOT EXISTS idx_cards_deleted ON cards(deleted_at);
      CREATE INDEX IF NOT EXISTS idx_cards_is_loop ON cards(is_loop);
    `);

    // categories 索引
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort);
      CREATE INDEX IF NOT EXISTS idx_categories_deleted ON categories(deleted_at);
    `);

    // products 索引
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
      CREATE INDEX IF NOT EXISTS idx_products_deleted ON products(deleted_at);
      CREATE INDEX IF NOT EXISTS idx_products_ord ON products(ord);
    `);

    // orders 索引
    // 注：order_no 已有 UNIQUE 约束自动创建隐式索引，无需额外建 idx_orders_order_no
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_orders_contact ON orders(contact);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
      CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at);
      CREATE INDEX IF NOT EXISTS idx_orders_expires ON orders(expires_at) WHERE status = 'pending';
      CREATE INDEX IF NOT EXISTS idx_orders_delivered_at ON orders(delivered_at);
    `);

    // payments 索引
    // 部分唯一索引：仅对非空 trade_no 做唯一约束（兼容空 trade_no 多笔支付）
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
      CREATE INDEX IF NOT EXISTS idx_payments_channel ON payments(channel);
      CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_trade_no_nonempty ON payments(trade_no) WHERE trade_no IS NOT NULL AND trade_no != '';
    `);

    // operation_logs 索引
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_operation_logs_admin ON operation_logs(admin_id);
      CREATE INDEX IF NOT EXISTS idx_operation_logs_created ON operation_logs(created_at);
    `);

    // email_queue 索引
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);
      CREATE INDEX IF NOT EXISTS idx_email_queue_order ON email_queue(order_id);
    `);

    // coupons 相关索引
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_coupons_deleted ON coupons(deleted_at);
      CREATE INDEX IF NOT EXISTS idx_coupon_products_product ON coupon_products(product_id);
      CREATE INDEX IF NOT EXISTS idx_coupon_usages_coupon_contact ON coupon_usages(coupon_id, contact);
      CREATE INDEX IF NOT EXISTS idx_coupon_usages_order_id ON coupon_usages(order_id);
    `);

    // email_templates 索引
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_email_templates_token ON email_templates(tpl_token);
    `);

    // payment_methods 索引
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_payment_methods_enabled_sort ON payment_methods(enabled, sort);
      CREATE INDEX IF NOT EXISTS idx_payment_methods_adapter ON payment_methods(adapter);
    `);

    // ========== 预置数据：邮件模板（5 个）==========
    const now = new Date().toISOString();
    const templates = [
      {
        id: 'eml_card_send_user_email',
        name: '自动发货-用户通知',
        token: 'card_send_user_email',
        content: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
<h2 style="color:#6366f1;">{webname}</h2>
<p>您的订单已自动发货完成。</p>
<div style="background:#f9fafb;padding:16px;border-radius:12px;margin:16px 0;">
<p><strong>订单号:</strong> {order_id}</p>
<p><strong>商品:</strong> {product_name}</p>
<p><strong>数量:</strong> {buy_amount}</p>
<p><strong>金额:</strong> ¥{ord_price}</p>
</div>
<h3>卡密内容:</h3>
<div>{ord_info}</div>
<p style="color:#9ca3af;font-size:12px;margin-top:24px;">下单时间: {created_at}</p>
</div>`,
      },
      {
        id: 'eml_manual_send_manage_mail',
        name: '人工处理-管理员通知',
        token: 'manual_send_manage_mail',
        content: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
<h2 style="color:#f59e0b;">{webname} - 新订单需人工处理</h2>
<div style="background:#fef3c7;padding:16px;border-radius:12px;margin:16px 0;">
<p><strong>订单号:</strong> {order_id}</p>
<p><strong>商品:</strong> {product_name}</p>
<p><strong>数量:</strong> {buy_amount}</p>
<p><strong>金额:</strong> ¥{ord_price}</p>
<p><strong>买家邮箱:</strong> {buyer_email}</p>
</div>
<h3>用户填写信息:</h3>
<div>{ord_info}</div>
<p style="color:#9ca3af;font-size:12px;margin-top:24px;">下单时间: {created_at}</p>
</div>`,
      },
      {
        id: 'eml_pending_order',
        name: '手动处理-待处理通知',
        token: 'pending_order',
        content: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
<h2 style="color:#6366f1;">{webname}</h2>
<p>您的订单已提交，正在处理中，请耐心等待。</p>
<div style="background:#f9fafb;padding:16px;border-radius:12px;margin:16px 0;">
<p><strong>订单号:</strong> {order_id}</p>
<p><strong>商品:</strong> {product_name}</p>
<p><strong>金额:</strong> ¥{ord_price}</p>
</div>
<p style="color:#9ca3af;font-size:12px;margin-top:24px;">下单时间: {created_at}</p>
</div>`,
      },
      {
        id: 'eml_completed_order',
        name: '手动处理-完成通知',
        token: 'completed_order',
        content: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
<h2 style="color:#10b981;">{webname}</h2>
<p>您的订单已处理完成。</p>
<div style="background:#f9fafb;padding:16px;border-radius:12px;margin:16px 0;">
<p><strong>订单号:</strong> {order_id}</p>
<p><strong>商品:</strong> {product_name}</p>
<p><strong>金额:</strong> ¥{ord_price}</p>
</div>
<h3>处理结果:</h3>
<div>{ord_info}</div>
<p style="color:#9ca3af;font-size:12px;margin-top:24px;">完成时间: {created_at}</p>
</div>`,
      },
      {
        id: 'eml_failed_order',
        name: '订单失败通知',
        token: 'failed_order',
        content: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
<h2 style="color:#ef4444;">{webname}</h2>
<p>很抱歉，您的订单处理失败。</p>
<div style="background:#fef2f2;padding:16px;border-radius:12px;margin:16px 0;">
<p><strong>订单号:</strong> {order_id}</p>
<p><strong>商品:</strong> {product_name}</p>
<p><strong>金额:</strong> ¥{ord_price}</p>
</div>
<p>如有疑问，请联系客服。</p>
<p style="color:#9ca3af;font-size:12px;margin-top:24px;">时间: {created_at}</p>
</div>`,
      },
    ];

    const insertTpl = db.prepare(
      `INSERT OR IGNORE INTO email_templates (id, tpl_name, tpl_content, tpl_token, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`
    );
    for (const t of templates) {
      insertTpl.run(t.id, t.name, t.content, t.token, now, now);
    }

    // ========== 预置数据：支付渠道（4 条，全部未启用）==========
    // 部署后由管理员在后台填写密钥并启用，config 为空 JSON
    const { v4: uuidv4 } = require('uuid');
    const methods = [
      { name: '支付宝', adapter: 'hupi', method: 'alipay', sort: 0 },
      { name: '微信支付', adapter: 'hupi', method: 'wechat', sort: 1 },
      { name: '支付宝', adapter: 'yi',   method: 'alipay', sort: 2 },
      { name: '微信支付', adapter: 'yi',   method: 'wechat', sort: 3 },
    ];
    const insertPm = db.prepare(
      `INSERT OR IGNORE INTO payment_methods (id, name, adapter, method, config, sort, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, '{}', ?, 0, ?, ?)`
    );
    for (const m of methods) {
      insertPm.run(`pm_${uuidv4()}`, m.name, m.adapter, m.method, m.sort, now, now);
    }
  },
};
