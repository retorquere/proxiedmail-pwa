import { createApp } from 'vue'
import { Quasar, Notify, Dialog } from 'quasar'
import iconSet from 'quasar/icon-set/material-icons'
import '@quasar/extras/material-icons/material-icons.css'
import 'quasar/src/css/index.sass'
import './styles.scss'
import App from './App.vue'

createApp(App).use(Quasar, { plugins: { Notify, Dialog }, iconSet }).mount('#q-app')
