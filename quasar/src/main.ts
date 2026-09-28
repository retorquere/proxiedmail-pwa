import { createApp } from 'vue'
import { Quasar, Notify, Dialog } from 'quasar'
import iconSet from 'quasar/icon-set/material-icons'
import '@quasar/extras/material-icons/material-icons.css'
import 'quasar/src/css/index.sass'
import './styles.scss'
import App from './App.vue'
import { i18n } from './i18n'

createApp(App).use(Quasar, { plugins: { Notify, Dialog }, iconSet }).use(i18n).mount('#q-app')
