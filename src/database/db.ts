import * as SQLite from 'expo-sqlite';
import { Pet, EmergencyContact, VaccineDeworming, MedicalLog } from '../types/petpass';

const db = SQLite.openDatabaseSync('petpass.db');

export const initDatabase = () => {
  db.execSync(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS pets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      species TEXT NOT NULL,
      breed TEXT,
      birth_date TEXT,
      sex TEXT,
      weight REAL,
      is_sterilized INTEGER DEFAULT 0,
      microchip TEXT,
      allergies TEXT,
      photo_uri TEXT,
      owner_name TEXT,
      owner_phone TEXT,
      owner_rut TEXT,
      owner_address TEXT
    );

    CREATE TABLE IF NOT EXISTS emergency_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pet_id INTEGER NOT NULL,
      vet_name TEXT,
      vet_phone TEXT,
      emergency_clinic_name TEXT,
      emergency_clinic_phone TEXT,
      emergency_address TEXT,
      FOREIGN KEY (pet_id) REFERENCES pets (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS vaccines_deworming (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pet_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      product_name TEXT NOT NULL,
      applied_date TEXT NOT NULL,
      next_due_date TEXT,
      photo_uri TEXT,
      FOREIGN KEY (pet_id) REFERENCES pets (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS medical_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pet_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      notes TEXT,
      dosage_schedule TEXT,
      is_completed INTEGER DEFAULT 0,
      date TEXT NOT NULL,
      photo_uri TEXT,
      FOREIGN KEY (pet_id) REFERENCES pets (id) ON DELETE CASCADE
    );
  `);

  const columns = ['owner_name', 'owner_phone', 'owner_rut', 'owner_address'];
  for (const col of columns) {
    try {
      db.execSync(`ALTER TABLE pets ADD COLUMN ${col} TEXT;`);
    } catch {
      // La columna ya existe
    }
  }
};

// --- MASCOTAS ---
export const getPets = (): Pet[] => {
  return db.getAllSync<Pet>('SELECT * FROM pets ORDER BY id ASC');
};

export const savePet = (pet: Omit<Pet, 'id'>): number => {
  const result = db.runSync(
    `INSERT INTO pets (
      name, species, breed, birth_date, sex, weight, is_sterilized,
      microchip, allergies, photo_uri, owner_name, owner_phone, owner_rut, owner_address
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      pet.name,
      pet.species,
      pet.breed,
      pet.birth_date,
      pet.sex,
      pet.weight,
      pet.is_sterilized,
      pet.microchip,
      pet.allergies,
      pet.photo_uri,
      pet.owner_name,
      pet.owner_phone,
      pet.owner_rut,
      pet.owner_address,
    ]
  );
  return result.lastInsertRowId;
};

export const updatePet = (pet: Pet) => {
  db.runSync(
    `UPDATE pets SET
      name=?, species=?, breed=?, birth_date=?, sex=?, weight=?, is_sterilized=?,
      microchip=?, allergies=?, photo_uri=?, owner_name=?, owner_phone=?, owner_rut=?, owner_address=?
     WHERE id=?`,
    [
      pet.name,
      pet.species,
      pet.breed,
      pet.birth_date,
      pet.sex,
      pet.weight,
      pet.is_sterilized,
      pet.microchip,
      pet.allergies,
      pet.photo_uri,
      pet.owner_name,
      pet.owner_phone,
      pet.owner_rut,
      pet.owner_address,
      pet.id,
    ]
  );
};

export const deletePet = (id: number) => {
  db.runSync('DELETE FROM pets WHERE id = ?', [id]);
};

// --- CONTACTOS DE EMERGENCIA ---
export const getEmergencyContact = (petId: number): EmergencyContact | null => {
  return db.getFirstSync<EmergencyContact>(
    'SELECT * FROM emergency_contacts WHERE pet_id = ?',
    [petId]
  );
};

export const saveOrUpdateEmergency = (contact: Omit<EmergencyContact, 'id'>) => {
  const existing = getEmergencyContact(contact.pet_id);
  if (existing) {
    db.runSync(
      `UPDATE emergency_contacts SET vet_name=?, vet_phone=?, emergency_clinic_name=?, emergency_clinic_phone=?, emergency_address=?
       WHERE pet_id=?`,
      [
        contact.vet_name,
        contact.vet_phone,
        contact.emergency_clinic_name,
        contact.emergency_clinic_phone,
        contact.emergency_address,
        contact.pet_id,
      ]
    );
  } else {
    db.runSync(
      `INSERT INTO emergency_contacts (pet_id, vet_name, vet_phone, emergency_clinic_name, emergency_clinic_phone, emergency_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        contact.pet_id,
        contact.vet_name,
        contact.vet_phone,
        contact.emergency_clinic_name,
        contact.emergency_clinic_phone,
        contact.emergency_address,
      ]
    );
  }
};

// --- VACUNAS Y ANTIPARASITARIOS ---
export const getVaccinesDeworming = (petId: number): VaccineDeworming[] => {
  return db.getAllSync<VaccineDeworming>(
    'SELECT * FROM vaccines_deworming WHERE pet_id = ? ORDER BY id DESC',
    [petId]
  );
};

export const addVaccineDeworming = (item: Omit<VaccineDeworming, 'id'>) => {
  db.runSync(
    `INSERT INTO vaccines_deworming (pet_id, type, product_name, applied_date, next_due_date, photo_uri)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [item.pet_id, item.type, item.product_name, item.applied_date, item.next_due_date, item.photo_uri]
  );
};

export const updateVaccineDeworming = (item: VaccineDeworming) => {
  db.runSync(
    `UPDATE vaccines_deworming SET type=?, product_name=?, applied_date=?, next_due_date=?, photo_uri=?
     WHERE id=?`,
    [item.type, item.product_name, item.applied_date, item.next_due_date, item.photo_uri, item.id]
  );
};

export const deleteVaccineDeworming = (id: number) => {
  db.runSync('DELETE FROM vaccines_deworming WHERE id = ?', [id]);
};

// --- BITÁCORA MÉDICA Y TRATAMIENTOS ---
export const getMedicalLogs = (petId: number): MedicalLog[] => {
  return db.getAllSync<MedicalLog>(
    'SELECT * FROM medical_logs WHERE pet_id = ? ORDER BY id DESC',
    [petId]
  );
};

export const addMedicalLog = (log: Omit<MedicalLog, 'id'>) => {
  db.runSync(
    `INSERT INTO medical_logs (pet_id, category, title, notes, dosage_schedule, is_completed, date, photo_uri)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      log.pet_id,
      log.category,
      log.title,
      log.notes,
      log.dosage_schedule,
      log.is_completed,
      log.date,
      log.photo_uri,
    ]
  );
};

export const updateMedicalLog = (log: MedicalLog) => {
  db.runSync(
    `UPDATE medical_logs SET category=?, title=?, notes=?, dosage_schedule=?, date=?, photo_uri=?
     WHERE id=?`,
    [log.category, log.title, log.notes, log.dosage_schedule, log.date, log.photo_uri, log.id]
  );
};

export const deleteMedicalLog = (id: number) => {
  db.runSync('DELETE FROM medical_logs WHERE id = ?', [id]);
};

export const toggleMedicalLogStatus = (id: number, isCompleted: number) => {
  db.runSync('UPDATE medical_logs SET is_completed = ? WHERE id = ?', [isCompleted, id]);
};