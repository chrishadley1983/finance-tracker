import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import type { Database } from '../lib/supabase/database.types';

// ============ DATA NORMALIZATION MAPPINGS ============
// Maps spreadsheet values to canonical database values

const CATEGORY_NORMALIZATION: Record<string, string> = {
  // Mapping sheet -> Transaction categories
  'Car Running Costs': 'Car running costs',
  'Child & Dependent Expenses': 'Child & dependent expenses',
  'Household Insurance': 'Household insurance',
  'Bills and utilities': 'Bills',
  'mortgages': 'Mortgage',
  'House Insurance': 'Household insurance',
  'Eating Out': 'Eating out',
  'Gift In': 'Gift in',
  'Home Improvement': 'Home improvement',
  'Personal Care': 'Personal care',
  // Budget sheet -> Transaction categories
  'Car Servicing': 'Car running costs',
  'Childcare': 'Child & dependent expenses',
  'Restaurants': 'Eating out',
  'Food Shopping': 'Groceries',
  'House Upkeep': 'Home maintenance',
  'Mortgage': 'Mortgage',
  'Cleaner': 'cleaner',
  'Donations': 'Charitable giving',
  'Gym and Sports': 'Sport + Gym',
  'Mobile Phone': 'Telephone & mobile',
  'Sky Broadband': 'TV & internet',
  'Activities': 'Entertainment',
  'Clothing': 'Clothing & shoes',
  'Drinks': 'Coffee',
  'Car Tax': 'Car running costs',
  'Pension / Shares': 'Other income',
};

const ACCOUNT_NORMALIZATION: Record<string, string> = {
  'HADLEY,C J/MR': 'Hadley C PRN',
};

// Budget rows to skip (headers, totals, etc.)
const BUDGET_SKIP_PATTERNS = ['TOTAL', 'Planned', 'Income Category', 'Expense Category', 'Car Tax', 'Drinks', 'Work Food'];

function normalizeCategory(name: string): string {
  const trimmed = name.trim();
  return CATEGORY_NORMALIZATION[trimmed] || trimmed;
}

function normalizeAccount(name: string): string {
  const trimmed = name.trim();
  return ACCOUNT_NORMALIZATION[trimmed] || trimmed;
}

function shouldSkipBudgetRow(categoryName: string): boolean {
  const upper = categoryName.toUpperCase();
  return BUDGET_SKIP_PATTERNS.some(pattern => upper.includes(pattern.toUpperCase()));
}

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

// Type definitions for spreadsheet data
interface TransactionRow {
  DATE: number | string;
  AMOUNT: number;
  DESCRIPTION: string;
  CATEGORY: string;
  'CATEGORY GROUP': string;
  ACCOUNT: string;
  NOTES?: string;
}

// 2023 Transactions sheet has different column names (title case instead of uppercase)
interface Transaction2023Row {
  Account: string;
  Date: number | string;
  'Original Date'?: number | string;
  Description: string;
  'Original Description'?: string;
  Amount: number;
  Currency?: string;
  Category: string;
  __EMPTY?: string; // "unbudgeted" flag
}

interface MappingRow {
  'Spreadsheet mapping': string;
  'MoneyHub Level 2': string;
  Type?: string;
}

interface WealthRow {
  Wealth: number | string;
  'CH ACN Pens'?: number;
  'Chris SIPP'?: number;
  'AH Pension'?: number;
  'CH ISA'?: number;
  'AH ISA'?: number;
  'Bus Savings'?: number;
  'Other Savings'?: number;
  'ACN Shares'?: number;
  'Cash Position'?: number;
  Mortgage?: number;
  'House Net Worth'?: number;
}

// Helper to convert Excel date serial to JS Date
function excelDateToJSDate(serial: number): Date {
  const utcDays = Math.floor(serial - 25569);
  return new Date(utcDays * 86400 * 1000);
}

function formatDate(value: number | string | Date): string {
  let date: Date;
  if (typeof value === 'number') {
    date = excelDateToJSDate(value);
  } else if (typeof value === 'string') {
    date = new Date(value);
  } else {
    date = value;
  }
  return date.toISOString().split('T')[0];
}

