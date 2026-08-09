import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PageCacheService {
  private cache = new Map<string, any>();

  set(key: string, data: any) {
    this.cache.set(key, data);
  }

  get(key: string): any {
    return this.cache.get(key);
  }

  clear() {
    this.cache.clear();
  }
}
