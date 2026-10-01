import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// Vite 配置（ESM，文件名必须是 .mjs 以免被 CommonJS require 加载失败）
//  - dev（npm run dev）：HTTP 开发服务器 + HMR，base 用 '/'（不影响本地资源服务）
//  - build（npm run build）：产出 dist/，base 用 './'（相对路径，供 Electron 以 file:// 加载）
export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'assets', dest: '.' },   // assets/** -> dist/assets/**
        { src: 'libs', dest: '.' },      // libs/**   -> dist/libs/**
      ],
    }),
  ],
  server: { port: 5173, open: true },
}));