// Maps to store created IDs
const accountMap = new Map<string, string>();
const categoryMap = new Map<string, string>();

// Account type mapping based on known accounts
function getAccountType(name: string): Database['public']['Enums']['account_type'] {
  const lower = name.toLowerCase();
  if (lower.includes('pension') || lower.includes('sipp') || lower.includes('prn') || lower.includes('prc') || lower.includes('acn pens')) {
    return 'pension';
  }
  if (lower.includes('isa')) {
    return 'isa';
  }
  if (lower.includes('savings') || lower.includes('bus savings') || lower.includes('other savings')) {
    return 'savings';
  }
  if (lower.includes('shares') || lower.includes('investment')) {
    return 'investment';
  }
  if (lower.includes('mortgage') || lower.includes('house') || lower.includes('property')) {
    return 'property';
  }
  if (lower.includes('current') || lower.includes('cash') || lower.includes('credit card') || lower.includes('global money')) {
    return 'current';
  }
  return 'current'; // default
}

async function importAccounts(workbook: XLSX.WorkBook): Promise<void> {
  console.log('\n=== Importing Accounts ===');

  const accounts = new Set<string>();

  // Get accounts from Latest Transactions
  const txSheet = workbook.Sheets['Latest Transactions'];
  if (txSheet) {
    const txData = XLSX.utils.sheet_to_json<TransactionRow>(txSheet);
    txData.forEach(row => {
      if (row.ACCOUNT) accounts.add(normalizeAccount(row.ACCOUNT));
    });
  }

  // Get accounts from 2023 Transactions (uses different column names)
  const tx2023Sheet = workbook.Sheets['2023 Transactions'];
  if (tx2023Sheet) {
    const tx2023Data = XLSX.utils.sheet_to_json<Transaction2023Row>(tx2023Sheet);
    tx2023Data.forEach(row => {
      if (row.Account) accounts.add(normalizeAccount(row.Account));
    });
  }

  // Add wealth tracker accounts
  const wealthAccounts = [
    'CH ACN Pens', 'Chris SIPP', 'AH Pension', 'CH ISA', 'AH ISA',
    'Bus Savings', 'Other Savings', 'ACN Shares', 'Cash Position',
    'Mortgage', 'House Net Worth'
  ];
  wealthAccounts.forEach(a => accounts.add(a));

  // Add additional accounts that may not appear in transaction data
  const additionalAccounts = [
    'HSBC Credit Card',
    'HSBC Savings Acc 1',
    'HSBC Global Money Account',
    'Hadley C PRC',
  ];
  additionalAccounts.forEach(a => accounts.add(a));

  console.log(`Found ${accounts.size} unique accounts`);

  let created = 0;
  let errors = 0;

  for (const name of Array.from(accounts)) {
    const accountType = getAccountType(name);
    const provider = name.toLowerCase().includes('hsbc') ? 'HSBC' : 'Manual';

    const { data, error } = await supabase
      .from('accounts')
      .insert({
        name,
        type: accountType,
        provider,
        is_active: true,
      })
      .select('id')
      .single();

    if (error) {
      console.error(`  Error creating account "${name}":`, error.message);
      errors++;
    } else if (data) {
      accountMap.set(name, data.id);
      created++;
    }
  }

  console.log(`Created ${created} accounts, ${errors} errors`);
}

