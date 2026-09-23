/// <reference types="@angular/localize" />
import { bootstrapApplication } from '@angular/platform-browser'

import { AppComponent } from './app/app.component'
import { appConfig } from './app/app.config'
import { initializeLocale } from './locale/runtime'

initializeLocale()
bootstrapApplication(AppComponent, appConfig)
  .catch(err => console.error(err))
