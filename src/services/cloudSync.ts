import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { dbCloud, auth } from '../config/firebase';
import {
  getVaccinesDeworming,
  getMedicalLogs,
  getEmergencyContact,
  setPetCloudId,
  upsertCloudPetBundle,
} from '../database/db';
import { Pet } from '../types/petpass';

const generateShareCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Permite sincronizar fotos en base64 o URLs remotas entre Android y iPhone
const getSyncablePhoto = (uri: string | null | undefined): string | null => {
  if (!uri) return null;
  if (uri.startsWith('data:image') || uri.startsWith('http')) {
    return uri;
  }
  return null;
};

export const uploadPetToCloud = async (pet: Pet): Promise<string> => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Debes iniciar sesión en PetPass Cloud primero.');
  }

  const shareCode = (pet.cloud_id || generateShareCode()).toUpperCase();
  const vaccines = getVaccinesDeworming(pet.id);
  const logs = getMedicalLogs(pet.id);
  const emergency = getEmergencyContact(pet.id);

  const payload = {
    shareCode,
    updatedAt: new Date().toISOString(),
    updatedByUid: user.uid,
    updatedByEmail: user.email || '',
    updatedByName: user.displayName || 'Tutor PetPass',
    pet: {
      name: pet.name,
      species: pet.species,
      breed: pet.breed || '',
      birth_date: pet.birth_date || '',
      sex: pet.sex || 'Macho',
      weight: pet.weight || 0,
      is_sterilized: pet.is_sterilized || 0,
      microchip: pet.microchip || '',
      allergies: pet.allergies || '',
      photo_uri: getSyncablePhoto(pet.photo_uri),
      owner_name: pet.owner_name || '',
      owner_phone: pet.owner_phone || '',
      owner_rut: pet.owner_rut || '',
      owner_address: pet.owner_address || '',
    },
    vaccines: vaccines.map((v) => ({
      type: v.type,
      product_name: v.product_name,
      applied_date: v.applied_date,
      next_due_date: v.next_due_date || '',
      photo_uri: getSyncablePhoto(v.photo_uri),
    })),
    logs: logs.map((l) => ({
      category: l.category,
      title: l.title,
      notes: l.notes || '',
      dosage_schedule: l.dosage_schedule || '',
      is_completed: l.is_completed || 0,
      date: l.date,
      photo_uri: getSyncablePhoto(l.photo_uri),
    })),
    emergency: emergency
      ? {
          vet_name: emergency.vet_name || '',
          vet_phone: emergency.vet_phone || '',
          emergency_clinic_name: emergency.emergency_clinic_name || '',
          emergency_clinic_phone: emergency.emergency_clinic_phone || '',
          emergency_address: emergency.emergency_address || '',
        }
      : null,
  };

  await setDoc(doc(dbCloud, 'shared_pets', shareCode), payload, { merge: true });
  setPetCloudId(pet.id, shareCode);

  return shareCode;
};

export const downloadPetFromCloudCode = async (
  rawCode: string
): Promise<{ localPetId: number; petName: string }> => {
  const cleanCode = rawCode.trim().toUpperCase();
  if (cleanCode.length < 4) {
    throw new Error('Ingresa un código válido de 6 caracteres.');
  }

  const snap = await getDoc(doc(dbCloud, 'shared_pets', cleanCode));
  if (!snap.exists()) {
    throw new Error(`No existe ninguna mascota con el código ${cleanCode}.`);
  }

  const data = snap.data();
  const localPetId = upsertCloudPetBundle(
    cleanCode,
    data.pet,
    data.vaccines || [],
    data.logs || [],
    data.emergency || null
  );

  return { localPetId, petName: data.pet?.name || 'Mascota' };
};

// Escucha cambios en tiempo real desde Firebase y actualiza el teléfono automáticamente
export const subscribeToSharedPet = (
  cloudCode: string,
  onRemoteUpdate: (localPetId: number) => void
) => {
  const cleanCode = cloudCode.trim().toUpperCase();
  return onSnapshot(doc(dbCloud, 'shared_pets', cleanCode), (snap) => {
    if (!snap.exists()) return;
    // Ignorar escrituras locales pendientes del propio teléfono para evitar parpadeos
    if (snap.metadata.hasPendingWrites) return;

    const data = snap.data();
    if (data?.pet) {
      const localPetId = upsertCloudPetBundle(
        cleanCode,
        data.pet,
        data.vaccines || [],
        data.logs || [],
        data.emergency || null
      );
      onRemoteUpdate(localPetId);
    }
  });
};