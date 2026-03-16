import { createApp } from 'vue'

import { App } from '@/app'
import { router } from '@/app/providers/router'
import '@/style.css'

createApp(App).use(router).mount('#app')
