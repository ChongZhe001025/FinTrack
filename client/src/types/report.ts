export type MonthAmount = {
  month: number;
  amount: number;
};

export type YearlySummary = {
  totalExpense: number;
  totalIncome: number;
  net: number;
  avgMonthlyExpense: number;
  maxExpenseMonth: MonthAmount;
  minExpenseMonth: MonthAmount;
};

export type YearlyMonthly = {
  month: number;
  expense: number;
  income: number;
  net: number;
};

export type YearlyByCategory = {
  categoryId: string;
  categoryName: string;
  total: number;
  percent: number;
  count: number;
  avgMonthly: number;
};

export type YearlyReportResponse = {
  year: number;
  summary: YearlySummary;
  monthly: YearlyMonthly[];
  byCategory: YearlyByCategory[];
};
