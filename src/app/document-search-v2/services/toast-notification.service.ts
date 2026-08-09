import { Injectable, ApplicationRef } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ToastNotificationService {
  private toastElement: HTMLElement | null = null;
  private queue: { message: string, durationMs: number }[] = [];
  private isDisplaying = false;

  constructor(private appRef: ApplicationRef) {
      this.initToastElement();
  }

  private initToastElement() {
      if (document.getElementById('doc-v2-toast-container')) return;

      this.toastElement = document.createElement('div');
      this.toastElement.id = 'doc-v2-toast-container';
      this.toastElement.style.position = 'fixed';
      this.toastElement.style.top = '20px';
      this.toastElement.style.right = '20px';
      this.toastElement.style.zIndex = '9999';
      document.body.appendChild(this.toastElement);
  }

  show(message: string, durationMs: number = 3000) {
    console.log(`[Toast]: ${message}`);
    this.queue.push({ message, durationMs } as any);
    this.processQueue();
  }
  
  private processQueue() {
      if (this.isDisplaying || this.queue.length === 0 || !this.toastElement) return;
      
      this.isDisplaying = true;
      const { message, durationMs } = this.queue.shift() as any;
      
      const toast = document.createElement('div');
      toast.innerText = message;
      toast.style.backgroundColor = '#333';
      toast.style.color = '#fff';
      toast.style.padding = '12px 20px';
      toast.style.borderRadius = '4px';
      toast.style.marginBottom = '10px';
      toast.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
      toast.style.opacity = '1';
      toast.style.transition = 'opacity 0.3s ease-in-out';
      
      this.toastElement.appendChild(toast);
      
      setTimeout(() => {
          toast.style.opacity = '0';
          setTimeout(() => {
              toast.remove();
              this.isDisplaying = false;
              this.processQueue();
          }, 300);
      }, durationMs);
  }
}
