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
        // {
        //     path: '/payment',
        //     name: 'payment',
        //     component: () => import('@/pages/Payment.vue'),
        // },
        // {
        //     path: '/capture',
        //     name: 'capture',
        //     component: () => import('@/pages/Capture.vue'),
        // },
        // {
        //     path: '/editor',
        //     name: 'editor',
        //     component: () => import('@/pages/Editor.vue'),
        // },
        // {
        //     path: '/result',
        //     name: 'result',
        //     component: () => import('@/pages/Result.vue'),
        // },
    ],
})

export default router