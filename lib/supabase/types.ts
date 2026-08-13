export type AppointmentStatus =
  | 'SOLICITADA'
  | 'ESPERANDO_ANTICIPO'
  | 'CONFIRMADA'
  | 'COMPLETADA'
  | 'CANCELADA'
  | 'NO_ASISTIO'
  | 'EXPIRADA';

export interface Service {
  id: string;
  name: string;
  description: string | null;
  duration_min: number;
  buffer_min: number;
  price: number | null;
  deposit_amount: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  birthday: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Availability {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  active: boolean;
}

export interface BlockedSlot {
  id: string;
  start_at: string;
  end_at: string;
  reason: string | null;
  created_at: string;
}

export interface Appointment {
  id: string;
  client_id: string;
  service_id: string;
  status: AppointmentStatus;
  start_time: string;
  duration_min: number;
  buffer_min: number;
  end_time: string;
  requested_name: string;
  client_note: string | null;
  reject_reason: string | null;
  expires_at: string | null;
  deposit_received_amount: number | null;
  charged_amount: number | null;
  payment_method: string | null;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  expense_date: string;
  category: string;
  description: string | null;
  amount: number;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyReward {
  id: string;
  client_id: string;
  discount_percent: number;
  earned_at: string;
  source_appointment_id: string | null;
  used_at: string | null;
  used_appointment_id: string | null;
  created_at: string;
}
