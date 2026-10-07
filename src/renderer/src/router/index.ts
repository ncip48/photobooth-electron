import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
    // hash history untuk Electron (file:// protocol)
    history: createWebHashHistory(),
    routes: [
        {
            path: '/',
            redirect: '/start',
        },
        {
            path: '/start',
            name: 'start',
            component: () => import('@/pages/Start.vue'),
        },
        {
            path: '/event-picker',
            name: 'event-picker',
            component: () => import('@/pages/EventPicker.vue'),
        },
        {
            path: '/payment',
            name: 'payment',
            component: () => import('@/pages/Payment.vue'),
        },
        {
            path: '/capture/:sessionId/:templateId?',
            name: 'capture',
            component: () => import('@/pages/Capture.vue'),
        },
        {
            path: '/select-frame/:sessionId',
            name: 'select-frame',
            component: () => import('@/pages/SelectFrame.vue'),
        },
        {
            path: '/editor/:sessionId',
            name: 'editor',
            component: () => import('@/pages/Editor.vue'),
        },
        {
            path: '/result/:sessionId',
            name: 'result',
            component: () => import('@/pages/Result.vue'),
        },
    ],
})

export default router