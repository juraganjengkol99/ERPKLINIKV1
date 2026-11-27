import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'idr',
  standalone: true
})
export class IdrPipe implements PipeTransform {
  transform(value: number | string | null | undefined): string {
    const num = Number(value || 0);
    return `Rp ${Math.round(num).toLocaleString('id-ID')}`;
  }
}
