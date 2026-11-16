import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Image,
  Linking,
  SafeAreaView,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
  Animated,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as Notifications from 'expo-notifications';
import QRCode from 'react-native-qrcode-svg';
import {
  PawPrint,
  Syringe,
  ShieldCheck,
  Pill,
  Stethoscope,
  FileText,
  Siren,
  Pencil,
  Trash2,
  Camera,
  Image as ImageIcon,
  Phone,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Square,
  CheckSquare,
  User,
  Calendar,
  Clock,
  Cpu,
  Plus,
  Compass,
  Navigation,
  ShoppingBag,
  FileDown,
  Sparkles,
  QrCode,
  X,
  Bell,
} from 'lucide-react-native';
import {
  initDatabase,
  getPets,
  savePet,
  updatePet,
  deletePet,
  getVaccinesDeworming,
  addVaccineDeworming,
  updateVaccineDeworming,
  deleteVaccineDeworming,
  getMedicalLogs,
  addMedicalLog,
  updateMedicalLog,
  deleteMedicalLog,
  toggleMedicalLogStatus,
  getEmergencyContact,
  saveOrUpdateEmergency,
} from './src/database/db';
import { Pet, VaccineDeworming, MedicalLog } from './src/types/petpass';

// Configuración de notificaciones compatible con Expo SDK 52+
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const formatDateInput = (text: string) => {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
};

// Convierte "DD/MM/AAAA" a objeto Date a las 09:00 AM
const parseDateTo9AM = (dateStr: string): Date | null => {
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year) || year < 2024) return null;
  const d = new Date(year, month, day, 9, 0, 0);
  return isNaN(d.getTime()) ? null : d;
};

