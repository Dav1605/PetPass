export interface Pet {
  id: number;
  name: string;
  species: string; // 'Perro' | 'Gato'
  breed: string;
  birth_date: string;
  sex: string; // 'Macho' | 'Hembra'
  weight: number;
  is_sterilized: number; // 0 = No, 1 = Sí
  microchip: string;
  allergies: string;
  photo_uri: string | null;
  owner_name: string;
  owner_phone: string;
  owner_rut: string;
  owner_address: string;
  cloud_id?: string | null;
}

export interface EmergencyContact {
  id: number;
  pet_id: number;
  vet_name: string;
  vet_phone: string;
  emergency_clinic_name: string;
  emergency_clinic_phone: string;
  emergency_address: string;
}

export interface VaccineDeworming {
  id: number;
  pet_id: number;
  type: 'vaccine' | 'deworming';
  product_name: string;
  applied_date: string;
  next_due_date: string;
  photo_uri: string | null;
}

export interface MedicalLog {
  id: number;
  pet_id: number;
  category: 'consultation' | 'medication' | 'symptom';
  title: string;
  notes: string;
  dosage_schedule: string;
  is_completed: number; // 0 = Activo, 1 = Completado
  date: string;
  photo_uri: string | null;
}