async function importCategories(workbook: XLSX.WorkBook): Promise<void> {
  console.log('\n=== Importing Categories ===');

  const categories = new Map<string, string>(); // category -> group

  // Get categories from Latest Transactions
  const txSheet = workbook.Sheets['Latest Transactions'];
  if (txSheet) {
    const txData = XLSX.utils.sheet_to_json<TransactionRow>(txSheet);
    txData.forEach(row => {
      if (row.CATEGORY && row['CATEGORY GROUP']) {
        categories.set(normalizeCategory(row.CATEGORY), row['CATEGORY GROUP'].trim());
      }
    });
  }

  // Get categories from 2023 Transactions (uses different column names, no CATEGORY GROUP)
  const tx2023Sheet = workbook.Sheets['2023 Transactions'];
  if (tx2023Sheet) {
    const tx2023Data = XLSX.utils.sheet_to_json<Transaction2023Row>(tx2023Sheet);
    tx2023Data.forEach(row => {
      if (row.Category) {
        const normalizedCat = normalizeCategory(row.Category);
        // Only add if not already present (Latest Transactions has the group info)
        if (!categories.has(normalizedCat)) {
          categories.set(normalizedCat, 'Uncategorized'); // Default group for 2023-only categories
        }
      }
    });
  }

  console.log(`Found ${categories.size} unique categories`);

  let created = 0;
  let errors = 0;
  let order = 0;

  for (const [name, groupName] of Array.from(categories.entries())) {
    // Determine if this is an income category
    const isIncome = groupName.toLowerCase().includes('income') ||
                     name.toLowerCase().includes('salary') ||
                     name.toLowerCase().includes('income');

    const { data, error } = await supabase
      .from('categories')
      .insert({
        name,
        group_name: groupName,
        is_income: isIncome,
        display_order: order++,
      })
      .select('id')
      .single();

    if (error) {
      console.error(`  Error creating category "${name}":`, error.message);
      errors++;
    } else if (data) {
      categoryMap.set(name, data.id);
      created++;
    }
  }

  console.log(`Created ${created} categories, ${errors} errors`);
}

async function importCategoryMappings(workbook: XLSX.WorkBook): Promise<void> {
  console.log('\n=== Importing Category Mappings ===');

  const mappingSheet = workbook.Sheets['Mapping'];
  if (!mappingSheet) {
    console.log('  No Mapping sheet found');
    return;
  }

  const mappingData = XLSX.utils.sheet_to_json<MappingRow>(mappingSheet);
  console.log(`Found ${mappingData.length} mapping rules`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of mappingData) {
    const pattern = row['Spreadsheet mapping']?.trim();
    const rawCategoryName = row['MoneyHub Level 2']?.trim();

    if (!pattern || !rawCategoryName) {
      skipped++;
      continue;
    }

    const categoryName = normalizeCategory(rawCategoryName);
    const categoryId = categoryMap.get(categoryName);
    if (!categoryId) {
      console.log(`  Skipping mapping "${pattern}" - category "${categoryName}" not found`);
      skipped++;
      continue;
    }

    const matchType: Database['public']['Enums']['match_type'] =
      row.Type?.toLowerCase() === 'custom' ? 'exact' : 'contains';

    const { error } = await supabase
      .from('category_mappings')
      .insert({
        pattern,
        category_id: categoryId,
        match_type: matchType,
        confidence: 1.0,
      });

    if (error) {
      console.error(`  Error creating mapping "${pattern}":`, error.message);
      errors++;
    } else {
      created++;
    }
  }

  console.log(`Created ${created} mappings, ${skipped} skipped, ${errors} errors`);
}

// Unified transaction structure for processing
interface UnifiedTransaction {
  date: number | string;
  amount: number;
  description: string;
  account: string;
  category: string | null;
}

