import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
    main: {
        plugins: [externalizeDepsPlugin()],
        build: {
            rollupOptions: {
                input: {
                    index: resolve(__dirname, 'electron/main.ts'),
                },
            },
        },
    },
    preload: {
        plugins: [externalizeDepsPlugin()],
        build: {
            rollupOptions: {
                input: {
                    index: resolve(__dirname, 'electron/preload.ts'),
                },
            },
        },
    },
    renderer: {
        // electron-vite otomatis cari src/renderer/index.html
        resolve: {
            alias: {
                '@': resolve(__dirname, 'src/renderer/src'),
            },
        },
        plugins: [vue()],
    },
})