import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NavigationStateService {
  private _selectedNodeId = new BehaviorSubject<string | null>(null);
  selectedNodeId$ = this._selectedNodeId.asObservable();

  setSelectedNode(id: string) {
    this._selectedNodeId.next(id);
  }
}
