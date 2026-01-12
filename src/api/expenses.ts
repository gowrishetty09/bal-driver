import { apiClient } from './client';

export type DriverExpenseTypeInput = 'fuel' | 'toll' | 'other';

export type DriverExpenseCreatePayload = {
    expenseType: DriverExpenseTypeInput;
    amount: number;
    description?: string;
    date: string; // ISO
};

export type ExpenseType = 'FUEL' | 'TOLL' | 'OTHER';
export type ExpenseStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type Expense = {
    id: string;
    driverId: string;
    expenseType: ExpenseType;
    amount: number;
    description?: string | null;
    date: string;
    status: ExpenseStatus;
    adminComment?: string | null;
    createdAt: string;
    updatedAt: string;
};

export const submitDriverExpense = async (payload: DriverExpenseCreatePayload): Promise<Expense> => {
    const response = await apiClient.post<Expense>('/driver/expenses', payload);
    return response.data;
};

export const listDriverExpenses = async (): Promise<Expense[]> => {
    const response = await apiClient.get<{ data: Expense[]; meta: { total: number; limit: number; offset: number } }>('/driver/expenses');
    return response.data.data;
};
