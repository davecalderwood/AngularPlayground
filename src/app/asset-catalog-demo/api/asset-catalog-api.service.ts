import { Injectable } from '@angular/core';
import { Observable, of, timer } from 'rxjs';
import { delay, filter, map, switchMap, takeWhile } from 'rxjs/operators';
import {
  AssetJobStatus,
  AssetQueryTableRequest,
  AssetRecordDto,
  AssetTableDescItem,
  AssetTableDescResponse,
} from './asset-catalog-api.models';

interface TaxonomyEntry {
  section_id: string;
  section_desc: string;
  category_id: string;
  category_desc: string;
  subcategory_id: string;
  subcategory_desc: string;
  asset_type: string;
  count: number;
}

const TAXONOMY: TaxonomyEntry[] = [
  { section_id: 'buildings', section_desc: 'Buildings', category_id: 'access-systems', category_desc: 'Access Systems', subcategory_id: 'badge-readers', subcategory_desc: 'Badge Readers', asset_type: 'Card reader', count: 320 },
  { section_id: 'buildings', section_desc: 'Buildings', category_id: 'climate-control', category_desc: 'Climate Control', subcategory_id: 'air-handlers', subcategory_desc: 'Air Handlers', asset_type: 'HVAC', count: 410 },
  { section_id: 'fleet', section_desc: 'Fleet', category_id: 'service-vehicles', category_desc: 'Service Vehicles', subcategory_id: 'light-trucks', subcategory_desc: 'Light Trucks', asset_type: 'Pickup truck', count: 1300 },
  { section_id: 'fleet', section_desc: 'Fleet', category_id: 'service-vehicles', category_desc: 'Service Vehicles', subcategory_id: 'utility-vans', subcategory_desc: 'Utility Vans', asset_type: 'Cargo van', count: 275 },
  { section_id: 'fleet', section_desc: 'Fleet', category_id: 'safety-equipment', category_desc: 'Safety Equipment', subcategory_id: 'fire-extinguishers', subcategory_desc: 'Fire Extinguishers', asset_type: 'Fire safety', count: 190 },
];

const SITES = ['North Campus', 'West Campus', 'South Campus'];
const CONDITIONS = ['Operational', 'Service due', 'Inspection due'];

const ALL_RECORDS: AssetRecordDto[] = TAXONOMY.flatMap(entry =>
  Array.from({ length: entry.count }, (_, index) => ({
    asset_id: `${entry.subcategory_id}-${index + 1}`,
    asset_name: `${entry.subcategory_desc} ${String(index + 1).padStart(3, '0')}`,
    asset_type: entry.asset_type,
    site_name: SITES[index % SITES.length],
    condition_desc: CONDITIONS[index % CONDITIONS.length],
    section_id: entry.section_id,
    category_id: entry.category_id,
    subcategory_id: entry.subcategory_id,
  }))
);

// Simulated backend; replace each method body with an HttpClient call.
@Injectable({ providedIn: 'root' })
export class AssetCatalogApiService {
  private readonly jobs = new Map<string, { query: string; polls: number }>();

  startSearch(query: string): Observable<string> {
    const jobId = crypto.randomUUID();
    this.jobs.set(jobId, { query, polls: 0 });
    return of(jobId).pipe(delay(300));
  }

  pollUntilFinished(jobId: string): Observable<AssetJobStatus> {
    return timer(0, 400).pipe(
      switchMap(() => this.getJobStatus(jobId)),
      takeWhile(status => status !== 'done', true),
      filter(status => status === 'done')
    );
  }

  getTableDesc(jobId: string): Observable<AssetTableDescResponse> {
    const matches = this.matchingRecords(jobId);
    const response: AssetTableDescResponse = {};

    for (const entry of TAXONOMY) {
      const count = matches.filter(record => record.subcategory_id === entry.subcategory_id).length;
      if (count === 0) {
        continue;
      }

      const item: AssetTableDescItem = {
        section_id: entry.section_id,
        section_desc: entry.section_desc,
        category_id: entry.category_id,
        parent_desc: entry.category_desc,
        subcategory_id: entry.subcategory_id,
        desc: entry.subcategory_desc,
        count,
      };
      (response[entry.category_desc] ??= []).push(item);
    }

    return of(response).pipe(delay(500));
  }

  queryTable(jobId: string, request: AssetQueryTableRequest): Observable<AssetRecordDto[]> {
    let records = this.matchingRecords(jobId);

    const filterMatch = /^(\w+)\s*=\s*'([^']*)'$/.exec(request.filter_by.trim());
    if (filterMatch) {
      const [, column, value] = filterMatch;
      records = records.filter(record => (record as unknown as Record<string, string>)[column] === value);
    }

    const [orderColumn, orderDirection] = request.order_by.split(' ');
    if (orderColumn) {
      const factor = orderDirection === 'desc' ? -1 : 1;
      records = [...records].sort((left, right) =>
        String((left as unknown as Record<string, string>)[orderColumn])
          .localeCompare(String((right as unknown as Record<string, string>)[orderColumn])) * factor
      );
    }

    return of(records.slice(request.offset, request.offset + request.page_size)).pipe(delay(400));
  }

  private getJobStatus(jobId: string): Observable<AssetJobStatus> {
    const job = this.jobs.get(jobId);
    if (job) {
      job.polls++;
    }
    return of<AssetJobStatus>((job?.polls ?? 0) >= 2 ? 'done' : 'processing').pipe(delay(250));
  }

  private matchingRecords(jobId: string): AssetRecordDto[] {
    const query = (this.jobs.get(jobId)?.query ?? '').trim().toLocaleLowerCase();
    if (!query) {
      return ALL_RECORDS;
    }

    return ALL_RECORDS.filter(record =>
      `${record.asset_name} ${record.asset_type} ${record.site_name} ${record.condition_desc}`
        .toLocaleLowerCase()
        .includes(query)
    );
  }
}
