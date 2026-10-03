import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import * as d3 from 'd3';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { geoAlbersUsaTerritories } from 'geo-albers-usa-territories';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import {
  DEFAULT_STATE_COLOR,
  DEFAULT_US_REGIONS,
  US_FIPS_TO_STATE_CODE,
  US_STATE_CODE_TO_NAME,
  UsRegion,
} from './map-constants';

export interface UsStateSelection {
  code: string;
  name: string;
  regionId: string | null;
}

interface StateShape {
  code: string;
  name: string;
  regionId: string | null;
  geometry: Feature<Geometry>;
}

interface StateLabel {
  code: string;
  regionId: string | null;
  x: number;
  y: number;
  anchor: 'start' | 'middle';
  /** Leader line from the shape centroid to the label, for callouts. */
  leader: { x1: number; y1: number; x2: number; y2: number } | null;
}

const TOPOLOGY_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';
const UNASSIGNED = '__unassigned__';
const TRANSITION_MS = 300;
const TERRITORY_CODES = new Set(['PR', 'VI', 'GU', 'AS', 'MP']);
// Shapes with a bounding box under these pixel sizes can't fit a 2-letter label.
const MIN_LABEL_WIDTH = 18;
const MIN_LABEL_HEIGHT = 12;
const CALLOUT_LINE_HEIGHT = 12;

