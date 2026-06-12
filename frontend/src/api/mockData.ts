// =============================================================================
// MOCK DATA  —  seeded from the user's Excel screenshots
// =============================================================================
// Lets the entire UI run and look real before the FastAPI backend is wired up.
// Swap REAL endpoints in by flipping USE_MOCKS in api/client.ts to false.

import type {
  Block,
  LineItem,
  PaymentSource,
  IncomeSource,
  MatrixResponse,
} from '@/types';

export const mockBlocks: Block[] = [
  { id: 1, name: 'Mandatory', type: 'EXPENSE', sortOrder: 0 },
  { id: 2, name: 'Add On', type: 'EXPENSE', sortOrder: 1 },
  { id: 3, name: 'Self Help', type: 'EXPENSE', sortOrder: 2 },
  { id: 4, name: 'Transport', type: 'EXPENSE', sortOrder: 3 },
  { id: 5, name: 'Junk', type: 'EXPENSE', sortOrder: 4 },
  { id: 6, name: 'Invest Block', type: 'INVESTMENT', sortOrder: 5 },
];

export const mockLineItems: LineItem[] = [
  // Mandatory
  { id: 1, blockId: 1, name: 'Home', sortOrder: 0 },
  { id: 2, blockId: 1, name: 'Rent', sortOrder: 1 },
  { id: 3, blockId: 1, name: 'Cook', sortOrder: 2 },
  { id: 4, blockId: 1, name: 'EB', sortOrder: 3 },
  { id: 5, blockId: 1, name: 'Gas Cylinder', sortOrder: 4 },
  // Add On
  { id: 6, blockId: 2, name: 'Tour', sortOrder: 0 },
  { id: 7, blockId: 2, name: 'Local Treks', sortOrder: 1 },
  { id: 8, blockId: 2, name: 'Hospital', sortOrder: 2 },
  { id: 9, blockId: 2, name: 'Marriage', sortOrder: 3 },
  // Self Help
  { id: 10, blockId: 3, name: 'Courses / Books', sortOrder: 0 },
  { id: 11, blockId: 3, name: 'Doctor', sortOrder: 1 },
  { id: 12, blockId: 3, name: 'Medics', sortOrder: 2 },
  // Transport
  { id: 13, blockId: 4, name: 'Petrol', sortOrder: 0 },
  { id: 14, blockId: 4, name: 'Cab', sortOrder: 1 },
  { id: 15, blockId: 4, name: 'Bus/Train/Metro', sortOrder: 2 },
  // Junk
  { id: 16, blockId: 5, name: 'Hotel', sortOrder: 0 },
  { id: 17, blockId: 5, name: 'Snacks', sortOrder: 1 },
  { id: 18, blockId: 5, name: 'Food Delivery', sortOrder: 2 },
  { id: 19, blockId: 5, name: 'OTT Subscription', sortOrder: 3 },
  // Invest Block
  { id: 20, blockId: 6, name: 'Stocks', sortOrder: 0 },
  { id: 21, blockId: 6, name: 'Mutual Funds', sortOrder: 1 },
  { id: 22, blockId: 6, name: 'T-Bill / Emergency', sortOrder: 2 },
];

export const mockPaymentSources: PaymentSource[] = [
  { id: 1, name: 'Credit Card', sortOrder: 0 },
  { id: 2, name: 'Debit Card', sortOrder: 1 },
  { id: 3, name: 'Cash', sortOrder: 2 },
  { id: 4, name: 'UPI', sortOrder: 3 },
];

export const mockIncomeSources: IncomeSource[] = [
  { id: 1, name: 'Salary', sortOrder: 0 },
  { id: 2, name: 'Reimbursements', sortOrder: 1 },
  { id: 3, name: 'Other', sortOrder: 2 },
];

const MONTHS = ['2024-12', '2025-01', '2025-02', '2025-03'];

// Helper to build a cells record quickly: [dec, jan, feb, mar]
const cells = (...vals: number[]): Record<string, number> =>
  Object.fromEntries(MONTHS.map((m, i) => [m, vals[i] ?? 0]));

