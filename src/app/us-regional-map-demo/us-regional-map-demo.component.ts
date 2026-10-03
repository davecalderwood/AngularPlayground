import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { DEFAULT_US_REGIONS, US_STATE_CODE_TO_NAME } from '../us-regional-map/map-constants';
import { UsRegionalMapModule } from '../us-regional-map/us-regional-map.module';

const PALETTE = ['#08306b', '#2171b5', '#6baed6', '#c6dbef', '#fdae6b', '#e6550d', '#a63603'];

@Component({
  selector: 'app-us-regional-map-demo',
  standalone: true,
  imports: [CommonModule, UsRegionalMapModule],
  templateUrl: './us-regional-map-demo.component.html',
  styleUrl: './us-regional-map-demo.component.css',
})
export class UsRegionalMapDemoComponent {
  stateColors: Record<string, string> = {};
  selectedRegionId: string | null = null;
  lastClick: string | null = null;
  updateCount = 0;

  readonly regions = DEFAULT_US_REGIONS;
  private readonly codes = Object.keys(US_STATE_CODE_TO_NAME);

  // Every action assigns a new object so the child's ngOnChanges fires.
  randomizeAll(): void {
    this.setColors(Object.fromEntries(this.codes.map((c) => [c, this.randomColor()])));
  }

  addRandomStates(count = 5): void {
    const next = { ...this.stateColors };
    for (let i = 0; i < count; i++) {
      next[this.codes[Math.floor(Math.random() * this.codes.length)]] = this.randomColor();
    }
    this.setColors(next);
  }

  colorRegion(regionId: string): void {
    const region = this.regions.find((r) => r.id === regionId);
    if (region) {
      this.setColors({ ...this.stateColors, ...Object.fromEntries(region.states.map((c) => [c, this.randomColor()])) });
    }
  }

  clear(): void {
    this.setColors({});
  }

  private setColors(colors: Record<string, string>): void {
    this.stateColors = colors;
    this.updateCount++;
  }

  private randomColor(): string {
    return PALETTE[Math.floor(Math.random() * PALETTE.length)];
  }
}