async function importTransactions(workbook: XLSX.WorkBook): Promise<void> {
  console.log('\n=== Importing Transactions ===');

  const allTransactions: UnifiedTransaction[] = [];
  const dedupeSet = new Set<string>();

  // Get transactions from Latest Transactions
  const txSheet = workbook.Sheets['Latest Transactions'];
  if (txSheet) {
    const txData = XLSX.utils.sheet_to_json<TransactionRow>(txSheet);
    console.log(`  Latest Transactions: ${txData.length} rows`);
    txData.forEach(row => {
      if (row.DATE && row.AMOUNT !== undefined && row.DESCRIPTION && row.ACCOUNT) {
        allTransactions.push({
          date: row.DATE,
          amount: row.AMOUNT,
          description: row.DESCRIPTION,
          account: row.ACCOUNT,
          category: row.CATEGORY || null,
        });
      }
    });
  }

  // Get transactions from 2023 Transactions (different column names)
  const tx2023Sheet = workbook.Sheets['2023 Transactions'];
  if (tx2023Sheet) {
    const tx2023Data = XLSX.utils.sheet_to_json<Transaction2023Row>(tx2023Sheet);
    console.log(`  2023 Transactions: ${tx2023Data.length} rows`);
    tx2023Data.forEach(row => {
      if (row.Date && row.Amount !== undefined && row.Description && row.Account) {
        allTransactions.push({
          date: row.Date,
          amount: row.Amount,
          description: row.Description,
          account: row.Account,
          category: row.Category || null,
        });
      }
    });
  }

  console.log(`Total: ${allTransactions.length} transactions to process`);

  let created = 0;
  let duplicates = 0;
  let errors = 0;

  // Process in batches of 100 for better performance
  const batchSize = 100;
  const batches: Array<Database['public']['Tables']['transactions']['Insert'][]> = [];
  let currentBatch: Database['public']['Tables']['transactions']['Insert'][] = [];

  for (const row of allTransactions) {
    const date = formatDate(row.date);
    const dedupeKey = `${date}|${row.amount}|${row.description}`;

    if (dedupeSet.has(dedupeKey)) {
      duplicates++;
      continue;
    }
    dedupeSet.add(dedupeKey);

    const accountName = normalizeAccount(row.account);
    const accountId = accountMap.get(accountName);
    if (!accountId) {
      console.log(`  Skipping transaction - account "${accountName}" not found`);
      errors++;
      continue;
    }

    const categoryId = row.category ? categoryMap.get(normalizeCategory(row.category)) : null;

    currentBatch.push({
      date,
      amount: row.amount,
      description: row.description,
      account_id: accountId,
      category_id: categoryId,
      categorisation_source: categoryId ? 'import' : 'manual',
    });

    if (currentBatch.length >= batchSize) {
      batches.push(currentBatch);
      currentBatch = [];
    }
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  console.log(`Processing ${batches.length} batches...`);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const { data, error } = await supabase
      .from('transactions')
      .insert(batch)
      .select('id');

    if (error) {
      console.error(`  Batch ${i + 1} error:`, error.message);
      errors += batch.length;
    } else {
      created += data?.length || 0;
    }

    if ((i + 1) % 10 === 0 || i === batches.length - 1) {
      console.log(`  Processed ${i + 1}/${batches.length} batches...`);
    }
  }

  console.log(`Created ${created} transactions, ${duplicates} duplicates skipped, ${errors} errors`);
}

async function importWealthSnapshots(workbook: XLSX.WorkBook): Promise<void> {
  console.log('\n=== Importing Wealth Snapshots ===');

  const wealthSheet = workbook.Sheets['Wealth Tracker'];
  if (!wealthSheet) {
    console.log('  No Wealth Tracker sheet found');
    return;
  }

  const wealthData = XLSX.utils.sheet_to_json<WealthRow>(wealthSheet);
  console.log(`Found ${wealthData.length} wealth snapshot rows`);

  const accountColumns: Array<keyof WealthRow> = [
    'CH ACN Pens', 'Chris SIPP', 'AH Pension', 'CH ISA', 'AH ISA',
    'Bus Savings', 'Other Savings', 'ACN Shares', 'Cash Position',
    'Mortgage', 'House Net Worth'
  ];

  let created = 0;
  let errors = 0;

  for (const row of wealthData) {
    if (!row.Wealth) continue;

    const date = formatDate(row.Wealth);

    for (const accountCol of accountColumns) {
      const balance = row[accountCol];
      if (balance === undefined || balance === null) continue;

      const accountName = accountCol as string;
      const accountId = accountMap.get(accountName);

      if (!accountId) {
        console.log(`  Skipping snapshot - account "${accountName}" not found`);
        errors++;
        continue;
      }

      const { error } = await supabase
        .from('wealth_snapshots')
        .insert({
          date,
          balance: Number(balance),
          account_id: accountId,
        });

      if (error) {
        // Might be duplicate - that's ok
        if (!error.message.includes('duplicate')) {
          console.error(`  Error creating snapshot for ${accountName}:`, error.message);
          errors++;
        }
      } else {
        created++;
      }
    }
  }

  console.log(`Created ${created} wealth snapshots, ${errors} errors`);
}

