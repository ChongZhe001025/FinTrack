const getTodayMonth = () => new Date().toISOString().slice(0, 7);

let selectedMonth: string | null = null;

export const getSelectedMonth = () => selectedMonth ?? getTodayMonth();

export const setSelectedMonth = (month: string) => {
  selectedMonth = month;
};
