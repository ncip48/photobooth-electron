import { createApp } from 'vue'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router/index.js'
import { queryClient } from './lib/queryClient.js'
import './styles/app.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(VueQueryPlugin, { queryClient })

app.mount('#app')