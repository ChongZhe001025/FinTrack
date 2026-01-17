import axios from 'axios';
import type { YearlyReportResponse } from '../types/report';

export async function getYearlyReport(year?: number) {
  const res = await axios.get<YearlyReportResponse>('/api/v1/reports/yearly', {
    params: year ? { year } : undefined,
  });
  return res.data;
}
