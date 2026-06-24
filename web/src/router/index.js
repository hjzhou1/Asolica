import { createRouter, createWebHashHistory } from 'vue-router';
import Home from '../views/shop/Home.vue';
import Dingdanchaxun from '../views/shop/OrderQuery.vue';
import Shangpinxiangqing from '../views/shop/ProductDetail.vue';
import Querendingdan from '../views/shop/OrderConfirm.vue';
import Dingdanxiangqing from '../views/shop/OrderDetail.vue';
import AdminLogin from '../views/admin/Login.vue';
import { isTokenExpired } from '../stores/admin.js';
import { getToken } from '../api/admin.js';

const ShopLayout = () => import('../layouts/ShopLayout.vue');
const AdminLayout = () => import('../layouts/AdminLayout.vue');
const AdminHome = () => import('../views/admin/Dashboard.vue');
const AdminDingdan = () => import('../views/admin/Orders.vue');
const AdminShangpin = () => import('../views/admin/Products.vue');
const AdminFenlei = () => import('../views/admin/Categories.vue');
const AdminKami = () => import('../views/admin/Cards.vue');
const AdminYouhuima = () => import('../views/admin/Coupons.vue');
const AdminMima = () => import('../views/admin/Password.vue');
const AdminMedia = () => import('../views/admin/Media.vue');
const AdminSettings = () => import('../views/admin/Settings.vue');
const AdminLogs = () => import('../views/admin/Logs.vue');
const AdminEmailTemplates = () => import('../views/admin/EmailTemplates.vue');
const AdminEmailQueue = () => import('../views/admin/EmailQueue.vue');
const NotFound = () => import('../views/NotFound.vue');

const routes = [
  // 前台（使用 ShopLayout 包裹 ShopNav + ShopFooter）
  {
    path: '/',
    component: ShopLayout,
    children: [
      { path: '', name: 'home', component: Home, alias: '/home' },
      { path: 'dingdanchaxun', name: 'dingdanchaxun', component: Dingdanchaxun },
      { path: 'shangpin/:id', name: 'shangpinxiangqing', component: Shangpinxiangqing },
      { path: 'querendingdan', name: 'querendingdan', component: Querendingdan },
      { path: 'dingdan/:id', name: 'dingdanxiangqing', component: Dingdanxiangqing },
    ],
  },

  // 管理员登录
  { path: '/login', name: 'admin-login', component: AdminLogin },

  // 管理后台（需登录守卫）
  {
    path: '/admins',
    component: AdminLayout,
    beforeEnter: (to, from, next) => {
      const token = getToken();
      if (!token || isTokenExpired(token)) {
        // token 缺失/过期/格式异常 → 清除并跳转登录页
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_info');
        next({ name: 'admin-login' });
        return;
      }
      next();
    },
    children: [
      { path: '', name: 'admin-home', component: AdminHome },
      { path: 'dingdan', name: 'admin-dingdan', component: AdminDingdan },
      { path: 'shangpin', name: 'admin-shangpin', component: AdminShangpin },
      { path: 'fenlei', name: 'admin-fenlei', component: AdminFenlei },
      { path: 'kami', name: 'admin-kami', component: AdminKami },
      { path: 'youhuima', name: 'admin-youhuima', component: AdminYouhuima },
      { path: 'mima', name: 'admin-mima', component: AdminMima },
      { path: 'media', name: 'admin-media', component: AdminMedia },
      { path: 'settings', name: 'admin-settings', component: AdminSettings },
      { path: 'logs', name: 'admin-logs', component: AdminLogs },
      { path: 'email-templates', name: 'admin-email-templates', component: AdminEmailTemplates },
      { path: 'email-queue', name: 'admin-email-queue', component: AdminEmailQueue },
    ],
  },

  // 404
  { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFound },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior() { return { top: 0 }; },
});

export default router;
