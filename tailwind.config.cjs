module.exports = {
  content: ['./index.html', './App.tsx', './components/**/*.{ts,tsx}'],
  safelist: ['animate-reveal-fade', 'animate-reveal-flash', 'animate-reveal-blur', 'animate-reveal-zoom'],
  theme: { extend: {
    fontFamily: { sans: ['Inter', 'Noto Sans JP', 'system-ui', 'sans-serif'], mono: ['ui-monospace', 'monospace'] },
    colors: { spartan: { black: '#0f0f13', gray: '#1e1e24', red: '#ff6b81', neon: '#00f0ff', text: '#e0e0e0' } },
    animation: { 'reveal-fade': 'revealFade .2s ease-out', 'reveal-flash': 'revealFlash .2s ease-out', 'reveal-blur': 'revealBlur .3s ease-out', 'reveal-zoom': 'revealZoom .2s ease-out' },
    keyframes: {
      revealFade: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
      revealFlash: { '0%': { opacity: '.5', filter: 'brightness(1.4)' }, '100%': { opacity: '1', filter: 'brightness(1)' } },
      revealBlur: { '0%': { opacity: '0', filter: 'blur(8px)' }, '100%': { opacity: '1', filter: 'blur(0)' } },
      revealZoom: { '0%': { opacity: '0', transform: 'scale(1.04)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
    },
  } }, plugins: [],
};
