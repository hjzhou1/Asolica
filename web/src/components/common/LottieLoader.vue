<template>
  <div
    v-if="overlay"
    class="lottie-overlay"
    role="alert"
    aria-live="assertive"
    :aria-label="text || '加载中'"
  >
    <div class="lottie-stage">
      <div ref="containerRef" class="lottie-container" :style="containerStyle" />
      <p v-if="text" class="lottie-text">{{ text }}</p>
    </div>
  </div>
  <div v-else class="lottie-inline">
    <div ref="containerRef" class="lottie-container" :style="containerStyle" />
    <p v-if="text" class="lottie-text">{{ text }}</p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import lottie from 'lottie-web'

const props = defineProps({
  src: { type: String, required: true },
  overlay: { type: Boolean, default: false },
  text: { type: String, default: '' },
  autoplay: { type: Boolean, default: true },
  loop: { type: Boolean, default: true },
  speed: { type: Number, default: 1 },
  width: { type: Number, default: 200 },
  height: { type: Number, default: 200 }
})

const emit = defineEmits(['ready', 'complete', 'error'])

const containerRef = ref(null)
let animation = null

const containerStyle = computed(() => ({
  width: `${props.width}px`,
  height: `${props.height}px`
}))

function setup() {
  if (!containerRef.value || !props.src) return

  destroy()

  try {
    animation = lottie.loadAnimation({
      container: containerRef.value,
      renderer: 'canvas',
      loop: props.loop,
      autoplay: props.autoplay,
      path: props.src,
      rendererSettings: {
        progressiveLoad: true,
        preserveAspectRatio: 'xMidYMid meet'
      }
    })

    animation.setSpeed(props.speed)

    animation.addEventListener('DOMLoaded', () => {
      emit('ready', animation)
    })

    animation.addEventListener('complete', () => {
      emit('complete')
    })

    animation.addEventListener('error', (err) => {
      console.error('[LottieLoader] 播放出错:', err)
      emit('error', err)
    })
  } catch (err) {
    console.error('[LottieLoader] 初始化失败:', err)
    emit('error', err)
  }
}

function destroy() {
  if (animation) {
    animation.destroy()
    animation = null
  }
}

onMounted(() => {
  nextTick(setup)
})

onBeforeUnmount(() => {
  destroy()
})

watch(() => props.src, () => {
  nextTick(setup)
})
</script>

<style scoped>
/* 全屏覆盖 */
.lottie-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-max);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 15, 20, 0.72);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  animation: overlayIn 0.3s ease-out;
}

.lottie-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  animation: stagePulse 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

/* 行内 */
.lottie-inline {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.lottie-container {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.lottie-text {
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.85);
  text-align: center;
  letter-spacing: 0.04em;
  animation: textPulse 1.8s ease-in-out infinite;
}

@keyframes overlayIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes stagePulse {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(12px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes textPulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 0.9; }
}

/* prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  .lottie-overlay,
  .lottie-stage,
  .lottie-text {
    animation: none;
  }
}
</style>