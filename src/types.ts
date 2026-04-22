export interface Doctor {
  email: string;
  role: "admin" | "doctor";
}

export interface Patient {
  id: string; // Document ID
  full_name: string;
  phone_number: string;
  address: string;
  medical_history: string;
  created_at: number;
  created_by: string;
  date_of_birth?: string;
  is_favorite?: boolean;
  last_visit_date?: number;
  history_images?: string[];
}

export interface Visit {
  id: string; // Document ID
  visit_date: number;
  diagnosis: string;
  notes: string;
  clinical_images: string[];
  lab_images: string[];
  audio_records: string[];
  prescription_image: string | null;
  created_by: string;
  next_followup_date?: string | null;
  note_images?: string[];
}