async function importFireParameters(workbook: XLSX.WorkBook): Promise<void> {
  console.log('\n=== Importing FIRE Parameters ===');

  const inputsSheet = workbook.Sheets['Inputs'];
  if (!inputsSheet) {
    console.log('  No Inputs sheet found');
    return;
  }

  // FIRE scenarios with their annual spend amounts
  const scenarios = [
    { name: 'FULL', annual_spend: 63000 },
    { name: 'HIGH', annual_spend: 63000 },
    { name: 'MEDIUM', annual_spend: 50000 },
    { name: 'LOW', annual_spend: 35000 },
  ];

  // Default values from spec
  const defaults = {
    withdrawal_rate: 3.5,
    expected_return: 3,
    retirement_age: 50,
    state_pension_age: 67,
    state_pension_amount: 10600,
  };

  let created = 0;
  let errors = 0;

  for (const scenario of scenarios) {
    const { error } = await supabase
      .from('fire_parameters')
      .insert({
        scenario_name: scenario.name,
        annual_spend: scenario.annual_spend,
        withdrawal_rate: defaults.withdrawal_rate,
        expected_return: defaults.expected_return,
        retirement_age: defaults.retirement_age,
        state_pension_age: defaults.state_pension_age,
        state_pension_amount: defaults.state_pension_amount,
      });

    if (error) {
      console.error(`  Error creating FIRE scenario "${scenario.name}":`, error.message);
      errors++;
    } else {
      created++;
    }
  }

  console.log(`Created ${created} FIRE parameter scenarios, ${errors} errors`);
}

async function importBudgets(workbook: XLSX.WorkBook): Promise<void> {
  console.log('\n=== Importing Budgets ===');

  const budget2025Sheet = workbook.Sheets['Budget 2025'];
  if (!budget2025Sheet) {
    console.log('  No Budget 2025 sheet found');
    return;
  }

  interface BudgetRow {
    'MONTH BY MONTH'?: string;
    '__EMPTY'?: number;
  }

  const budgetData = XLSX.utils.sheet_to_json<BudgetRow>(budget2025Sheet);
  console.log(`Found ${budgetData.length} budget rows`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of budgetData) {
    const rawCategoryName = row['MONTH BY MONTH']?.trim();
    const annualAmount = row['__EMPTY'];

    if (!rawCategoryName || !annualAmount) {
      skipped++;
      continue;
    }

    // Skip header/total rows
    if (shouldSkipBudgetRow(rawCategoryName)) {
      skipped++;
      continue;
    }

    const categoryName = normalizeCategory(rawCategoryName);
    const categoryId = categoryMap.get(categoryName);
    if (!categoryId) {
      console.log(`  Skipping budget - category "${categoryName}" not found`);
      skipped++;
      continue;
    }

    // Create monthly budgets for 2025 (divide annual by 12)
    const monthlyAmount = Math.round(annualAmount / 12 * 100) / 100;

    for (let month = 1; month <= 12; month++) {
      const { error } = await supabase
        .from('budgets')
        .insert({
          category_id: categoryId,
          year: 2025,
          month,
          amount: monthlyAmount,
        });

      if (error) {
        console.error(`  Error creating budget for ${categoryName} month ${month}:`, error.message);
        errors++;
      } else {
        created++;
      }
    }
  }

  console.log(`Created ${created} budget entries, ${skipped} skipped, ${errors} errors`);
}

async function main(): Promise<void> {
  console.log('=== Finance Tracker Spreadsheet Import ===');
  console.log(`Supabase URL: ${supabaseUrl}`);

  const spreadsheetPath = path.join(__dirname, '..', 'data', 'Life Planning V2.xlsx');
  console.log(`\nReading spreadsheet: ${spreadsheetPath}`);

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.readFile(spreadsheetPath);
  } catch (error) {
    console.error('Error reading spreadsheet:', error);
    process.exit(1);
  }

  console.log(`Sheets found: ${workbook.SheetNames.join(', ')}`);

  try {
    // Import in dependency order
    await importAccounts(workbook);
    await importCategories(workbook);
    await importCategoryMappings(workbook);
    await importTransactions(workbook);
    await importWealthSnapshots(workbook);
    await importFireParameters(workbook);
    await importBudgets(workbook);

    console.log('\n=== Import Complete ===');
    console.log(`Accounts: ${accountMap.size}`);
    console.log(`Categories: ${categoryMap.size}`);
  } catch (error) {
    console.error('\nImport failed:', error);
    process.exit(1);
  }
}

main();