// Genera el string estándar vCard 3.0 para que cualquier cámara reconozca el contacto offline
const buildPetVCard = (pet: Pet): string => {
  const cleanPhone = (pet.owner_phone || '').replace(/\s+/g, '');
  const alertNote = pet.allergies
    ? `ALERTA MEDICA: ${pet.allergies}`
    : 'Sin alergias criticas registradas';
  const infoNote = `Mascota: ${pet.name} (${pet.species}${pet.breed ? ' - ' + pet.breed : ''}) | ${alertNote}${
    pet.microchip ? ' | Chip: ' + pet.microchip : ''
  }`;

  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:PetPass;${pet.name};;;`,
    `FN:${pet.name} (Tutor: ${pet.owner_name || 'Contacto Emergencia'})`,
    cleanPhone ? `TEL;TYPE=CELL,VOICE:${cleanPhone}` : '',
    pet.owner_address ? `ADR;TYPE=HOME:;;${pet.owner_address};;;;` : '',
    `NOTE:${infoNote}`,
    'END:VCARD',
  ]
    .filter(Boolean)
    .join('\n');
};

export default function App() {
  const [petsList, setPetsList] = useState<Pet[]>([]);
  const [pet, setPet] = useState<Pet | null>(null);
  const [activeTab, setActiveTab] = useState<'carnet' | 'bitacora' | 'urgencia' | 'cercanas'>('carnet');

  const [vaccines, setVaccines] = useState<VaccineDeworming[]>([]);
  const [logs, setLogs] = useState<MedicalLog[]>([]);

  const [petModalVisible, setPetModalVisible] = useState(false);
  const [isCreatingNewPet, setIsCreatingNewPet] = useState(false);
  const [vaccineModalVisible, setVaccineModalVisible] = useState(false);
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);

  const [imageSheetVisible, setImageSheetVisible] = useState(false);
  const [imageTarget, setImageTarget] = useState<'pet' | 'pet_direct' | 'vaccine' | 'log'>('pet');

  const [deleteSheetVisible, setDeleteSheetVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'vaccine' | 'log' | 'pet';
    id: number;
    title: string;
  } | null>(null);

  const [editingVaccineId, setEditingVaccineId] = useState<number | null>(null);
  const [editingLogId, setEditingLogId] = useState<number | null>(null);

  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'success' | 'delete' | 'warning'>('success');
  const toastAnim = useRef(new Animated.Value(160)).current;

  const [name, setName] = useState('');
  const [speciesMode, setSpeciesMode] = useState<'Perro' | 'Gato' | 'Otra'>('Perro');
  const [customSpecies, setCustomSpecies] = useState('');
  const [breed, setBreed] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [sex, setSex] = useState('Macho');
  const [weight, setWeight] = useState('');
  const [isSterilized, setIsSterilized] = useState(0);
  const [microchip, setMicrochip] = useState('');
  const [allergies, setAllergies] = useState('');
  const [petPhoto, setPetPhoto] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerRut, setOwnerRut] = useState('');
  const [ownerAddress, setOwnerAddress] = useState('');

  const [vType, setVType] = useState<'vaccine' | 'deworming'>('vaccine');
  const [vProduct, setVProduct] = useState('');
  const [vApplied, setVApplied] = useState('');
  const [vNext, setVNext] = useState('');
  const [vPhoto, setVPhoto] = useState<string | null>(null);

  const [lCategory, setLCategory] = useState<'medication' | 'consultation' | 'symptom'>('medication');
  const [lTitle, setLTitle] = useState('');
  const [lSchedule, setLSchedule] = useState('');
  const [lAlarmHours, setLAlarmHours] = useState<number | null>(8); // Intervalo real en horas (null = sin alarma)
  const [lNotes, setLNotes] = useState('');
  const [lDate, setLDate] = useState('');
  const [lPhoto, setLPhoto] = useState<string | null>(null);

  const [vetName, setVetName] = useState('');
  const [vetPhone, setVetPhone] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [clinicPhone, setClinicPhone] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');

  useEffect(() => {
    try {
      initDatabase();
      loadData();
      requestNotificationPermissions();
    } catch (error) {
      console.error('Error iniciando BD:', error);
    }
  }, []);

  const requestNotificationPermissions = async () => {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    if (existingStatus !== 'granted') {
      await Notifications.requestPermissionsAsync();
    }
  };

  // Programa una alerta en fecha/hora real o por intervalo en segundos
  const scheduleRealNotification = async (
    title: string,
    body: string,
    options: { targetDate?: Date; intervalSeconds?: number }
  ) => {
    try {
      if (options.targetDate) {
        const now = Date.now();
        // Intentar avisar 24 horas antes a las 9:00 AM; si falta menos de 24h, avisar el mismo día a las 9:00 AM
        const dayBefore = new Date(options.targetDate.getTime() - 24 * 60 * 60 * 1000);
        const fireDate = dayBefore.getTime() > now ? dayBefore : options.targetDate;
        const diffSeconds = Math.floor((fireDate.getTime() - now) / 1000);

        if (diffSeconds > 60) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `🐾 PetPass: ${title}`,
              body,
              sound: true,
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
              seconds: diffSeconds,
            },
          });
        }
      } else if (options.intervalSeconds && options.intervalSeconds > 0) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `🐾 PetPass: ${title}`,
            body,
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: options.intervalSeconds,
          },
        });
      }
    } catch (error) {
      console.warn('Error programando notificación:', error);
    }
  };

  const showToast = (
    message: string,
    type: 'success' | 'delete' | 'warning' = 'success'
  ) => {
    setToastMsg(message);
    setToastType(type);
    Animated.sequence([
      Animated.spring(toastAnim, {
        toValue: 0,
        useNativeDriver: true,
        speed: 14,
        bounciness: 6,
      }),
      Animated.delay(2400),
      Animated.timing(toastAnim, {
        toValue: 160,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const renderToastPill = () => (
    <Animated.View
      pointerEvents="none"
      style={[styles.toastPill, { transform: [{ translateY: toastAnim }] }]}
    >
      <View
        style={[
          styles.toastIconWrap,
          {
            backgroundColor:
              toastType === 'delete'
                ? '#FEE2E2'
                : toastType === 'warning'
                ? '#FEF3C7'
                : '#DCFCE7',
          },
        ]}
      >
        {toastType === 'delete' ? (
          <Trash2 size={16} color="#DC2626" strokeWidth={2.2} />
        ) : toastType === 'warning' ? (
          <AlertTriangle size={16} color="#D97706" strokeWidth={2.2} />
        ) : (
          <CheckCircle2 size={16} color="#16A34A" strokeWidth={2.2} />
        )}
      </View>
      <Text style={styles.toastText}>{toastMsg}</Text>
    </Animated.View>
  );

  const renderImagePickerOverlay = () => {
    if (!imageSheetVisible) return null;
    return (
      <View style={styles.inlineSheetOverlay}>
        <TouchableOpacity
          style={styles.inlineSheetBackdrop}
          activeOpacity={1}
          onPress={() => setImageSheetVisible(false)}
        />
        <View style={styles.bottomSheetCard}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Adjuntar Fotografía</Text>
          <Text style={styles.sheetSubtitle}>
            Elige cómo quieres agregar la imagen al registro
          </Text>

          <TouchableOpacity style={styles.sheetOptionBtn} onPress={handleTakePhoto}>
            <View style={[styles.sheetIconCircle, { backgroundColor: '#DBEAFE' }]}>
              <Camera size={22} color="#2563EB" strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetOptionTitle}>Tomar foto con la Cámara</Text>
              <Text style={styles.sheetOptionDesc}>
                Capturar foto de la mascota, sticker o receta ahora
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sheetOptionBtn} onPress={handlePickGallery}>
            <View style={[styles.sheetIconCircle, { backgroundColor: '#E0E7FF' }]}>
              <ImageIcon size={22} color="#4F46E5" strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetOptionTitle}>Elegir de la Galería</Text>
              <Text style={styles.sheetOptionDesc}>
                Selecciona una foto guardada en tu teléfono
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sheetCancelBtn}
            onPress={() => setImageSheetVisible(false)}
          >
            <Text style={styles.sheetCancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderDeleteConfirmOverlay = () => {
    if (!deleteSheetVisible) return null;
    return (
      <View style={styles.inlineSheetOverlay}>
        <TouchableOpacity
          style={styles.inlineSheetBackdrop}
          activeOpacity={1}
          onPress={() => setDeleteSheetVisible(false)}
        />
        <View style={styles.bottomSheetCard}>
          <View style={styles.sheetHandle} />
          <View style={styles.deleteSheetHeader}>
            <View
              style={[
                styles.sheetIconCircle,
                { backgroundColor: '#FEE2E2', marginRight: 0, marginBottom: 10 },
              ]}
            >
              <Trash2 size={24} color="#DC2626" strokeWidth={2.2} />
            </View>
            <Text style={styles.sheetTitle}>
              {deleteTarget?.type === 'pet' ? '¿Eliminar ficha completa?' : '¿Eliminar registro?'}
            </Text>
            <Text style={[styles.sheetSubtitle, { textAlign: 'center' }]}>
              Se borrará "{deleteTarget?.title}" de forma permanente de este dispositivo.
            </Text>
          </View>

          <TouchableOpacity style={styles.dangerBtn} onPress={confirmDeleteAction}>
            <Text style={styles.dangerBtnText}>Sí, eliminar definitivamente</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sheetCancelBtn}
            onPress={() => setDeleteSheetVisible(false)}
          >
            <Text style={styles.sheetCancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const loadData = (selectedPetId?: number) => {
    const allPets = getPets();
    setPetsList(allPets);

    if (allPets.length > 0) {
      const targetId = selectedPetId ?? pet?.id ?? allPets[0].id;
      const currentPet = allPets.find((p) => p.id === targetId) || allPets[0];
      setPet(currentPet);
      fillPetForm(currentPet);
      setVaccines(getVaccinesDeworming(currentPet.id));
      setLogs(getMedicalLogs(currentPet.id));

      const em = getEmergencyContact(currentPet.id);
      if (em) {
        setVetName(em.vet_name || '');
        setVetPhone(em.vet_phone || '');
        setClinicName(em.emergency_clinic_name || '');
        setClinicPhone(em.emergency_clinic_phone || '');
        setClinicAddress(em.emergency_address || '');
      } else {
        setVetName('');
        setVetPhone('');
        setClinicName('');
        setClinicPhone('');
        setClinicAddress('');
      }
    } else {
      setPet(null);
      setVaccines([]);
      setLogs([]);
    }
  };

  const clearPetForm = () => {
    setName('');
    setSpeciesMode('Perro');
    setCustomSpecies('');
    setBreed('');
    setBirthDate('');
    setSex('Macho');
    setWeight('');
    setIsSterilized(0);
    setMicrochip('');
    setAllergies('');
    setPetPhoto(null);
    setOwnerName('');
    setOwnerPhone('');
    setOwnerRut('');
    setOwnerAddress('');
  };

  const fillPetForm = (p: Pet) => {
    setName(p.name || '');
    if (p.species === 'Perro' || p.species === 'Gato') {
      setSpeciesMode(p.species);
      setCustomSpecies('');
    } else if (p.species) {
      setSpeciesMode('Otra');
      setCustomSpecies(p.species);
    } else {
      setSpeciesMode('Perro');
      setCustomSpecies('');
    }
    setBreed(p.breed || '');
    setBirthDate(formatDateInput(p.birth_date || ''));
    setSex(p.sex || 'Macho');
    setWeight(p.weight ? String(p.weight) : '');
    setIsSterilized(p.is_sterilized || 0);
    setMicrochip(p.microchip || '');
    setAllergies(p.allergies || '');
    setPetPhoto(p.photo_uri || null);
    setOwnerName(p.owner_name || '');
    setOwnerPhone(p.owner_phone || '');
    setOwnerRut(p.owner_rut || '');
    setOwnerAddress(p.owner_address || '');
  };

  const handleMicrochipChange = (text: string) => {
    const clean = text.replace(/\D/g, '').slice(0, 15);
    setMicrochip(clean);

    if (clean.length >= 8) {
      const exactMatch = petsList.find(
        (p) => p.microchip === clean && (p.owner_name || p.owner_phone)
      );
      if (exactMatch && !ownerName.trim()) {
        setOwnerName(exactMatch.owner_name || '');
        setOwnerPhone(exactMatch.owner_phone || '');
        setOwnerRut(exactMatch.owner_rut || '');
        setOwnerAddress(exactMatch.owner_address || '');
        showToast(`Tutor de ${exactMatch.name} cargado por Chip`, 'success');
      }
    }
  };

  const copyOwnerFromPet = (sourcePet: Pet) => {
    setOwnerName(sourcePet.owner_name || '');
    setOwnerPhone(sourcePet.owner_phone || '');
    setOwnerRut(sourcePet.owner_rut || '');
    setOwnerAddress(sourcePet.owner_address || '');
    showToast(`Datos del tutor de ${sourcePet.name} copiados`, 'success');
  };

  const openEditPetModal = () => {
    if (pet) {
      fillPetForm(pet);
      setIsCreatingNewPet(false);
    } else {
      clearPetForm();
      setIsCreatingNewPet(true);
    }
    setPetModalVisible(true);
  };

  const openCreateNewPetModal = () => {
    clearPetForm();
    setIsCreatingNewPet(true);
    setPetModalVisible(true);
  };

  const handleCancelPetModal = () => {
    if (pet) {
      fillPetForm(pet);
    }
    setIsCreatingNewPet(false);
    setImageSheetVisible(false);
    setPetModalVisible(false);
  };

  const openImagePickerSheet = (target: 'pet' | 'pet_direct' | 'vaccine' | 'log') => {
    setImageTarget(target);
    setImageSheetVisible(true);
  };

  const applySelectedImage = (uri: string) => {
    if (imageTarget === 'pet') {
      setPetPhoto(uri);
      showToast('Foto cargada en la ficha', 'success');
    } else if (imageTarget === 'pet_direct' && pet) {
      updatePet({ ...pet, photo_uri: uri });
      setPetPhoto(uri);
      loadData(pet.id);
      showToast(`Foto de ${pet.name} actualizada`, 'success');
    } else if (imageTarget === 'vaccine') {
      setVPhoto(uri);
      showToast('Foto de etiqueta adjuntada', 'success');
    } else if (imageTarget === 'log') {
      setLPhoto(uri);
      showToast('Foto adjuntada a la bitácora', 'success');
    }
  };

  const handleTakePhoto = async () => {
    setImageSheetVisible(false);
    setTimeout(async () => {
      try {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          showToast('Activa el permiso de cámara en Configuración', 'warning');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          quality: 0.75,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          applySelectedImage(result.assets[0].uri);
        }
      } catch (err) {
        console.warn('Error abriendo cámara:', err);
        showToast('No se pudo abrir la cámara', 'warning');
      }
    }, 150);
  };

  const handlePickGallery = async () => {
    setImageSheetVisible(false);
    setTimeout(async () => {
      try {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          showToast('Activa el permiso de Fotos en Configuración', 'warning');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          quality: 0.75,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          applySelectedImage(result.assets[0].uri);
        }
      } catch (err) {
        console.warn('Error abriendo galería:', err);
        showToast('No se pudo abrir la galería', 'warning');
      }
    }, 150);
  };

  const handleSavePet = () => {
    if (!name.trim()) {
      showToast('Ingresa el nombre de la mascota', 'warning');
      return;
    }
    const finalSpecies =
      speciesMode === 'Otra' ? customSpecies.trim() : speciesMode;
    if (!finalSpecies) {
      showToast('Escribe qué especie es la mascota', 'warning');
      return;
    }

    const petData = {
      name: name.trim(),
      species: finalSpecies,
      breed: breed.trim(),
      birth_date: birthDate,
      sex,
      weight: parseFloat(weight.replace(',', '.')) || 0,
      is_sterilized: isSterilized,
      microchip: microchip.trim(),
      allergies: allergies.trim(),
      photo_uri: petPhoto,
      owner_name: ownerName.trim(),
      owner_phone: ownerPhone.trim(),
      owner_rut: ownerRut.trim(),
      owner_address: ownerAddress.trim(),
    };

    if (pet && !isCreatingNewPet) {
      updatePet({ ...petData, id: pet.id });
      setPetModalVisible(false);
      loadData(pet.id);
      showToast(`Ficha de ${petData.name} actualizada`, 'success');
    } else {
      const newId = savePet(petData);
      setIsCreatingNewPet(false);
      setPetModalVisible(false);
      loadData(newId);
      showToast(`${petData.name} agregado a PetPass`, 'success');
    }
  };

  const handleExportPDF = async () => {
    if (!pet) return;
    try {
      const em = getEmergencyContact(pet.id);
      const vCardEncoded = encodeURIComponent(buildPetVCard(pet));
      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${vCardEncoded}`;

      const vaccineRows =
        vaccines.length > 0
          ? vaccines
              .map(
                (v) => `
              <tr>
                <td><span class="tag">${v.type === 'vaccine' ? 'Vacuna' : 'Antiparasitario'}</span></td>
                <td><strong>${v.product_name}</strong></td>
                <td>${formatDateInput(v.applied_date)}</td>
                <td>${v.next_due_date ? formatDateInput(v.next_due_date) : '—'}</td>
              </tr>`
              )
              .join('')
          : `<tr><td colspan="4" style="text-align:center;color:#6B7280;">Sin registros de vacunas o antiparasitarios</td></tr>`;

      const logRows =
        logs.length > 0
          ? logs
              .map(
                (l) => `
              <tr>
                <td>${
                  l.category === 'medication'
                    ? 'Remedio'
                    : l.category === 'consultation'
                    ? 'Consulta'
                    : 'Síntoma'
                }</td>
                <td><strong>${l.title}</strong> ${
                  l.is_completed ? '(Completado)' : ''
                }</td>
                <td>${l.dosage_schedule || '—'}</td>
                <td>${formatDateInput(l.date)}</td>
                <td>${l.notes || '—'}</td>
              </tr>`
              )
              .join('')
          : `<tr><td colspan="5" style="text-align:center;color:#6B7280;">Sin registros en la bitácora médica</td></tr>`;

      const html = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="utf-8" />
          <style>
            @page { margin: 24px; }
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1E293B; padding: 10px; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2563EB; padding-bottom: 14px; margin-bottom: 18px; }
            .brand { font-size: 24px; font-weight: bold; color: #2563EB; }
            .subtitle { font-size: 12px; color: #64748B; }
            .grid { display: flex; gap: 16px; margin-bottom: 16px; }
            .card { flex: 1; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px; }
            .card-title { font-size: 13px; font-weight: bold; color: #2563EB; text-transform: uppercase; margin-bottom: 8px; }
            .pet-name { font-size: 22px; font-weight: bold; color: #0F172A; margin: 0 0 6px 0; }
            .row-text { font-size: 13px; margin: 4px 0; color: #334155; }
            .alert-box { background: #FEF2F2; border: 1.5px solid #F87171; color: #B91C1C; padding: 12px; border-radius: 8px; font-weight: bold; font-size: 14px; margin-bottom: 18px; }
            .qr-credencial { background: #EFF6FF; border: 1.5px dashed #3B82F6; border-radius: 10px; padding: 14px; margin-bottom: 18px; display: flex; align-items: center; justify-content: space-between; }
            h3 { font-size: 15px; color: #0F172A; border-bottom: 1px solid #CBD5E1; padding-bottom: 6px; margin-top: 22px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
            th { background: #EFF6FF; color: #1D4ED8; text-align: left; padding: 8px; border: 1px solid #BFDBFE; }
            td { padding: 8px; border: 1px solid #E2E8F0; vertical-align: top; }
            .tag { background: #DBEAFE; color: #1D4ED8; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 10px; }
            .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #94A3B8; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="brand">PetPass • Ficha y Carnet Sanitario</div>
              <div class="subtitle">Documento generado el ${new Date().toLocaleDateString('es-CL')}</div>
            </div>
          </div>

          ${
            pet.allergies
              ? `<div class="alert-box">⚠️ ALERTA MÉDICA / ALERGIAS: ${pet.allergies}</div>`
              : ''
          }

          <div class="qr-credencial">
            <div style="flex:1; padding-right:12px;">
              <div style="font-size:14px; font-weight:bold; color:#1D4ED8; margin-bottom:4px;">🏷️ CREDENCIAL Y PLACA QR DE EMERGENCIA</div>
              <div style="font-size:13px; color:#334155;">Escanea este código QR con cualquier cámara para guardar el contacto directo y alertas médicas de <strong>${pet.name}</strong> sin necesidad de internet.</div>
              <div style="font-size:12px; color:#64748B; margin-top:4px;">Teléfono Tutor: <strong>${pet.owner_phone || 'No registrado'}</strong></div>
            </div>
            <div style="background:#FFF; padding:6px; border-radius:8px; border:1px solid #BFDBFE;">
              <img src="${qrImageUrl}" width="84" height="84" />
            </div>
          </div>

          <div class="grid">
            <div class="card">
              <div class="card-title">Identificación de la Mascota</div>
              <div class="pet-name">${pet.name}</div>
              <div class="row-text"><strong>Especie / Raza:</strong> ${pet.species} • ${
        pet.breed || 'Mestizo'
      }</div>
              <div class="row-text"><strong>Sexo / Peso:</strong> ${pet.sex} • ${
        pet.weight
      } kg</div>
              <div class="row-text"><strong>Fecha Nacimiento:</strong> ${
                pet.birth_date ? formatDateInput(pet.birth_date) : 'No registrada'
              }</div>
              <div class="row-text"><strong>Microchip:</strong> ${
                pet.microchip || 'No registrado'
              }</div>
            </div>

            <div class="card">
              <div class="card-title">Tutor / Dueño Responsable</div>
              <div class="row-text"><strong>Nombre:</strong> ${
                pet.owner_name || 'No especificado'
              }</div>
              <div class="row-text"><strong>RUT / ID:</strong> ${
                pet.owner_rut || 'No especificado'
              }</div>
              <div class="row-text"><strong>Teléfono:</strong> ${
                pet.owner_phone || 'No especificado'
              }</div>
              <div class="row-text"><strong>Dirección:</strong> ${
                pet.owner_address || 'No especificada'
              }</div>
            </div>
          </div>

          <h3>Carnet de Vacunas y Desparasitaciones</h3>
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Producto / Vacuna</th>
                <th>Fecha Aplicación</th>
                <th>Próxima Dosis</th>
              </tr>
            </thead>
            <tbody>${vaccineRows}</tbody>
          </table>

          <h3>Bitácora Médica, Controles y Tratamientos</h3>
          <table>
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Título / Medicamento</th>
                <th>Dosis / Detalle</th>
                <th>Fecha</th>
                <th>Indicaciones / Notas</th>
              </tr>
            </thead>
            <tbody>${logRows}</tbody>
          </table>

          ${
            em && (em.vet_name || em.emergency_clinic_name)
              ? `
            <h3>Contactos Veterinarios de Emergencia</h3>
            <div class="grid">
              <div class="card">
                <div class="card-title">Veterinario de Cabecera</div>
                <div class="row-text"><strong>Nombre:</strong> ${em.vet_name || '—'}</div>
                <div class="row-text"><strong>Teléfono:</strong> ${em.vet_phone || '—'}</div>
              </div>
              <div class="card">
                <div class="card-title">Clínica de Urgencia 24/7</div>
                <div class="row-text"><strong>Clínica:</strong> ${
                  em.emergency_clinic_name || '—'
                }</div>
                <div class="row-text"><strong>Teléfono:</strong> ${
                  em.emergency_clinic_phone || '—'
                }</div>
                <div class="row-text"><strong>Dirección:</strong> ${
                  em.emergency_address || '—'
                }</div>
              </div>
            </div>
          `
              : ''
          }

          <div class="footer">Generado desde la aplicación móvil PetPass</div>
        </body>
        </html>
      `;

      if (Platform.OS === 'ios') {
        const { uri } = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Carnet Sanitario de ${pet.name}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        await Print.printAsync({ html });
      }
    } catch (error) {
      console.warn('Aviso al exportar PDF:', error);
      showToast('No se pudo abrir la vista de PDF', 'warning');
    }
  };

  const openNewVaccineModal = () => {
    setEditingVaccineId(null);
    setVType('vaccine');
    setVProduct('');
    setVApplied('');
    setVNext('');
    setVPhoto(null);
    setVaccineModalVisible(true);
  };

  const openEditVaccineModal = (item: VaccineDeworming) => {
    setEditingVaccineId(item.id);
    setVType(item.type);
    setVProduct(item.product_name);
    setVApplied(formatDateInput(item.applied_date));
    setVNext(formatDateInput(item.next_due_date || ''));
    setVPhoto(item.photo_uri);
    setVaccineModalVisible(true);
  };

  const handleSwitchVaccineType = (newType: 'vaccine' | 'deworming') => {
    if (vType === newType) return;
    setVType(newType);
    setVProduct('');
    setVApplied('');
    setVNext('');
    setVPhoto(null);
  };

  const handleSaveVaccine = () => {
    if (!pet) return;

    if (!vProduct.trim()) {
      showToast(
        vType === 'vaccine'
          ? 'Ingresa el nombre de la vacuna'
          : 'Ingresa el producto antiparasitario',
        'warning'
      );
      return;
    }

    if (!vApplied.trim()) {
      showToast('Ingresa la fecha de aplicación', 'warning');
      return;
    }

    if (vApplied.trim().length < 10) {
      showToast('Completa la fecha de aplicación (DD/MM/AAAA)', 'warning');
      return;
    }

    if (vNext.trim() && vNext.trim().length < 10) {
      showToast('Completa la fecha de próxima dosis (DD/MM/AAAA)', 'warning');
      return;
    }

    let alarmScheduled = false;
    if (vNext.trim()) {
      const targetDate = parseDateTo9AM(vNext.trim());
      if (targetDate && targetDate.getTime() > Date.now()) {
        scheduleRealNotification(
          `Próxima dosis para ${pet.name}`,
          `Recuerda aplicar ${vProduct.trim()} (fecha programada: ${vNext.trim()}).`,
          { targetDate }
        );
        alarmScheduled = true;
      }
    }

    if (editingVaccineId) {
      updateVaccineDeworming({
        id: editingVaccineId,
        pet_id: pet.id,
        type: vType,
        product_name: vProduct.trim(),
        applied_date: vApplied.trim(),
        next_due_date: vNext.trim(),
        photo_uri: vPhoto,
      });
      showToast(
        alarmScheduled ? 'Actualizado y recordatorio agendado' : 'Registro sanitario actualizado',
        'success'
      );
    } else {
      addVaccineDeworming({
        pet_id: pet.id,
        type: vType,
        product_name: vProduct.trim(),
        applied_date: vApplied.trim(),
        next_due_date: vNext.trim(),
        photo_uri: vPhoto,
      });
      showToast(
        alarmScheduled ? 'Guardado y recordatorio agendado' : 'Guardado en el Carnet',
        'success'
      );
    }
    setVaccineModalVisible(false);
    loadData(pet.id);
  };

  const openNewLogModal = () => {
    setEditingLogId(null);
    setLCategory('medication');
    setLTitle('');
    setLSchedule('');
    setLAlarmHours(8);
    setLNotes('');
    setLDate('');
    setLPhoto(null);
    setLogModalVisible(true);
  };

  const openEditLogModal = (log: MedicalLog) => {
    setEditingLogId(log.id);
    setLCategory(log.category);
    setLTitle(log.title);
    setLSchedule(log.dosage_schedule || '');
    setLAlarmHours(null);
    setLNotes(log.notes || '');
    setLDate(formatDateInput(log.date || ''));
    setLPhoto(log.photo_uri || null);
    setLogModalVisible(true);
  };

  const handleSwitchLogCategory = (newCat: 'medication' | 'consultation' | 'symptom') => {
    if (lCategory === newCat) return;
    setLCategory(newCat);
    setLTitle('');
    setLSchedule('');
    setLAlarmHours(newCat === 'medication' ? 8 : null);
    setLNotes('');
    setLDate('');
    setLPhoto(null);
  };

  const getLogFormLabels = () => {
    if (lCategory === 'medication') {
      return {
        titleLabel: 'Nombre del Medicamento *',
        titlePlaceholder: 'Ej. Hemolitan, Amoxicilina, Meloxicam...',
        secondaryLabel: 'Dosis y Duración',
        secondaryPlaceholder: 'Ej. 5 gotas por 7 días',
        notesLabel: 'Indicaciones / Dosis en gotas o ml',
        notesPlaceholder: 'Ej. Dar con comida en la mañana...',
      };
    }
    if (lCategory === 'consultation') {
      return {
        titleLabel: 'Motivo de la Consulta o Control *',
        titlePlaceholder: 'Ej. Control sano, Retiro de puntos, Vacunación...',
        secondaryLabel: 'Clínica o Veterinario que atendió (Opcional)',
        secondaryPlaceholder: 'Ej. Dra. Paloma / Clínica Veterinaria',
        notesLabel: 'Diagnóstico / Indicaciones del Veterinario',
        notesPlaceholder: 'Ej. Peso estable, recetó dieta blanda por 3 días...',
      };
    }
    return {
      titleLabel: 'Síntoma o Reacción Observada *',
      titlePlaceholder: 'Ej. Picazón en el pecho, Vómito, Decaimiento...',
      secondaryLabel: 'Duración o Frecuencia (Opcional)',
      secondaryPlaceholder: 'Ej. Desde hoy en la mañana / 2 veces al día',
      notesLabel: 'Detalles u Observaciones',
      notesPlaceholder: 'Ej. Empezó después de comer pollo, sin fiebre...',
    };
  };

  const handleSaveLog = () => {
    if (!pet) return;
    if (!lTitle.trim()) {
      showToast(
        lCategory === 'medication'
          ? 'Ingresa el nombre del medicamento'
          : lCategory === 'consultation'
          ? 'Ingresa el motivo de la consulta'
          : 'Describe el síntoma observado',
        'warning'
      );
      return;
    }
    if (lDate.trim() && lDate.trim().length < 10) {
      showToast('Completa la fecha del registro (DD/MM/AAAA)', 'warning');
      return;
    }

    let alarmSet = false;
    if (lCategory === 'medication' && lAlarmHours && lAlarmHours > 0) {
      const freqLabel = `Cada ${lAlarmHours} hrs`;
      const scheduleText = lSchedule.trim() ? `${freqLabel} • ${lSchedule.trim()}` : freqLabel;
      scheduleRealNotification(
        `Hora de medicina para ${pet.name}`,
        `Dar tratamiento: ${lTitle.trim()} (${scheduleText})`,
        { intervalSeconds: lAlarmHours * 3600 }
      );
      alarmSet = true;
    }

    const finalSchedule =
      lCategory === 'medication' && lAlarmHours
        ? lSchedule.trim()
          ? `Cada ${lAlarmHours} hrs • ${lSchedule.trim()}`
          : `Cada ${lAlarmHours} hrs`
        : lSchedule.trim();

    const today = formatDateInput(new Date().toLocaleDateString('es-CL'));
    if (editingLogId) {
      updateMedicalLog({
        id: editingLogId,
        pet_id: pet.id,
        category: lCategory,
        title: lTitle.trim(),
        notes: lNotes.trim(),
        dosage_schedule: finalSchedule,
        is_completed: 0,
        date: lDate.trim() || today,
        photo_uri: lPhoto,
      });
      showToast(
        alarmSet ? `Bitácora actualizada (aviso en ${lAlarmHours}h)` : 'Bitácora actualizada',
        'success'
      );
    } else {
      addMedicalLog({
        pet_id: pet.id,
        category: lCategory,
        title: lTitle.trim(),
        notes: lNotes.trim(),
        dosage_schedule: finalSchedule,
        is_completed: 0,
        date: lDate.trim() || today,
        photo_uri: lPhoto,
      });
      showToast(
        alarmSet ? `Guardado • Alarma en ${lAlarmHours} hrs` : 'Agregado a la bitácora',
        'success'
      );
    }
    setLogModalVisible(false);
    loadData(pet.id);
  };

  const askDelete = (type: 'vaccine' | 'log' | 'pet', id: number, title: string) => {
    setDeleteTarget({ type, id, title });
    setDeleteSheetVisible(true);
  };

  const confirmDeleteAction = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'vaccine') {
      deleteVaccineDeworming(deleteTarget.id);
      showToast('Eliminado del carnet', 'delete');
      loadData(pet?.id);
    } else if (deleteTarget.type === 'log') {
      deleteMedicalLog(deleteTarget.id);
      showToast('Borrado de la bitácora', 'delete');
      loadData(pet?.id);
    } else if (deleteTarget.type === 'pet') {
      deletePet(deleteTarget.id);
      setPetModalVisible(false);
      showToast(`Ficha de ${deleteTarget.title} eliminada`, 'delete');
      loadData();
    }
    setDeleteSheetVisible(false);
    setDeleteTarget(null);
  };

  const handleSaveEmergency = () => {
    if (!pet) return;
    saveOrUpdateEmergency({
      pet_id: pet.id,
      vet_name: vetName,
      vet_phone: vetPhone,
      emergency_clinic_name: clinicName,
      emergency_clinic_phone: clinicPhone,
      emergency_address: clinicAddress,
    });
    loadData(pet.id);
    showToast('Contactos de emergencia guardados', 'success');
  };

  const callPhone = (phone: string) => {
    if (!phone.trim()) return;
    Linking.openURL(`tel:${phone.trim()}`);
  };

  const openSmartMaps = () => {
    const query = [clinicName.trim(), clinicAddress.trim()].filter(Boolean).join(', ');
    if (!query) {
      Linking.openURL('https://www.google.com/maps/search/?api=1&query=veterinaria+cerca+de+mi');
      return;
    }
    if (clinicAddress.trim().startsWith('http')) {
      Linking.openURL(clinicAddress.trim());
      return;
    }
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    Linking.openURL(url);
  };

  const searchNearbyOnMap = (searchTerm: string) => {
    const term = searchTerm.trim() || 'veterinaria cerca de mi';
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(term)}`;
    Linking.openURL(url);
  };

  const logLabels = getLogFormLabels();

  const existingOwners = petsList.filter(
    (p) => p.owner_name && p.owner_name.trim() !== '' && (isCreatingNewPet || p.id !== pet?.id)
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      {renderToastPill()}

      {!pet ? (
        <ScrollView contentContainerStyle={styles.welcomeScroll}>
          <View style={styles.welcomeHeroCard}>
            <View style={styles.welcomeIconBadge}>
              <PawPrint size={42} color="#2563EB" strokeWidth={2.2} />
            </View>
            <View style={styles.welcomeTagPill}>
              <Sparkles size={13} color="#1D4ED8" strokeWidth={2.2} />
              <Text style={styles.welcomeTagText}>Libreta Sanitaria Inteligente</Text>
            </View>
            <Text style={styles.brandTitle}>PetPass</Text>
            <Text style={styles.emptySubtitle}>
              Lleva el control clínico, vacunas, recetas y contactos de emergencia de tus mascotas siempre en tu bolsillo, 100% offline.
            </Text>
          </View>

          <View style={styles.welcomeFeaturesList}>
            <View style={styles.welcomeFeatureItem}>
              <View style={[styles.welcomeFeatureIcon, { backgroundColor: '#DBEAFE' }]}>
                <Syringe size={20} color="#2563EB" strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.welcomeFeatureTitle}>Carnet, PDF y Placa QR</Text>
                <Text style={styles.welcomeFeatureDesc}>
                  Exporta carnets formales a PDF con credencial QR vCard escaneable offline.
                </Text>
              </View>
            </View>

            <View style={styles.welcomeFeatureItem}>
              <View style={[styles.welcomeFeatureIcon, { backgroundColor: '#DCFCE7' }]}>
                <Pill size={20} color="#16A34A" strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.welcomeFeatureTitle}>Bitácora con Alarmas Locales</Text>
                <Text style={styles.welcomeFeatureDesc}>
                  Recibe avisos automáticos en tu teléfono para próximas dosis y remedios.
                </Text>
              </View>
            </View>

            <View style={styles.welcomeFeatureItem}>
              <View style={[styles.welcomeFeatureIcon, { backgroundColor: '#FEE2E2' }]}>
                <Siren size={20} color="#DC2626" strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.welcomeFeatureTitle}>Radar de Urgencias 24/7</Text>
                <Text style={styles.welcomeFeatureDesc}>
                  Encuentra clínicas veterinarias cercanas por GPS y llama con un toque.
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.welcomePrimaryBtn}
            onPress={openCreateNewPetModal}
          >
            <Plus size={20} color="#FFF" strokeWidth={2.5} />
            <Text style={[styles.primaryBtnText, { marginLeft: 8 }]}>
              Crear Ficha de mi Mascota
            </Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 25}
        >
          {/* BARRA SELECTORA DE MÚLTIPLES MASCOTAS */}
          <View style={styles.petSwitcherBar}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.petSwitcherScroll}
            >
              {petsList.map((item) => {
                const isSelected = item.id === pet.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.petPill, isSelected && styles.petPillActive]}
                    onPress={() => loadData(item.id)}
                  >
                    <PawPrint
                      size={14}
                      color={isSelected ? '#FFFFFF' : '#4B5563'}
                      strokeWidth={2.2}
                    />
                    <Text style={[styles.petPillText, isSelected && styles.petPillTextActive]}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity style={styles.addPetPill} onPress={openCreateNewPetModal}>
                <Plus size={14} color="#2563EB" strokeWidth={2.5} />
                <Text style={styles.addPetPillText}>Nueva Mascota</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* TARJETA SUPERIOR DEL PERFIL */}
          <View style={styles.headerCard}>
            <View style={styles.headerTop}>
              <TouchableOpacity
                style={styles.avatarContainer}
                onPress={() => openImagePickerSheet('pet_direct')}
              >
                {pet.photo_uri ? (
                  <Image source={{ uri: pet.photo_uri }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <PawPrint size={30} color="#2563EB" strokeWidth={2} />
                  </View>
                )}
                <View style={styles.avatarCameraCorner}>
                  <Camera size={11} color="#FFFFFF" strokeWidth={2.5} />
                </View>
              </TouchableOpacity>

              <View style={styles.headerInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.petName}>{pet.name}</Text>
                  <View style={{ flexDirection: 'row' }}>
                    <TouchableOpacity
                      style={[
                        styles.editBadge,
                        { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', borderWidth: 1, marginRight: 6 },
                      ]}
                      onPress={() => setQrModalVisible(true)}
                    >
                      <QrCode size={13} color="#15803D" strokeWidth={2.2} />
                      <Text style={[styles.editBadgeText, { color: '#15803D', marginLeft: 4 }]}>
                        QR
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.editBadge,
                        { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', borderWidth: 1, marginRight: 6 },
                      ]}
                      onPress={handleExportPDF}
                    >
                      <FileDown size={13} color="#1D4ED8" strokeWidth={2.2} />
                      <Text style={[styles.editBadgeText, { color: '#1D4ED8', marginLeft: 4 }]}>
                        PDF
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.editBadge} onPress={openEditPetModal}>
                      <Pencil size={13} color="#374151" strokeWidth={2.2} />
                      <Text style={[styles.editBadgeText, { marginLeft: 4 }]}>Editar</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.petMeta}>
                  {pet.species} • {pet.breed || 'Mestizo'} • {pet.weight} kg • {pet.sex}
                </Text>

                {pet.birth_date ? (
                  <View style={styles.inlineMetaRow}>
                    <Calendar size={12} color="#6B7280" strokeWidth={2} />
                    <Text style={styles.chipText}>Nac: {formatDateInput(pet.birth_date)}</Text>
                  </View>
                ) : null}

                {pet.microchip ? (
                  <View style={styles.inlineMetaRow}>
                    <Cpu size={12} color="#1D4ED8" strokeWidth={2} />
                    <Text style={styles.chipHighlight}>Chip: {pet.microchip}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {pet.owner_name || pet.owner_phone ? (
              <View style={styles.ownerBar}>
                <View style={{ flex: 1 }}>
                  <View style={styles.inlineMetaRow}>
                    <User size={13} color="#1E293B" strokeWidth={2.2} />
                    <Text style={styles.ownerBarTitle}>
                      Tutor: {pet.owner_name || 'Sin nombre'}
                    </Text>
                  </View>
                  {pet.owner_address ? (
                    <View style={[styles.inlineMetaRow, { marginTop: 3 }]}>
                      <MapPin size={12} color="#64748B" strokeWidth={2} />
                      <Text style={styles.ownerBarSub}>{pet.owner_address}</Text>
                    </View>
                  ) : null}
                </View>
                {pet.owner_phone ? (
                  <TouchableOpacity
                    style={styles.ownerCallBadge}
                    onPress={() => callPhone(pet.owner_phone)}
                  >
                    <Phone size={12} color="#166534" strokeWidth={2.2} />
                    <Text style={[styles.ownerCallText, { marginLeft: 4 }]}>{pet.owner_phone}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              <TouchableOpacity style={styles.addOwnerPrompt} onPress={openEditPetModal}>
                <Plus size={14} color="#475569" strokeWidth={2.2} />
                <Text style={[styles.addOwnerPromptText, { marginLeft: 4 }]}>
                  Agregar datos del Dueño / Tutor de {pet.name}
                </Text>
              </TouchableOpacity>
            )}

            {pet.allergies ? (
              <View style={styles.allergyBanner}>
                <AlertTriangle size={16} color="#B91C1C" strokeWidth={2.2} />
                <Text style={styles.allergyText}>ALERTA MÉDICA: {pet.allergies}</Text>
              </View>
            ) : null}
          </View>

          {/* 4 PESTAÑAS */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'carnet' && styles.activeTab]}
              onPress={() => setActiveTab('carnet')}
            >
              <Syringe
                size={15}
                color={activeTab === 'carnet' ? '#2563EB' : '#6B7280'}
                strokeWidth={2.2}
              />
              <Text style={[styles.tabText, activeTab === 'carnet' && styles.activeTabText]}>
                Carnet ({vaccines.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'bitacora' && styles.activeTab]}
              onPress={() => setActiveTab('bitacora')}
            >
              <Pill
                size={15}
                color={activeTab === 'bitacora' ? '#2563EB' : '#6B7280'}
                strokeWidth={2.2}
              />
              <Text style={[styles.tabText, activeTab === 'bitacora' && styles.activeTabText]}>
                Bitácora ({logs.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'urgencia' && { borderColor: '#DC2626' },
              ]}
              onPress={() => setActiveTab('urgencia')}
            >
              <Siren
                size={15}
                color={activeTab === 'urgencia' ? '#DC2626' : '#6B7280'}
                strokeWidth={2.2}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'urgencia' && { color: '#DC2626', fontWeight: '700' },
                ]}
              >
                Urgencia
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'cercanas' && styles.activeTab]}
              onPress={() => setActiveTab('cercanas')}
            >
              <Compass
                size={15}
                color={activeTab === 'cercanas' ? '#2563EB' : '#6B7280'}
                strokeWidth={2.2}
              />
              <Text style={[styles.tabText, activeTab === 'cercanas' && styles.activeTabText]}>
                Cercanas
              </Text>
            </TouchableOpacity>
          </View>

          {/* CONTENIDO */}
          <ScrollView
            style={styles.content}
            contentContainerStyle={{ paddingBottom: 130 }}
            keyboardShouldPersistTaps="handled"
          >
            {activeTab === 'carnet' && (
              <View>
                <TouchableOpacity style={styles.addBtn} onPress={openNewVaccineModal}>
                  <Plus size={18} color="#FFF" strokeWidth={2.5} />
                  <Text style={styles.addBtnText}>Registrar Vacuna o Antiparasitario</Text>
                </TouchableOpacity>

                {vaccines.length === 0 ? (
                  <Text style={styles.emptyText}>
                    No hay vacunas ni desparasitaciones registradas para {pet.name}.
                  </Text>
                ) : (
                  vaccines.map((item) => (
                    <View key={item.id} style={styles.itemCard}>
                      <View style={styles.itemHeader}>
                        <View style={styles.badgeWrap}>
                          {item.type === 'vaccine' ? (
                            <Syringe size={12} color="#1D4ED8" strokeWidth={2.2} />
                          ) : (
                            <ShieldCheck size={12} color="#1D4ED8" strokeWidth={2.2} />
                          )}
                          <Text style={styles.badgeText}>
                            {item.type === 'vaccine' ? 'VACUNA' : 'ANTIPARASITARIO'}
                          </Text>
                        </View>
                        <Text style={styles.dateText}>
                          Aplicada: {formatDateInput(item.applied_date)}
                        </Text>
                      </View>

                      <Text style={styles.itemTitle}>{item.product_name}</Text>

                      {item.next_due_date ? (
                        <View style={[styles.inlineMetaRow, { marginTop: 6 }]}>
                          <Calendar size={14} color="#D97706" strokeWidth={2.2} />
                          <Text style={styles.nextDueText}>
                            Próxima dosis: {formatDateInput(item.next_due_date)}
                          </Text>
                        </View>
                      ) : null}

                      {item.photo_uri ? (
                        <Image source={{ uri: item.photo_uri }} style={styles.stickerImage} />
                      ) : null}

                      <View style={styles.cardActionsRow}>
                        <TouchableOpacity
                          style={styles.actionBtn}
                          onPress={() => openEditVaccineModal(item)}
                        >
                          <Pencil size={13} color="#374151" strokeWidth={2.2} />
                          <Text style={styles.actionBtnText}>Editar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.deleteActionBtn]}
                          onPress={() => askDelete('vaccine', item.id, item.product_name)}
                        >
                          <Trash2 size={13} color="#DC2626" strokeWidth={2.2} />
                          <Text style={styles.deleteActionText}>Borrar</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {activeTab === 'bitacora' && (
              <View>
                <TouchableOpacity style={styles.addBtn} onPress={openNewLogModal}>
                  <Plus size={18} color="#FFF" strokeWidth={2.5} />
                  <Text style={styles.addBtnText}>Agregar Remedio, Consulta o Síntoma</Text>
                </TouchableOpacity>

                {logs.length === 0 ? (
                  <Text style={styles.emptyText}>
                    No hay notas médicas ni tratamientos registrados para {pet.name}.
                  </Text>
                ) : (
                  logs.map((log) => (
                    <View key={log.id} style={styles.itemCard}>
                      <View style={styles.itemHeader}>
                        <View style={styles.badgeWrap}>
                          {log.category === 'medication' ? (
                            <Pill size={12} color="#1D4ED8" strokeWidth={2.2} />
                          ) : log.category === 'consultation' ? (
                            <Stethoscope size={12} color="#1D4ED8" strokeWidth={2.2} />
                          ) : (
                            <FileText size={12} color="#1D4ED8" strokeWidth={2.2} />
                          )}
                          <Text style={styles.badgeText}>
                            {log.category === 'medication'
                              ? 'REMEDIO'
                              : log.category === 'consultation'
                              ? 'CONSULTA'
                              : 'SÍNTOMA'}
                          </Text>
                        </View>
                        <Text style={styles.dateText}>{formatDateInput(log.date)}</Text>
                      </View>

                      <Text
                        style={[
                          styles.itemTitle,
                          log.is_completed === 1 && {
                            textDecorationLine: 'line-through',
                            color: '#9CA3AF',
                          },
                        ]}
                      >
                        {log.title}
                      </Text>

                      {log.dosage_schedule ? (
                        <View style={[styles.inlineMetaRow, { marginTop: 4 }]}>
                          <Clock size={14} color="#2563EB" strokeWidth={2.2} />
                          <Text style={styles.scheduleText}>
                            {log.category === 'medication'
                              ? `Horario/Dosis: ${log.dosage_schedule}`
                              : log.category === 'consultation'
                              ? `Atendido por: ${log.dosage_schedule}`
                              : `Frecuencia: ${log.dosage_schedule}`}
                          </Text>
                        </View>
                      ) : null}

                      {log.notes ? <Text style={styles.notesText}>{log.notes}</Text> : null}

                      {log.photo_uri ? (
                        <Image source={{ uri: log.photo_uri }} style={styles.stickerImage} />
                      ) : null}

                      {log.category === 'medication' && (
                        <TouchableOpacity
                          style={[
                            styles.checkBtn,
                            log.is_completed === 1 && {
                              backgroundColor: '#DCFCE7',
                              borderColor: '#86EFAC',
                            },
                          ]}
                          onPress={() => {
                            toggleMedicalLogStatus(log.id, log.is_completed === 1 ? 0 : 1);
                            loadData(pet.id);
                          }}
                        >
                          {log.is_completed === 1 ? (
                            <CheckSquare size={16} color="#15803D" strokeWidth={2.2} />
                          ) : (
                            <Square size={16} color="#6B7280" strokeWidth={2} />
                          )}
                          <Text
                            style={[
                              styles.checkBtnText,
                              log.is_completed === 1 && { color: '#15803D' },
                            ]}
                          >
                            {log.is_completed === 1
                              ? 'Tratamiento Completado'
                              : 'Marcar como completado'}
                          </Text>
                        </TouchableOpacity>
                      )}

                      <View style={styles.cardActionsRow}>
                        <TouchableOpacity
                          style={styles.actionBtn}
                          onPress={() => openEditLogModal(log)}
                        >
                          <Pencil size={13} color="#374151" strokeWidth={2.2} />
                          <Text style={styles.actionBtnText}>Editar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.deleteActionBtn]}
                          onPress={() => askDelete('log', log.id, log.title)}
                        >
                          <Trash2 size={13} color="#DC2626" strokeWidth={2.2} />
                          <Text style={styles.deleteActionText}>Borrar</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {activeTab === 'urgencia' && (
              <View style={styles.itemCard}>
                <View style={styles.sectionTitleRow}>
                  <Stethoscope size={18} color="#2563EB" strokeWidth={2.2} />
                  <Text style={styles.sectionTitle}>Veterinario de Cabecera</Text>
                </View>

                <TextInput
                  style={styles.input}
                  value={vetName}
                  onChangeText={setVetName}
                  placeholder="Nombre del Veterinario / Clínica"
                />
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginRight: 8, marginBottom: 0 }]}
                    value={vetPhone}
                    onChangeText={setVetPhone}
                    keyboardType="phone-pad"
                    placeholder="Teléfono (ej. +569...)"
                  />
                  {vetPhone ? (
                    <TouchableOpacity style={styles.callBtn} onPress={() => callPhone(vetPhone)}>
                      <Phone size={15} color="#FFF" strokeWidth={2.2} />
                      <Text style={styles.callBtnText}>Llamar</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                <View style={styles.divider} />

                <View style={styles.sectionTitleRow}>
                  <Siren size={18} color="#DC2626" strokeWidth={2.2} />
                  <Text style={[styles.sectionTitle, { color: '#DC2626' }]}>
                    Clínica de Urgencia 24/7
                  </Text>
                </View>

                <TextInput
                  style={styles.input}
                  value={clinicName}
                  onChangeText={setClinicName}
                  placeholder="Nombre Clínica 24 hrs"
                />
                <View style={[styles.row, { marginBottom: 10 }]}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginRight: 8, marginBottom: 0 }]}
                    value={clinicPhone}
                    onChangeText={setClinicPhone}
                    keyboardType="phone-pad"
                    placeholder="Teléfono Urgencia"
                  />
                  {clinicPhone ? (
                    <TouchableOpacity
                      style={[styles.callBtn, { backgroundColor: '#DC2626' }]}
                      onPress={() => callPhone(clinicPhone)}
                    >
                      <Phone size={15} color="#FFF" strokeWidth={2.2} />
                      <Text style={styles.callBtnText}>Urgencia</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                <Text style={styles.helperLabel}>
                  Ciudad / Comuna o dirección (opcional):
                </Text>
                <TextInput
                  style={styles.input}
                  value={clinicAddress}
                  onChangeText={setClinicAddress}
                  placeholder="Ej. Centro / Av. Principal 123"
                />

                <TouchableOpacity style={styles.mapBtn} onPress={openSmartMaps}>
                  <MapPin size={16} color="#1D4ED8" strokeWidth={2.2} />
                  <Text style={[styles.mapBtnText, { marginLeft: 6 }]}>
                    {clinicName ? `Buscar "${clinicName}" en Google Maps` : 'Abrir Google Maps'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.primaryBtn, { marginTop: 16 }]}
                  onPress={handleSaveEmergency}
                >
                  <Text style={styles.primaryBtnText}>Guardar Contactos de Emergencia</Text>
                </TouchableOpacity>
              </View>
            )}

            {activeTab === 'cercanas' && (
              <View style={styles.itemCard}>
                <View style={styles.sectionTitleRow}>
                  <Compass size={20} color="#2563EB" strokeWidth={2.2} />
                  <Text style={styles.sectionTitle}>Radar de Veterinarias Cercanas</Text>
                </View>
                <Text style={styles.helperLabel}>
                  Toca una categoría para buscar en el mapa usando tu ubicación actual:
                </Text>

                <TouchableOpacity
                  style={styles.nearbyCardBtn}
                  onPress={() => searchNearbyOnMap('Clínica veterinaria cerca de mi')}
                >
                  <View style={[styles.sheetIconCircle, { backgroundColor: '#DBEAFE' }]}>
                    <Stethoscope size={22} color="#2563EB" strokeWidth={2.2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetOptionTitle}>Veterinarias Cercanas</Text>
                    <Text style={styles.sheetOptionDesc}>
                      Ver todas las consultas y clínicas alrededor tuyo
                    </Text>
                  </View>
                  <Navigation size={18} color="#2563EB" strokeWidth={2.2} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.nearbyCardBtn,
                    { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
                  ]}
                  onPress={() => searchNearbyOnMap('Urgencia veterinaria 24 horas cerca de mi')}
                >
                  <View style={[styles.sheetIconCircle, { backgroundColor: '#FEE2E2' }]}>
                    <Siren size={22} color="#DC2626" strokeWidth={2.2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sheetOptionTitle, { color: '#991B1B' }]}>
                      Urgencias 24 Horas
                    </Text>
                    <Text style={[styles.sheetOptionDesc, { color: '#B91C1C' }]}>
                      Hospitales veterinarios abiertos de noche o festivos
                    </Text>
                  </View>
                  <Navigation size={18} color="#DC2626" strokeWidth={2.2} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.nearbyCardBtn}
                  onPress={() => searchNearbyOnMap('Farmacia veterinaria pet shop cerca de mi')}
                >
                  <View style={[styles.sheetIconCircle, { backgroundColor: '#DCFCE7' }]}>
                    <ShoppingBag size={22} color="#16A34A" strokeWidth={2.2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetOptionTitle}>Farmacias y Pet Shops</Text>
                    <Text style={styles.sheetOptionDesc}>
                      Remedios, alimento medicado y accesorios cercanos
                    </Text>
                  </View>
                  <Navigation size={18} color="#16A34A" strokeWidth={2.2} />
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* OVERLAYS */}
      {!petModalVisible && !vaccineModalVisible && !logModalVisible && !qrModalVisible && renderImagePickerOverlay()}
      {!petModalVisible && !vaccineModalVisible && !logModalVisible && !qrModalVisible && renderDeleteConfirmOverlay()}

      {/* MODAL: PLACA QR VCARD REAL ESCANEABLE */}
      <Modal visible={qrModalVisible} transparent animationType="fade">
        <View style={styles.qrModalOverlay}>
          <View style={styles.qrModalCard}>
            <View style={styles.sheetHandle} />
            <View style={{ alignItems: 'center', marginBottom: 14 }}>
              <View style={[styles.sheetIconCircle, { backgroundColor: '#DCFCE7', marginBottom: 8, marginRight: 0 }]}>
                <QrCode size={26} color="#15803D" strokeWidth={2.2} />
              </View>
              <Text style={styles.sheetTitle}>Placa QR de Emergencia</Text>
              <Text style={[styles.sheetSubtitle, { textAlign: 'center', marginBottom: 0 }]}>
                Escanea con la cámara de cualquier teléfono para guardar el contacto de {pet?.name} sin internet.
              </Text>
            </View>

            <View style={styles.qrMockContainer}>
              <View style={styles.qrGridBox}>
                {pet ? (
                  <QRCode
                    value={buildPetVCard(pet)}
                    size={150}
                    color="#0F172A"
                    backgroundColor="#FFFFFF"
                  />
                ) : null}
              </View>
              <Text style={styles.qrPetNameText}>{pet?.name}</Text>
              <Text style={styles.qrSubText}>
                {pet?.species} • Tutor: {pet?.owner_name || 'No asignado'}
              </Text>
              <Text style={[styles.qrSubText, { fontWeight: '700', color: '#1D4ED8', marginTop: 2 }]}>
                Tel: {pet?.owner_phone || 'Sin teléfono'}
              </Text>
              {pet?.allergies ? (
                <View style={styles.qrAlertBadge}>
                  <AlertTriangle size={12} color="#B91C1C" strokeWidth={2.2} />
                  <Text style={styles.qrAlertBadgeText}>ALERTA: {pet.allergies}</Text>
                </View>
              ) : null}
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: '#2563EB', marginTop: 0 }]}
              onPress={() => setQrModalVisible(false)}
            >
              <Text style={styles.primaryBtnText}>Cerrar Tarjeta</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL CREAR / EDITAR MASCOTA */}
      <Modal visible={petModalVisible} animationType="slide">
        <SafeAreaView style={styles.safeAreaModal}>
          {renderToastPill()}
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 90 }}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>
                  {isCreatingNewPet ? 'Nueva Mascota' : 'Editar Ficha y Tutor'}
                </Text>
                {pet && (
                  <TouchableOpacity style={styles.closeIconBtn} onPress={handleCancelPetModal}>
                    <X size={20} color="#4B5563" />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={styles.photoPicker}
                onPress={() => openImagePickerSheet('pet')}
              >
                {petPhoto ? (
                  <Image source={{ uri: petPhoto }} style={styles.pickedImage} />
                ) : (
                  <View style={styles.photoPickerInner}>
                    <View style={styles.photoIconBadge}>
                      <Camera size={22} color="#2563EB" strokeWidth={2.2} />
                    </View>
                    <Text style={styles.photoPickerText}>Tomar Foto o Elegir de Galería</Text>
                  </View>
                )}
              </TouchableOpacity>

              <View style={styles.sectionTitleRow}>
                <PawPrint size={18} color="#2563EB" strokeWidth={2.2} />
                <Text style={styles.sectionTitle}>Datos de la Mascota</Text>
              </View>

              <Text style={styles.label}>Nombre de la Mascota *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Ingresa el nombre de tu mascota"
              />

              <Text style={styles.label}>Especie *</Text>
              <View style={styles.row}>
                {(['Perro', 'Gato', 'Otra'] as const).map((sp) => (
                  <TouchableOpacity
                    key={sp}
                    style={[
                      styles.miniSelector,
                      speciesMode === sp && styles.typeSelectorActive,
                    ]}
                    onPress={() => setSpeciesMode(sp)}
                  >
                    <Text
                      style={[
                        styles.miniSelectorText,
                        speciesMode === sp && { color: '#1D4ED8', fontWeight: '700' },
                      ]}
                    >
                      {sp === 'Otra' ? 'Otra especie...' : sp}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {speciesMode === 'Otra' && (
                <TextInput
                  style={styles.input}
                  value={customSpecies}
                  onChangeText={setCustomSpecies}
                  placeholder="Escribe la especie (ej. Conejo, Tortuga...)"
                />
              )}

              <Text style={styles.label}>Sexo</Text>
              <View style={styles.row}>
                {['Macho', 'Hembra'].map((sx) => (
                  <TouchableOpacity
                    key={sx}
                    style={[styles.miniSelector, sex === sx && styles.typeSelectorActive]}
                    onPress={() => setSex(sx)}
                  >
                    <Text
                      style={[
                        styles.miniSelectorText,
                        sex === sx && { color: '#1D4ED8', fontWeight: '700' },
                      ]}
                    >
                      {sx}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Raza / Mestizo</Text>
              <TextInput
                style={styles.input}
                value={breed}
                onChangeText={setBreed}
                placeholder="Ej. Mestizo, Cocker Spaniel..."
              />

              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.label}>Peso Actual (kg)</Text>
                  <TextInput
                    style={styles.input}
                    value={weight}
                    onChangeText={setWeight}
                    keyboardType="numeric"
                    placeholder="Ej. 3.5"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Nacimiento (DD/MM/AAAA)</Text>
                  <TextInput
                    style={styles.input}
                    value={birthDate}
                    onChangeText={(t) => setBirthDate(formatDateInput(t))}
                    keyboardType="numeric"
                    maxLength={10}
                    placeholder="DD/MM/AAAA"
                  />
                </View>
              </View>

              <Text style={styles.label}>Código de Microchip (15 dígitos)</Text>
              <TextInput
                style={styles.input}
                value={microchip}
                onChangeText={handleMicrochipChange}
                keyboardType="numeric"
                maxLength={15}
                placeholder="Ej. 900118000123456"
              />

              <Text style={[styles.label, { color: '#DC2626' }]}>
                Alergias o Condiciones Críticas
              </Text>
              <TextInput
                style={[styles.input, { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' }]}
                value={allergies}
                onChangeText={setAllergies}
                placeholder="Ej. Alergia al pollo, cardíaco..."
              />

              <View style={styles.divider} />

              <View style={styles.sectionTitleRow}>
                <User size={18} color="#2563EB" strokeWidth={2.2} />
                <Text style={styles.sectionTitle}>
                  Datos del Dueño / Tutor de {name.trim() || 'esta mascota'}
                </Text>
              </View>

              {existingOwners.length > 0 && (
                <View style={{ marginBottom: 8 }}>
                  <Text style={styles.helperLabel}>
                    ¿Es el mismo tutor de otra mascota? Toca para rellenar rápido:
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {existingOwners.map((oPet) => (
                      <TouchableOpacity
                        key={oPet.id}
                        style={styles.copyOwnerPill}
                        onPress={() => copyOwnerFromPet(oPet)}
                      >
                        <User size={12} color="#1D4ED8" strokeWidth={2.2} />
                        <Text style={styles.copyOwnerPillText}>
                          Usar tutor de {oPet.name} ({oPet.owner_name})
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <Text style={styles.label}>Nombre Completo del Dueño</Text>
              <TextInput
                style={styles.input}
                value={ownerName}
                onChangeText={setOwnerName}
                placeholder="Ej. Juan Pérez"
              />

              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.label}>Teléfono de Contacto</Text>
                  <TextInput
                    style={styles.input}
                    value={ownerPhone}
                    onChangeText={setOwnerPhone}
                    keyboardType="phone-pad"
                    placeholder="+569 1234 5678"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>RUT / ID (Solo para PDF)</Text>
                  <TextInput
                    style={styles.input}
                    value={ownerRut}
                    onChangeText={setOwnerRut}
                    placeholder="12.345.678-9"
                  />
                </View>
              </View>

              <Text style={styles.label}>Dirección / Comuna</Text>
              <TextInput
                style={styles.input}
                value={ownerAddress}
                onChangeText={setOwnerAddress}
                placeholder="Ej. Villa Alemana"
              />

              <TouchableOpacity style={styles.primaryBtn} onPress={handleSavePet}>
                <Text style={styles.primaryBtnText}>
                  {isCreatingNewPet ? 'Crear Ficha de Mascota' : 'Guardar Cambios'}
                </Text>
              </TouchableOpacity>

              {pet && !isCreatingNewPet && (
                <TouchableOpacity
                  style={styles.deletePetInlineBtn}
                  onPress={() => askDelete('pet', pet.id, pet.name)}
                >
                  <Trash2 size={15} color="#DC2626" strokeWidth={2.2} />
                  <Text style={styles.deletePetInlineText}>Eliminar ficha de {pet.name}</Text>
                </TouchableOpacity>
              )}

              {pet && (
                <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelPetModal}>
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
          {renderImagePickerOverlay()}
          {renderDeleteConfirmOverlay()}
        </SafeAreaView>
      </Modal>

      {/* MODAL VACUNA */}
      <Modal visible={vaccineModalVisible} animationType="slide">
        <SafeAreaView style={styles.safeAreaModal}>
          {renderToastPill()}
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 90 }}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>
                  {editingVaccineId ? 'Editar Registro Sanitario' : 'Nuevo Registro Sanitario'}
                </Text>
                <TouchableOpacity
                  style={styles.closeIconBtn}
                  onPress={() => {
                    setImageSheetVisible(false);
                    setVaccineModalVisible(false);
                  }}
                >
                  <X size={20} color="#4B5563" />
                </TouchableOpacity>
              </View>

              <View style={styles.row}>
                <TouchableOpacity
                  style={[styles.typeSelector, vType === 'vaccine' && styles.typeSelectorActive]}
                  onPress={() => handleSwitchVaccineType('vaccine')}
                >
                  <Syringe
                    size={16}
                    color={vType === 'vaccine' ? '#1D4ED8' : '#6B7280'}
                    strokeWidth={2.2}
                  />
                  <Text
                    style={[
                      styles.typeSelectorText,
                      vType === 'vaccine' && { color: '#1D4ED8' },
                    ]}
                  >
                    Vacuna
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeSelector, vType === 'deworming' && styles.typeSelectorActive]}
                  onPress={() => handleSwitchVaccineType('deworming')}
                >
                  <ShieldCheck
                    size={16}
                    color={vType === 'deworming' ? '#1D4ED8' : '#6B7280'}
                    strokeWidth={2.2}
                  />
                  <Text
                    style={[
                      styles.typeSelectorText,
                      vType === 'deworming' && { color: '#1D4ED8' },
                    ]}
                  >
                    Antiparasitario
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>
                {vType === 'vaccine' ? 'Nombre de la Vacuna *' : 'Producto Antiparasitario *'}
              </Text>
              <TextInput
                style={styles.input}
                value={vProduct}
                onChangeText={setVProduct}
                placeholder={
                  vType === 'vaccine'
                    ? 'Ej. Óctuple, Antirrábica...'
                    : 'Ej. Bravecto, NexGard...'
                }
              />

              <Text style={styles.label}>Fecha de Aplicación *</Text>
              <TextInput
                style={styles.input}
                value={vApplied}
                onChangeText={(t) => setVApplied(formatDateInput(t))}
                keyboardType="numeric"
                maxLength={10}
                placeholder="DD/MM/AAAA"
              />

              <Text style={styles.label}>Fecha Próxima Dosis / Refuerzo (Recordatorio 9:00 AM)</Text>
              <TextInput
                style={styles.input}
                value={vNext}
                onChangeText={(t) => setVNext(formatDateInput(t))}
                keyboardType="numeric"
                maxLength={10}
                placeholder="DD/MM/AAAA"
              />

              <TouchableOpacity
                style={styles.photoPicker}
                onPress={() => openImagePickerSheet('vaccine')}
              >
                {vPhoto ? (
                  <Image source={{ uri: vPhoto }} style={styles.pickedImage} />
                ) : (
                  <View style={styles.photoPickerInner}>
                    <View style={styles.photoIconBadge}>
                      <Camera size={22} color="#2563EB" strokeWidth={2.2} />
                    </View>
                    <Text style={styles.photoPickerText}>
                      Tomar Foto a Etiqueta/Sticker o Galería
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveVaccine}>
                <Text style={styles.primaryBtnText}>
                  {editingVaccineId ? 'Guardar Cambios' : 'Guardar y Agendar Recordatorio'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setImageSheetVisible(false);
                  setVaccineModalVisible(false);
                }}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
          {renderImagePickerOverlay()}
        </SafeAreaView>
      </Modal>

      {/* MODAL BITÁCORA */}
      <Modal visible={logModalVisible} animationType="slide">
        <SafeAreaView style={styles.safeAreaModal}>
          {renderToastPill()}
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 90 }}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>
                  {editingLogId ? 'Editar Registro de Bitácora' : 'Nuevo Registro en Bitácora'}
                </Text>
                <TouchableOpacity
                  style={styles.closeIconBtn}
                  onPress={() => {
                    setImageSheetVisible(false);
                    setLogModalVisible(false);
                  }}
                >
                  <X size={20} color="#4B5563" />
                </TouchableOpacity>
              </View>

              <View style={styles.row}>
                <TouchableOpacity
                  style={[
                    styles.typeSelector,
                    lCategory === 'medication' && styles.typeSelectorActive,
                  ]}
                  onPress={() => handleSwitchLogCategory('medication')}
                >
                  <Pill
                    size={15}
                    color={lCategory === 'medication' ? '#1D4ED8' : '#6B7280'}
                    strokeWidth={2.2}
                  />
                  <Text
                    style={[
                      styles.typeSelectorText,
                      lCategory === 'medication' && { color: '#1D4ED8' },
                    ]}
                  >
                    Remedio
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeSelector,
                    lCategory === 'consultation' && styles.typeSelectorActive,
                  ]}
                  onPress={() => handleSwitchLogCategory('consultation')}
                >
                  <Stethoscope
                    size={15}
                    color={lCategory === 'consultation' ? '#1D4ED8' : '#6B7280'}
                    strokeWidth={2.2}
                  />
                  <Text
                    style={[
                      styles.typeSelectorText,
                      lCategory === 'consultation' && { color: '#1D4ED8' },
                    ]}
                  >
                    Consulta
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeSelector,
                    lCategory === 'symptom' && styles.typeSelectorActive,
                  ]}
                  onPress={() => handleSwitchLogCategory('symptom')}
                >
                  <FileText
                    size={15}
                    color={lCategory === 'symptom' ? '#1D4ED8' : '#6B7280'}
                    strokeWidth={2.2}
                  />
                  <Text
                    style={[
                      styles.typeSelectorText,
                      lCategory === 'symptom' && { color: '#1D4ED8' },
                    ]}
                  >
                    Síntoma
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>{logLabels.titleLabel}</Text>
              <TextInput
                style={styles.input}
                value={lTitle}
                onChangeText={setLTitle}
                placeholder={logLabels.titlePlaceholder}
              />

              {lCategory === 'medication' && (
                <View style={{ marginBottom: 4 }}>
                  <View style={styles.inlineMetaRow}>
                    <Bell size={13} color="#2563EB" strokeWidth={2.2} />
                    <Text style={[styles.label, { marginTop: 0, marginLeft: 5 }]}>
                      Programar Alarma de Toma
                    </Text>
                  </View>
                  <View style={styles.row}>
                    {[
                      { label: 'Cada 8h', hrs: 8 },
                      { label: 'Cada 12h', hrs: 12 },
                      { label: 'Cada 24h', hrs: 24 },
                      { label: 'Sin alarma', hrs: null },
                    ].map((opt) => (
                      <TouchableOpacity
                        key={opt.label}
                        style={[
                          styles.miniSelector,
                          lAlarmHours === opt.hrs && styles.typeSelectorActive,
                        ]}
                        onPress={() => setLAlarmHours(opt.hrs)}
                      >
                        <Text
                          style={[
                            styles.miniSelectorText,
                            { fontSize: 12 },
                            lAlarmHours === opt.hrs && { color: '#1D4ED8', fontWeight: '700' },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <Text style={styles.label}>{logLabels.secondaryLabel}</Text>
              <TextInput
                style={styles.input}
                value={lSchedule}
                onChangeText={setLSchedule}
                placeholder={logLabels.secondaryPlaceholder}
              />

              <Text style={styles.label}>Fecha del Registro</Text>
              <TextInput
                style={styles.input}
                value={lDate}
                onChangeText={(t) => setLDate(formatDateInput(t))}
                keyboardType="numeric"
                maxLength={10}
                placeholder="DD/MM/AAAA"
              />

              <Text style={styles.label}>{logLabels.notesLabel}</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                multiline
                value={lNotes}
                onChangeText={setLNotes}
                placeholder={logLabels.notesPlaceholder}
              />

              <TouchableOpacity
                style={styles.photoPicker}
                onPress={() => openImagePickerSheet('log')}
              >
                {lPhoto ? (
                  <Image source={{ uri: lPhoto }} style={styles.pickedImage} />
                ) : (
                  <View style={styles.photoPickerInner}>
                    <View style={styles.photoIconBadge}>
                      <Camera size={22} color="#2563EB" strokeWidth={2.2} />
                    </View>
                    <Text style={styles.photoPickerText}>
                      Adjuntar Foto de Receta / Orden (Opcional)
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveLog}>
                <Text style={styles.primaryBtnText}>
                  {editingLogId ? 'Guardar Cambios' : 'Guardar en Bitácora'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setImageSheetVisible(false);
                  setLogModalVisible(false);
                }}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
          {renderImagePickerOverlay()}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 6 : 6,
  },
  safeAreaModal: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 6 : 12,
  },
  welcomeScroll: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  welcomeHeroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  welcomeIconBadge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  welcomeTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 10,
  },
  welcomeTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
    marginLeft: 5,
  },
  brandTitle: { fontSize: 32, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  emptySubtitle: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
  },
  welcomeFeaturesList: {
    marginBottom: 20,
  },
  welcomeFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  welcomeFeatureIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  welcomeFeatureTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  welcomeFeatureDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 17,
  },
  welcomePrimaryBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  petSwitcherBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    paddingVertical: 8,
  },
  petSwitcherScroll: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  petPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    marginRight: 8,
  },
  petPillActive: {
    backgroundColor: '#2563EB',
  },
  petPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 6,
  },
  petPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  addPetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  addPetPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
    marginLeft: 4,
  },
  toastPill: {
    position: 'absolute',
    bottom: 76,
    alignSelf: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 99999,
    elevation: 16,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  toastIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  toastText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  headerCard: {
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  headerTop: { flexDirection: 'row', alignItems: 'center' },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  avatarCameraCorner: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  headerInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  petName: { fontSize: 21, fontWeight: 'bold', color: '#111827' },
  editBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  editBadgeText: { fontSize: 12, color: '#374151', fontWeight: '600' },
  petMeta: { fontSize: 13, color: '#4B5563', marginTop: 2 },
  inlineMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  chipText: { fontSize: 12, color: '#6B7280', marginLeft: 5 },
  chipHighlight: { fontSize: 12, color: '#1D4ED8', fontWeight: '600', marginLeft: 5 },
  ownerBar: {
    marginTop: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ownerBarTitle: { fontSize: 13, fontWeight: 'bold', color: '#1E293B', marginLeft: 6 },
  ownerBarSub: { fontSize: 12, color: '#64748B', marginLeft: 6 },
  ownerCallBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  ownerCallText: { fontSize: 12, fontWeight: 'bold', color: '#166534' },
  addOwnerPrompt: {
    marginTop: 10,
    padding: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#94A3B8',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addOwnerPromptText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  copyOwnerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 8,
  },
  copyOwnerPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1D4ED8',
    marginLeft: 5,
  },
  allergyBanner: {
    marginTop: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  allergyText: { color: '#B91C1C', fontWeight: 'bold', fontSize: 13, marginLeft: 8, flex: 1 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderColor: 'transparent',
  },
  activeTab: { borderColor: '#2563EB' },
  tabText: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginLeft: 4 },
  activeTabText: { color: '#2563EB', fontWeight: '700' },
  content: { flex: 1, padding: 16 },
  addBtn: {
    backgroundColor: '#2563EB',
    padding: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  addBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 15, marginLeft: 6 },
  emptyText: { textAlign: 'center', color: '#6B7280', marginTop: 32, fontSize: 14 },
  itemCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  badgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 11, fontWeight: 'bold', color: '#1D4ED8', marginLeft: 4 },
  dateText: { fontSize: 12, color: '#6B7280' },
  itemTitle: { fontSize: 17, fontWeight: 'bold', color: '#111827', marginTop: 2 },
  nextDueText: { fontSize: 13, color: '#D97706', fontWeight: '600', marginLeft: 6 },
  scheduleText: { fontSize: 13, color: '#2563EB', fontWeight: '600', marginLeft: 6 },
  notesText: { fontSize: 14, color: '#4B5563', marginTop: 6 },
  stickerImage: { width: '100%', height: 150, borderRadius: 10, marginTop: 10 },
  checkBtn: {
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkBtnText: { fontSize: 13, fontWeight: '600', color: '#374151', marginLeft: 6 },
  cardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#F3F4F6',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    marginLeft: 8,
  },
  actionBtnText: { fontSize: 12, fontWeight: '600', color: '#374151', marginLeft: 5 },
  deleteActionBtn: { backgroundColor: '#FEF2F2' },
  deleteActionText: { fontSize: 12, fontWeight: '600', color: '#DC2626', marginLeft: 5 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827', marginLeft: 6 },
  helperLabel: { fontSize: 12, color: '#6B7280', marginBottom: 8 },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 16 },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: { fontSize: 21, fontWeight: 'bold', color: '#111827' },
  closeIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    padding: 11,
    fontSize: 15,
    backgroundColor: '#F9FAFB',
    marginBottom: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  photoPicker: {
    height: 130,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#93C5FD',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 12,
    overflow: 'hidden',
  },
  photoPickerInner: { alignItems: 'center', paddingHorizontal: 12 },
  photoIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  pickedImage: { width: '100%', height: '100%' },
  photoPickerText: { color: '#2563EB', fontWeight: '600', fontSize: 13, textAlign: 'center' },
  primaryBtn: {
    backgroundColor: '#16A34A',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  cancelBtn: { padding: 14, alignItems: 'center', marginTop: 4 },
  cancelBtnText: { color: '#6B7280', fontWeight: '600', fontSize: 15 },
  deletePetInlineBtn: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deletePetInlineText: {
    color: '#DC2626',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
  },
  typeSelector: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 11,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    alignItems: 'center',
    marginRight: 6,
  },
  miniSelector: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 6,
    backgroundColor: '#F9FAFB',
  },
  miniSelectorText: { fontSize: 13, fontWeight: '600', color: '#4B5563' },
  typeSelectorActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  typeSelectorText: { fontWeight: '600', fontSize: 13, color: '#4B5563', marginLeft: 6 },
  callBtn: {
    backgroundColor: '#16A34A',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  callBtnText: { color: '#FFF', fontWeight: 'bold', marginLeft: 5 },
  mapBtn: {
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginTop: 4,
  },
  mapBtnText: { color: '#1D4ED8', fontWeight: 'bold', fontSize: 14 },
  nearbyCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
  },
  inlineSheetOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    justifyContent: 'flex-end',
  },
  inlineSheetBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  bottomSheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 68,
    elevation: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  sheetHandle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: { fontSize: 19, fontWeight: 'bold', color: '#0F172A', marginBottom: 4 },
  sheetSubtitle: { fontSize: 13, color: '#64748B', marginBottom: 16 },
  sheetOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
  },
  sheetIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  sheetOptionTitle: { fontSize: 15, fontWeight: 'bold', color: '#1E293B' },
  sheetOptionDesc: { fontSize: 12, color: '#64748B', marginTop: 2 },
  sheetCancelBtn: {
    marginTop: 6,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  sheetCancelText: { fontSize: 15, fontWeight: '600', color: '#475569' },
  deleteSheetHeader: { alignItems: 'center', marginBottom: 8 },
  dangerBtn: {
    backgroundColor: '#DC2626',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 6,
  },
  dangerBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 },
  qrModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  qrModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    width: '100%',
    maxWidth: 380,
    elevation: 20,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  qrMockContainer: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  qrGridBox: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 12,
  },
  qrPetNameText: { fontSize: 18, fontWeight: 'bold', color: '#0F172A' },
  qrSubText: { fontSize: 12, color: '#64748B', marginTop: 2 },
  qrAlertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 8,
  },
  qrAlertBadgeText: { fontSize: 11, fontWeight: 'bold', color: '#B91C1C', marginLeft: 4 },
});