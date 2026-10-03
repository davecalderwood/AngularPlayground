export interface UsRegion {
  id: string;
  name: string;
  color: string;
  states: string[];
  /** Pixel offset applied to the region's <g> to pull regions apart. */
  shift: { x: number; y: number };
}

export const US_STATE_NAME_TO_CODE: Readonly<Record<string, string>> = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA',
  Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE', 'District of Columbia': 'DC',
  Florida: 'FL', Georgia: 'GA', Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL',
  Indiana: 'IN', Iowa: 'IA', Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA',
  Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN',
  Mississippi: 'MS', Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK',
  Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT',
  Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV', Wisconsin: 'WI',
  Wyoming: 'WY',
  'Puerto Rico': 'PR', 'U.S. Virgin Islands': 'VI', Guam: 'GU',
  'American Samoa': 'AS', 'Northern Mariana Islands': 'MP',
};

export const US_STATE_CODE_TO_NAME: Readonly<Record<string, string>> = Object.entries(
  US_STATE_NAME_TO_CODE
).reduce((acc, [name, code]) => ({ ...acc, [code]: name }), {});

/** FIPS ids used by the us-atlas TopoJSON, keyed by 2-letter code. */
export const US_STATE_CODE_TO_FIPS: Readonly<Record<string, string>> = {
  AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06', CO: '08', CT: '09', DE: '10',
  DC: '11', FL: '12', GA: '13', HI: '15', ID: '16', IL: '17', IN: '18', IA: '19',
  KS: '20', KY: '21', LA: '22', ME: '23', MD: '24', MA: '25', MI: '26', MN: '27',
  MS: '28', MO: '29', MT: '30', NE: '31', NV: '32', NH: '33', NJ: '34', NM: '35',
  NY: '36', NC: '37', ND: '38', OH: '39', OK: '40', OR: '41', PA: '42', RI: '44',
  SC: '45', SD: '46', TN: '47', TX: '48', UT: '49', VT: '50', VA: '51', WA: '53',
  WV: '54', WI: '55', WY: '56',
  AS: '60', GU: '66', MP: '69', PR: '72', VI: '78',
};

export const US_FIPS_TO_STATE_CODE: Readonly<Record<string, string>> = Object.entries(
  US_STATE_CODE_TO_FIPS
).reduce((acc, [code, fips]) => ({ ...acc, [fips]: code }), {});

export const DEFAULT_STATE_COLOR = '#e0e0e0';

export const DEFAULT_US_REGIONS: readonly UsRegion[] = [
  {
    id: 'west', name: 'West', color: '#4e79a7', shift: { x: -14, y: 0 },
    states: ['WA', 'OR', 'CA', 'NV', 'ID', 'MT', 'WY', 'UT', 'CO', 'AK', 'HI'],
  },
  {
    id: 'southwest', name: 'Southwest', color: '#f28e2b', shift: { x: -4, y: 12 },
    states: ['AZ', 'NM', 'TX', 'OK'],
  },
  {
    id: 'midwest', name: 'Midwest', color: '#59a14f', shift: { x: 0, y: -8 },
    states: ['ND', 'SD', 'NE', 'KS', 'MN', 'IA', 'MO', 'WI', 'IL', 'MI', 'IN', 'OH'],
  },
  {
    id: 'southeast', name: 'Southeast', color: '#e15759', shift: { x: 10, y: 10 },
    states: ['AR', 'LA', 'MS', 'AL', 'GA', 'FL', 'TN', 'KY', 'SC', 'NC', 'VA', 'WV'],
  },
  {
    id: 'northeast', name: 'Northeast', color: '#b07aa1', shift: { x: 18, y: -6 },
    states: ['ME', 'NH', 'VT', 'MA', 'RI', 'CT', 'NY', 'NJ', 'PA', 'DE', 'MD', 'DC'],
  },
  {
    id: 'territories', name: 'Territories', color: '#76b7b2', shift: { x: 0, y: 14 },
    states: ['PR', 'VI', 'GU', 'AS', 'MP'],
  },
];