export const mockMatrix: MatrixResponse = {
  months: MONTHS,
  blocks: [
    {
      blockId: 1,
      blockName: 'Mandatory',
      blockType: 'EXPENSE',
      rows: [
        { lineItemId: 1, lineItemName: 'Home', cells: cells(0, 15000, 10000, 15000) },
        { lineItemId: 2, lineItemName: 'Rent', cells: cells(26000, 26000, 26000, 26000) },
        { lineItemId: 3, lineItemName: 'Cook', cells: cells(6000, 1500, 6000, 0) },
        { lineItemId: 4, lineItemName: 'EB', cells: cells(0, 0, 88, 855) },
        { lineItemId: 5, lineItemName: 'Gas Cylinder', cells: cells(0, 0, 0, 0) },
      ],
      subtotals: cells(32000, 42500, 42088, 41855),
    },
    {
      blockId: 2,
      blockName: 'Add On',
      blockType: 'EXPENSE',
      rows: [
        { lineItemId: 6, lineItemName: 'Tour', cells: cells(6205, 25175, 8420, 0) },
        { lineItemId: 7, lineItemName: 'Local Treks', cells: cells(0, 2015, 0, 0) },
        { lineItemId: 8, lineItemName: 'Hospital', cells: cells(0, 0, 0, 10000) },
        { lineItemId: 9, lineItemName: 'Marriage', cells: cells(13722, 2667, 2170, 1200) },
      ],
      subtotals: cells(19927, 29857, 10590, 11200),
    },
    {
      blockId: 3,
      blockName: 'Self Help',
      blockType: 'EXPENSE',
      rows: [
        { lineItemId: 10, lineItemName: 'Courses / Books', cells: cells(230, 0, 2411, 0) },
        { lineItemId: 11, lineItemName: 'Doctor', cells: cells(0, 2532, 1200, 256) },
        { lineItemId: 12, lineItemName: 'Medics', cells: cells(0, 2328, 2178, 630) },
      ],
      subtotals: cells(230, 4860, 5789, 886),
    },
    {
      blockId: 4,
      blockName: 'Transport',
      blockType: 'EXPENSE',
      rows: [
        { lineItemId: 13, lineItemName: 'Petrol', cells: cells(210, 580, 440, 2089) },
        { lineItemId: 14, lineItemName: 'Cab', cells: cells(565, 2248, 746, 1840) },
        { lineItemId: 15, lineItemName: 'Bus/Train/Metro', cells: cells(190, 1460, 1270, 382) },
      ],
      subtotals: cells(965, 4288, 2456, 4311),
    },
    {
      blockId: 5,
      blockName: 'Junk',
      blockType: 'EXPENSE',
      rows: [
        { lineItemId: 16, lineItemName: 'Hotel', cells: cells(0, 920, 0, 613) },
        { lineItemId: 17, lineItemName: 'Snacks', cells: cells(0, 180, 118, 291) },
        { lineItemId: 18, lineItemName: 'Food Delivery', cells: cells(0, 0, 0, 712) },
        { lineItemId: 19, lineItemName: 'OTT Subscription', cells: cells(200, 500, 0, 3182) },
      ],
      subtotals: cells(200, 1600, 118, 4798),
    },
    {
      blockId: 6,
      blockName: 'Invest Block',
      blockType: 'INVESTMENT',
      rows: [
        { lineItemId: 20, lineItemName: 'Stocks', cells: cells(0, 0, 0, 0) },
        { lineItemId: 21, lineItemName: 'Mutual Funds', cells: cells(0, 0, 0, 0) },
        { lineItemId: 22, lineItemName: 'T-Bill / Emergency', cells: cells(0, 0, 0, 0) },
      ],
      subtotals: cells(0, 0, 0, 0),
    },
  ],
  summary: {
    totalIncome:      cells(138140, 117400, 108020, 115917),
    totalExpenditure: cells(53322, 83105, 61041, 63050),
    balance:          cells(84818, 34295, 46979, 52867),
    totalInvestments: cells(0, 0, 0, 0),
    liquidSavings:    cells(84818, 34295, 46979, 52867),
  },
  remarks: {
    '2025-02': 'Bloom in Green - 6121\nNew Year n Hyd - 4682\nMumbai - 19045\n\nTour n Travel ~ 30k\nACT - 3182',
    '2025-03': 'Unplanned or Shot up things\nValentines - 4.9k\nAirtel - 3.6k\nLinkedIN - 2.2k\nMedics - 2.2k\nJan Grocery - 5.3k',
  },
};
