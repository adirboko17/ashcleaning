export type UserRole = 'admin' | 'employee' | 'client';

export interface User {
  id: string;
  phone_number: string;
  role: UserRole;
  full_name: string;
  /**
   * Defaults to true in DB.
   * Optional for backwards compatibility while migrations roll out.
   */
  is_active?: boolean;
  created_at?: string;
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  client_id: string;
  created_at?: string;
}

export interface Job {
  id: string;
  branch_id: string;
  employee_id: string;
  status: 'pending' | 'completed';
  scheduled_date: string;
  completed_date?: string;
  receipt_url?: string;
  note?: string;
  created_at?: string;
}