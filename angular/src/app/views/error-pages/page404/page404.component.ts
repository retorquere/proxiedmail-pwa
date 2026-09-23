import { Component } from '@angular/core'
import { ButtonDirective, ColComponent, ContainerComponent, FormControlDirective, InputGroupComponent, InputGroupTextDirective, RowComponent } from '@coreui/angular'
import { IconDirective } from '@coreui/icons-angular'

@Component({
  selector: 'app-page404',
  templateUrl: './page404.component.html',
  imports: [ContainerComponent, RowComponent, ColComponent, InputGroupComponent, InputGroupTextDirective, IconDirective, FormControlDirective, ButtonDirective],
})
export class Page404Component {}
