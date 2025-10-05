// next.config.mjs
import withPWA from 'next-pwa';

const isProd = process.env.NODE_ENV === 'production';

export default withPWA({
  experimental: {
    // keep whatever you already have here
  },
  pwa: {
    dest: 'public',
    register: true,
    skipWaiting: true,      // <-- important
    disable: !isProd,       // no SW in dev
    cleanupOutdatedCaches: true,
    dynamicStartUrl: true,
  },
});
