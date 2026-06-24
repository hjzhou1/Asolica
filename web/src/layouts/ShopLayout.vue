<template>
  <ShopNav />
  <main class="shop-main">
    <RouterView />
  </main>
  <ShopFooter />
</template>

<script setup>
import { RouterView } from 'vue-router';
import ShopNav from '../components/shop/ShopNav.vue';
import ShopFooter from '../components/shop/ShopFooter.vue';
</script>

<style scoped>
.shop-main {
  min-height: 100vh;
}
</style>