@Component({
  selector: 'us-regional-map',
  templateUrl: './us-regional-map.component.html',
  styleUrls: ['./us-regional-map.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsRegionalMapComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  @Input() regions: readonly UsRegion[] = DEFAULT_US_REGIONS;
  /** Fill colors keyed by 2-letter code; missing states render as DEFAULT_STATE_COLOR. */
  @Input() stateColors: Record<string, string> = {};
  @Input() selectedRegionId: string | null = null;
  @Input() width = 960;
  @Input() height = 520;
  @Input() showLegend = true;

  @Output() selectedRegionIdChange = new EventEmitter<string | null>();
  @Output() stateClicked = new EventEmitter<UsStateSelection>();
  @Output() stateClick = new EventEmitter<string>();

  @ViewChild('svg', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  hoveredRegionId: string | null = null;
  loading = true;
  error: string | null = null;

  private features: Feature<Geometry>[] = [];
  private viewReady = false;
  private drawn = false;
  private abort = new AbortController();

  constructor(private readonly cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadTopology();
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.draw();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.drawn) {
      return;
    }
    if (changes['regions'] || changes['width'] || changes['height']) {
      this.draw();
      return;
    }
    if (changes['stateColors']) {
      this.updateFills(true);
    }
    if (changes['selectedRegionId']) {
      this.updateDimming();
    }
  }

  ngOnDestroy(): void {
    this.abort.abort();
  }

  toggleRegion(regionId: string | null): void {
    this.selectedRegionId = regionId === this.selectedRegionId ? null : regionId;
    this.selectedRegionIdChange.emit(this.selectedRegionId);
    this.updateDimming();
    this.cdr.markForCheck();
  }

  setHover(regionId: string | null): void {
    this.hoveredRegionId = regionId;
    this.updateDimming();
    this.cdr.markForCheck();
  }

  trackByRegion(_: number, region: UsRegion): string {
    return region.id;
  }

  private async loadTopology(): Promise<void> {
    try {
      const res = await fetch(TOPOLOGY_URL, { signal: this.abort.signal });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const topology = (await res.json()) as Topology<{ states: GeometryCollection }>;
      const collection = feature(topology, topology.objects.states) as FeatureCollection<Geometry>;
      this.features = collection.features;
      this.error = null;
    } catch (e) {
      if (this.abort.signal.aborted) {
        return;
      }
      this.error = `Failed to load map data: ${(e as Error).message}`;
    }
    this.loading = false;
    this.cdr.markForCheck();
    this.draw();
  }

  private buildShapes(): StateShape[] {
    const regionByState = new Map<string, string>();
    this.regions.forEach((r) => r.states.forEach((s) => regionByState.set(s, r.id)));

    return this.features.flatMap((f) => {
      const code = US_FIPS_TO_STATE_CODE[String(f.id).padStart(2, '0')];
      return code
        ? [{ code, name: US_STATE_CODE_TO_NAME[code], regionId: regionByState.get(code) ?? null, geometry: f }]
        : [];
    });
  }

  private draw(): void {
    if (!this.viewReady || !this.features.length) {
      return;
    }
    const projection = geoAlbersUsaTerritories().translate([this.width / 2, this.height / 2 - 10]);
    const pathFor = d3.geoPath(projection);
    const shapes = this.buildShapes();
    const byRegion = d3.group(shapes, (s) => s.regionId ?? UNASSIGNED);

    const groups: { id: string; shift: { x: number; y: number }; shapes: StateShape[] }[] = [
      ...this.regions.map((r) => ({ id: r.id, shift: r.shift, shapes: byRegion.get(r.id) ?? [] })),
      { id: UNASSIGNED, shift: { x: 0, y: 0 }, shapes: byRegion.get(UNASSIGNED) ?? [] },
    ].filter((g) => g.shapes.length);

    const svg = d3
      .select(this.svgRef.nativeElement)
      .attr('viewBox', `0 0 ${this.width} ${this.height}`);
    svg.selectAll('*').remove();

    const regionGroups = svg
      .selectAll<SVGGElement, (typeof groups)[number]>('g.us-map__region')
      .data(groups, (g) => g.id)
      .join('g')
      .attr('class', 'us-map__region')
      .attr('data-region-id', (g) => g.id)
      .attr('transform', (g) => `translate(${g.shift.x}, ${g.shift.y})`);

    regionGroups
      .selectAll<SVGPathElement, StateShape>('path')
      .data((g) => g.shapes, (s) => (s as StateShape).code)
      .join('path')
      .attr('class', 'us-map__state')
      .attr('d', (s) => pathFor(s.geometry) ?? '')
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label', (s) => s.name)
      .on('click', (_, s) => this.onStateClick(s))
      .on('keydown', (event: KeyboardEvent, s) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          this.onStateClick(s);
        }
      })
      .on('mouseenter', (_, s) => this.setHover(s.regionId))
      .on('mouseleave', () => this.setHover(null))
      .append('title')
      .text((s) => s.name);

    // Separate top layers (same region shifts) keep labels above every path.
    const labelLayers = svg
      .selectAll<SVGGElement, (typeof groups)[number]>('g.us-map__labels')
      .data(groups, (g) => g.id)
      .join('g')
      .attr('class', 'us-map__labels')
      .attr('aria-hidden', 'true')
      .attr('transform', (g) => `translate(${g.shift.x}, ${g.shift.y})`);

    const self = this;
    labelLayers.each(function (g) {
      const labels = self.buildLabels(g.shapes, pathFor);
      const layer = d3.select(this);
      layer
        .selectAll('line')
        .data(labels.filter((l) => l.leader))
        .join('line')
        .attr('class', 'us-map__leader')
        .attr('x1', (l) => l.leader!.x1)
        .attr('y1', (l) => l.leader!.y1)
        .attr('x2', (l) => l.leader!.x2)
        .attr('y2', (l) => l.leader!.y2);
      layer
        .selectAll('text')
        .data(labels)
        .join('text')
        .attr('class', (l) => `us-map__label${l.leader ? ' us-map__label--callout' : ''}`)
        .attr('x', (l) => l.x)
        .attr('y', (l) => l.y)
        .attr('text-anchor', (l) => l.anchor)
        .attr('dominant-baseline', 'central')
        .text((l) => l.code);
    });

    this.drawn = true;
    this.updateFills(false);
    this.updateDimming();
  }

  /** Centered labels for large shapes; callouts for small states and territories. */
  private buildLabels(shapes: StateShape[], pathFor: d3.GeoPath<unknown, d3.GeoPermissibleObjects>): StateLabel[] {
    const labels: StateLabel[] = [];
    const eastCallouts: { shape: StateShape; cx: number; cy: number }[] = [];
    const regionMaxX = d3.max(shapes, (s) => pathFor.bounds(s.geometry)[1][0]) ?? 0;

    for (const shape of shapes) {
      const [cx, cy] = pathFor.centroid(shape.geometry);
      if (!Number.isFinite(cx) || !Number.isFinite(cy)) {
        continue;
      }
      const [[x0, y0], [x1, y1]] = pathFor.bounds(shape.geometry);
      const isSmall = x1 - x0 < MIN_LABEL_WIDTH || y1 - y0 < MIN_LABEL_HEIGHT;

      if (TERRITORY_CODES.has(shape.code)) {
        // Label sits just below the island group.
        const y = y1 + 9;
        labels.push({ code: shape.code, regionId: shape.regionId, x: cx, y, anchor: 'middle', leader: { x1: cx, y1: cy, x2: cx, y2: y - 5 } });
      } else if (isSmall) {
        eastCallouts.push({ shape, cx, cy });
      } else {
        labels.push({ code: shape.code, regionId: shape.regionId, x: cx, y: cy, anchor: 'middle', leader: null });
      }
    }

    // Stack remaining small-state callouts in a column past the region's east edge.
    const columnX = regionMaxX + 14;
    let lastY = -Infinity;
    for (const { shape, cx, cy } of eastCallouts.sort((a, b) => a.cy - b.cy)) {
      const y = Math.max(cy, lastY + CALLOUT_LINE_HEIGHT);
      lastY = y;
      labels.push({ code: shape.code, regionId: shape.regionId, x: columnX, y, anchor: 'start', leader: { x1: cx, y1: cy, x2: columnX - 2, y2: y } });
    }
    return labels;
  }

  /** Recolors existing paths in place so the drawn map is never torn down. */
  private updateFills(animate: boolean): void {
    const colors = this.stateColors ?? {};
    const paths = d3.select(this.svgRef.nativeElement).selectAll<SVGPathElement, StateShape>('path');
    const fill = (s: StateShape) => colors[s.code] ?? DEFAULT_STATE_COLOR;
    if (animate) {
      paths.transition().duration(TRANSITION_MS).attr('fill', fill);
    } else {
      paths.attr('fill', fill);
    }
  }

  private updateDimming(): void {
    const active = this.hoveredRegionId ?? this.selectedRegionId;
    d3.select(this.svgRef.nativeElement)
      .selectAll<SVGPathElement, StateShape>('path')
      .classed('us-map__state--dimmed', (s) => !!active && s.regionId !== active)
      .classed('us-map__state--selected', (s) => !!s.regionId && s.regionId === this.selectedRegionId);
    d3.select(this.svgRef.nativeElement)
      .selectAll<SVGTextElement, StateLabel>('text.us-map__label')
      .classed('us-map__label--dimmed', (l) => !!active && l.regionId !== active);
  }

  private onStateClick(shape: StateShape): void {
    this.stateClick.emit(shape.code);
    this.stateClicked.emit({ code: shape.code, name: shape.name, regionId: shape.regionId });
    this.toggleRegion(shape.regionId);
  }
}
