import React, { useEffect, useState, useRef } from 'react';
import {
  Text, View, ScrollView, TouchableOpacity, TextInput, Modal,
  Image, Linking, SafeAreaView, StatusBar, Platform, KeyboardAvoidingView, Animated,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from './src/config/firebase';
import CloudAccountModal from './src/components/CloudAccountModal';
import QrEmergencyModal from './src/components/QrEmergencyModal';
import FamilySyncModal from './src/components/FamilySyncModal';
import { uploadPetToCloud, subscribeToSharedPet } from './src/services/cloudSync';
import { styles } from './src/styles/appStyles';
import {
  formatDateInput, parseDateTo9AM, requestNotificationPermissions,
  scheduleRealNotification, exportPetSanitaryPDF,
} from './src/utils/helpers';
import {
  PawPrint, Syringe, ShieldCheck, Pill, Stethoscope, FileText, Siren,
  Pencil, Trash2, Camera, Image as ImageIcon, Phone, MapPin, AlertTriangle,
  CheckCircle2, Square, CheckSquare, User, Calendar, Clock, Cpu, Plus,
  Compass, Navigation, ShoppingBag, FileDown, Sparkles, QrCode, X, Bell, Cloud, Share2,
} from 'lucide-react-native';
import {
  initDatabase, getPets, savePet, updatePet, deletePet,
  getVaccinesDeworming, addVaccineDeworming, updateVaccineDeworming, deleteVaccineDeworming,
  getMedicalLogs, addMedicalLog, updateMedicalLog, deleteMedicalLog, toggleMedicalLogStatus,
  getEmergencyContact, saveOrUpdateEmergency,
} from './src/database/db';
import { Pet, VaccineDeworming, MedicalLog } from './src/types/petpass';

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
  const [cloudModalVisible, setCloudModalVisible] = useState(false);
  const [familyModalVisible, setFamilyModalVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);

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

  // Estados Formulario Mascota
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

  // Estados Formulario Vacuna
  const [vType, setVType] = useState<'vaccine' | 'deworming'>('vaccine');
  const [vProduct, setVProduct] = useState('');
  const [vApplied, setVApplied] = useState('');
  const [vNext, setVNext] = useState('');
  const [vPhoto, setVPhoto] = useState<string | null>(null);

  // Estados Formulario Bitácora
  const [lCategory, setLCategory] = useState<'medication' | 'consultation' | 'symptom'>('medication');
  const [lTitle, setLTitle] = useState('');
  const [lSchedule, setLSchedule] = useState('');
  const [lAlarmHours, setLAlarmHours] = useState<number | null>(8);
  const [lNotes, setLNotes] = useState('');
  const [lDate, setLDate] = useState('');
  const [lPhoto, setLPhoto] = useState<string | null>(null);

  // Estados Contactos de Emergencia
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
    const unsub = onAuthStateChanged(auth, (u) => setCurrentUser(u));
    return () => unsub();
  }, []);

  // Escucha en vivo cualquier cambio en la nube de la mascota seleccionada (Sincronización en Tiempo Real)
  useEffect(() => {
    if (!pet?.cloud_id) return;
    const unsubscribe = subscribeToSharedPet(pet.cloud_id, (updatedLocalId) => {
      loadData(updatedLocalId);
    });
    return () => unsubscribe();
  }, [pet?.id, pet?.cloud_id]);

  // Auto-sincroniza hacia la nube cada vez que editas algo localmente
  const triggerAutoSync = (petId?: number) => {
    if (!auth.currentUser || !petId) return;
    const latestPet = getPets().find((p) => p.id === petId);
    if (latestPet?.cloud_id) {
      uploadPetToCloud(latestPet).catch((err) => console.warn('AutoSync:', err));
    }
  };

  const showToast = (message: string, type: 'success' | 'delete' | 'warning' = 'success') => {
    setToastMsg(message);
    setToastType(type);
    Animated.sequence([
      Animated.spring(toastAnim, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 6 }),
      Animated.delay(2400),
      Animated.timing(toastAnim, { toValue: 160, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  const renderToastPill = () => (
    <Animated.View pointerEvents="none" style={[styles.toastPill, { transform: [{ translateY: toastAnim }] }]}>
      <View
        style={[
          styles.toastIconWrap,
          { backgroundColor: toastType === 'delete' ? '#FEE2E2' : toastType === 'warning' ? '#FEF3C7' : '#DCFCE7' },
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
        <TouchableOpacity style={styles.inlineSheetBackdrop} activeOpacity={1} onPress={() => setImageSheetVisible(false)} />
        <View style={styles.bottomSheetCard}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Adjuntar Fotografía</Text>
          <Text style={styles.sheetSubtitle}>Elige cómo quieres agregar la imagen al registro</Text>

          <TouchableOpacity style={styles.sheetOptionBtn} onPress={handleTakePhoto}>
            <View style={[styles.sheetIconCircle, { backgroundColor: '#DBEAFE' }]}>
              <Camera size={22} color="#2563EB" strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetOptionTitle}>Tomar foto con la Cámara</Text>
              <Text style={styles.sheetOptionDesc}>Capturar foto de la mascota, sticker o receta ahora</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sheetOptionBtn} onPress={handlePickGallery}>
            <View style={[styles.sheetIconCircle, { backgroundColor: '#E0E7FF' }]}>
              <ImageIcon size={22} color="#4F46E5" strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetOptionTitle}>Elegir de la Galería</Text>
              <Text style={styles.sheetOptionDesc}>Selecciona una foto guardada en tu teléfono</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sheetCancelBtn} onPress={() => setImageSheetVisible(false)}>
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
        <TouchableOpacity style={styles.inlineSheetBackdrop} activeOpacity={1} onPress={() => setDeleteSheetVisible(false)} />
        <View style={styles.bottomSheetCard}>
          <View style={styles.sheetHandle} />
          <View style={styles.deleteSheetHeader}>
            <View style={[styles.sheetIconCircle, { backgroundColor: '#FEE2E2', marginRight: 0, marginBottom: 10 }]}>
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

          <TouchableOpacity style={styles.sheetCancelBtn} onPress={() => setDeleteSheetVisible(false)}>
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
      setVetName(em?.vet_name || '');
      setVetPhone(em?.vet_phone || '');
      setClinicName(em?.emergency_clinic_name || '');
      setClinicPhone(em?.emergency_clinic_phone || '');
      setClinicAddress(em?.emergency_address || '');
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
      const exactMatch = petsList.find((p) => p.microchip === clean && (p.owner_name || p.owner_phone));
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
    if (pet) fillPetForm(pet);
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
      triggerAutoSync(pet.id);
      showToast(`Foto de ${pet.name} actualizada`, 'success');
    } else if (imageTarget === 'vaccine') {
      setVPhoto(uri);
      showToast('Foto de etiqueta adjuntada', 'success');
    } else if (imageTarget === 'log') {
      setLPhoto(uri);
      showToast('Foto adjuntada a la bitácora', 'success');
    }
  };

  // Convierte la foto a data:image/jpeg;base64 para que sincronice directo entre Android e iOS
  const extractImageUri = (asset: ImagePicker.ImagePickerAsset): string => {
    if (asset.base64) {
      return `data:image/jpeg;base64,${asset.base64}`;
    }
    return asset.uri;
  };

  const handleTakePhoto = async () => {
    setImageSheetVisible(false);
    setTimeout(async () => {
      try {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return showToast('Activa el permiso de cámara en Configuración', 'warning');
        const result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          quality: 0.35,
          base64: true,
        });
        if (!result.canceled && result.assets?.length) {
          applySelectedImage(extractImageUri(result.assets[0]));
        }
      } catch (err) {
        showToast('No se pudo abrir la cámara', 'warning');
      }
    }, 150);
  };

  const handlePickGallery = async () => {
    setImageSheetVisible(false);
    setTimeout(async () => {
      try {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return showToast('Activa el permiso de Fotos en Configuración', 'warning');
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          quality: 0.35,
          base64: true,
        });
        if (!result.canceled && result.assets?.length) {
          applySelectedImage(extractImageUri(result.assets[0]));
        }
      } catch (err) {
        showToast('No se pudo abrir la galería', 'warning');
      }
    }, 150);
  };

  const handleSavePet = () => {
    if (!name.trim()) return showToast('Ingresa el nombre de la mascota', 'warning');
    const finalSpecies = speciesMode === 'Otra' ? customSpecies.trim() : speciesMode;
    if (!finalSpecies) return showToast('Escribe qué especie es la mascota', 'warning');

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
      cloud_id: !isCreatingNewPet ? pet?.cloud_id : null,
    };

    if (pet && !isCreatingNewPet) {
      updatePet({ ...petData, id: pet.id });
      setPetModalVisible(false);
      loadData(pet.id);
      triggerAutoSync(pet.id);
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
      await exportPetSanitaryPDF(pet, vaccines, logs, getEmergencyContact(pet.id));
    } catch (error) {
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
      return showToast(vType === 'vaccine' ? 'Ingresa el nombre de la vacuna' : 'Ingresa el antiparasitario', 'warning');
    }
    if (!vApplied.trim() || vApplied.trim().length < 10) {
      return showToast('Completa la fecha de aplicación (DD/MM/AAAA)', 'warning');
    }
    if (vNext.trim() && vNext.trim().length < 10) {
      return showToast('Completa la fecha de próxima dosis (DD/MM/AAAA)', 'warning');
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

    const payload = {
      pet_id: pet.id,
      type: vType,
      product_name: vProduct.trim(),
      applied_date: vApplied.trim(),
      next_due_date: vNext.trim(),
      photo_uri: vPhoto,
    };

    if (editingVaccineId) {
      updateVaccineDeworming({ ...payload, id: editingVaccineId });
      showToast(alarmScheduled ? 'Actualizado y recordatorio agendado' : 'Registro sanitario actualizado', 'success');
    } else {
      addVaccineDeworming(payload);
      showToast(alarmScheduled ? 'Guardado y recordatorio agendado' : 'Guardado en el Carnet', 'success');
    }
    setVaccineModalVisible(false);
    loadData(pet.id);
    triggerAutoSync(pet.id);
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
      return showToast(
        lCategory === 'medication'
          ? 'Ingresa el nombre del medicamento'
          : lCategory === 'consultation'
          ? 'Ingresa el motivo de la consulta'
          : 'Describe el síntoma observado',
        'warning'
      );
    }
    if (lDate.trim() && lDate.trim().length < 10) {
      return showToast('Completa la fecha del registro (DD/MM/AAAA)', 'warning');
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
    const logPayload = {
      pet_id: pet.id,
      category: lCategory,
      title: lTitle.trim(),
      notes: lNotes.trim(),
      dosage_schedule: finalSchedule,
      is_completed: 0,
      date: lDate.trim() || today,
      photo_uri: lPhoto,
    };

    if (editingLogId) {
      updateMedicalLog({ ...logPayload, id: editingLogId });
      showToast(alarmSet ? `Bitácora actualizada (aviso en ${lAlarmHours}h)` : 'Bitácora actualizada', 'success');
    } else {
      addMedicalLog(logPayload);
      showToast(alarmSet ? `Guardado • Alarma en ${lAlarmHours} hrs` : 'Agregado a la bitácora', 'success');
    }
    setLogModalVisible(false);
    loadData(pet.id);
    triggerAutoSync(pet.id);
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
      triggerAutoSync(pet?.id);
    } else if (deleteTarget.type === 'log') {
      deleteMedicalLog(deleteTarget.id);
      showToast('Borrado de la bitácora', 'delete');
      loadData(pet?.id);
      triggerAutoSync(pet?.id);
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
    triggerAutoSync(pet.id);
    showToast('Contactos de emergencia guardados', 'success');
  };

  const callPhone = (phone: string) => {
    if (phone.trim()) Linking.openURL(`tel:${phone.trim()}`);
  };

  const openSmartMaps = () => {
    const query = [clinicName.trim(), clinicAddress.trim()].filter(Boolean).join(', ');
    if (!query) return Linking.openURL('https://www.google.com/maps/search/?api=1&query=veterinaria+cerca+de+mi');
    if (clinicAddress.trim().startsWith('http')) return Linking.openURL(clinicAddress.trim());
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`);
  };

  const searchNearbyOnMap = (searchTerm: string) => {
    const term = searchTerm.trim() || 'veterinaria cerca de mi';
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(term)}`);
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
            {[
              {
                bg: '#DBEAFE',
                icon: <Syringe size={20} color="#2563EB" strokeWidth={2.2} />,
                title: 'Carnet, PDF y Placa QR',
                desc: 'Exporta carnets formales a PDF con credencial QR vCard escaneable offline.',
              },
              {
                bg: '#DCFCE7',
                icon: <Pill size={20} color="#16A34A" strokeWidth={2.2} />,
                title: 'Bitácora con Alarmas Locales',
                desc: 'Recibe avisos automáticos en tu teléfono para próximas dosis y remedios.',
              },
              {
                bg: '#FEE2E2',
                icon: <Siren size={20} color="#DC2626" strokeWidth={2.2} />,
                title: 'Sincronización Familiar y Urgencias',
                desc: 'Comparte la ficha con tu pareja en tiempo real y ubica clínicas cercanas.',
              },
            ].map((feat) => (
              <View key={feat.title} style={styles.welcomeFeatureItem}>
                <View style={[styles.welcomeFeatureIcon, { backgroundColor: feat.bg }]}>{feat.icon}</View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.welcomeFeatureTitle}>{feat.title}</Text>
                  <Text style={styles.welcomeFeatureDesc}>{feat.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.welcomePrimaryBtn} onPress={openCreateNewPetModal}>
            <Plus size={20} color="#FFF" strokeWidth={2.5} />
            <Text style={[styles.primaryBtnText, { marginLeft: 8 }]}>Crear Ficha de mi Mascota</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <TouchableOpacity
              style={[
                styles.addPetPill,
                {
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  backgroundColor: currentUser ? '#DCFCE7' : '#FFFFFF',
                  borderColor: currentUser ? '#86EFAC' : '#CBD5E1',
                },
              ]}
              onPress={() => setCloudModalVisible(true)}
            >
              <Cloud size={15} color={currentUser ? '#15803D' : '#2563EB'} strokeWidth={2.3} />
              <Text style={[styles.addPetPillText, { fontSize: 12.5, marginLeft: 6, color: currentUser ? '#15803D' : '#2563EB' }]}>
                {currentUser ? `Cuenta: ${currentUser.displayName || currentUser.email}` : 'Conectar PetPass Cloud'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.addPetPill,
                { paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#F3E8FF', borderColor: '#D8B4FE' },
              ]}
              onPress={() => setFamilyModalVisible(true)}
            >
              <Share2 size={15} color="#7C3AED" strokeWidth={2.3} />
              <Text style={[styles.addPetPillText, { fontSize: 12.5, marginLeft: 6, color: '#7C3AED' }]}>
                Vincular con Código Familiar
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 25}
        >
          {/* BARRA SUPERIOR: MASCOTAS + ACCESO FAMILIAR + NUBE */}
          <View style={styles.petSwitcherBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.petSwitcherScroll}>
              {petsList.map((item) => {
                const isSelected = item.id === pet.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.petPill, isSelected && styles.petPillActive]}
                    onPress={() => loadData(item.id)}
                  >
                    <PawPrint size={14} color={isSelected ? '#FFFFFF' : '#4B5563'} strokeWidth={2.2} />
                    <Text style={[styles.petPillText, isSelected && styles.petPillTextActive]}>{item.name}</Text>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity style={styles.addPetPill} onPress={openCreateNewPetModal}>
                <Plus size={14} color="#2563EB" strokeWidth={2.5} />
                <Text style={styles.addPetPillText}>Nueva</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.addPetPill,
                  {
                    marginLeft: 6,
                    backgroundColor: '#F3E8FF',
                    borderColor: '#D8B4FE',
                  },
                ]}
                onPress={() => setFamilyModalVisible(true)}
              >
                <Share2 size={13} color="#7C3AED" strokeWidth={2.3} />
                <Text style={[styles.addPetPillText, { color: '#7C3AED' }]}>
                  Familiar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.addPetPill,
                  {
                    marginLeft: 6,
                    backgroundColor: currentUser ? '#DCFCE7' : '#F1F5F9',
                    borderColor: currentUser ? '#86EFAC' : '#CBD5E1',
                  },
                ]}
                onPress={() => setCloudModalVisible(true)}
              >
                <Cloud size={14} color={currentUser ? '#15803D' : '#475569'} strokeWidth={2.3} />
                <Text style={[styles.addPetPillText, { color: currentUser ? '#15803D' : '#475569' }]}>
                  {currentUser ? currentUser.displayName || 'Conectado' : 'Nube'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* TARJETA SUPERIOR DEL PERFIL (DISEÑO ORIGINAL LIMPIO EN 1 SOLA LÍNEA) */}
          <View style={styles.headerCard}>
            <View style={styles.headerTop}>
              <TouchableOpacity style={styles.avatarContainer} onPress={() => openImagePickerSheet('pet_direct')}>
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
                  <Text style={[styles.petName, { flex: 1, marginRight: 6 }]} numberOfLines={1}>
                    {pet.name}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                      style={[
                        styles.editBadge,
                        { backgroundColor: '#F3E8FF', borderColor: '#D8B4FE', borderWidth: 1, marginRight: 5, paddingHorizontal: 8 },
                      ]}
                      onPress={() => setFamilyModalVisible(true)}
                    >
                      <Share2 size={13} color="#7C3AED" strokeWidth={2.2} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.editBadge,
                        { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', borderWidth: 1, marginRight: 5, paddingHorizontal: 8 },
                      ]}
                      onPress={() => setQrModalVisible(true)}
                    >
                      <QrCode size={13} color="#15803D" strokeWidth={2.2} />
                      <Text style={[styles.editBadgeText, { color: '#15803D', marginLeft: 3 }]}>QR</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.editBadge,
                        { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', borderWidth: 1, marginRight: 5, paddingHorizontal: 8 },
                      ]}
                      onPress={handleExportPDF}
                    >
                      <FileDown size={13} color="#1D4ED8" strokeWidth={2.2} />
                      <Text style={[styles.editBadgeText, { color: '#1D4ED8', marginLeft: 3 }]}>PDF</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.editBadge, { paddingHorizontal: 8 }]} onPress={openEditPetModal}>
                      <Pencil size={13} color="#374151" strokeWidth={2.2} />
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
                    <Text style={styles.ownerBarTitle}>Tutor: {pet.owner_name || 'Sin nombre'}</Text>
                  </View>
                  {pet.owner_address ? (
                    <View style={[styles.inlineMetaRow, { marginTop: 3 }]}>
                      <MapPin size={12} color="#64748B" strokeWidth={2} />
                      <Text style={styles.ownerBarSub}>{pet.owner_address}</Text>
                    </View>
                  ) : null}
                </View>
                {pet.owner_phone ? (
                  <TouchableOpacity style={styles.ownerCallBadge} onPress={() => callPhone(pet.owner_phone)}>
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
            <TouchableOpacity style={[styles.tab, activeTab === 'carnet' && styles.activeTab]} onPress={() => setActiveTab('carnet')}>
              <Syringe size={15} color={activeTab === 'carnet' ? '#2563EB' : '#6B7280'} strokeWidth={2.2} />
              <Text style={[styles.tabText, activeTab === 'carnet' && styles.activeTabText]}>Carnet ({vaccines.length})</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.tab, activeTab === 'bitacora' && styles.activeTab]} onPress={() => setActiveTab('bitacora')}>
              <Pill size={15} color={activeTab === 'bitacora' ? '#2563EB' : '#6B7280'} strokeWidth={2.2} />
              <Text style={[styles.tabText, activeTab === 'bitacora' && styles.activeTabText]}>Bitácora ({logs.length})</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'urgencia' && { borderColor: '#DC2626' }]}
              onPress={() => setActiveTab('urgencia')}
            >
              <Siren size={15} color={activeTab === 'urgencia' ? '#DC2626' : '#6B7280'} strokeWidth={2.2} />
              <Text style={[styles.tabText, activeTab === 'urgencia' && { color: '#DC2626', fontWeight: '700' }]}>Urgencia</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.tab, activeTab === 'cercanas' && styles.activeTab]} onPress={() => setActiveTab('cercanas')}>
              <Compass size={15} color={activeTab === 'cercanas' ? '#2563EB' : '#6B7280'} strokeWidth={2.2} />
              <Text style={[styles.tabText, activeTab === 'cercanas' && styles.activeTabText]}>Cercanas</Text>
            </TouchableOpacity>
          </View>

          {/* CONTENIDO */}
          <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 130 }} keyboardShouldPersistTaps="handled">
            {activeTab === 'carnet' && (
              <View>
                <TouchableOpacity style={styles.addBtn} onPress={openNewVaccineModal}>
                  <Plus size={18} color="#FFF" strokeWidth={2.5} />
                  <Text style={styles.addBtnText}>Registrar Vacuna o Antiparasitario</Text>
                </TouchableOpacity>

                {vaccines.length === 0 ? (
                  <Text style={styles.emptyText}>No hay vacunas ni desparasitaciones registradas para {pet.name}.</Text>
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
                          <Text style={styles.badgeText}>{item.type === 'vaccine' ? 'VACUNA' : 'ANTIPARASITARIO'}</Text>
                        </View>
                        <Text style={styles.dateText}>Aplicada: {formatDateInput(item.applied_date)}</Text>
                      </View>

                      <Text style={styles.itemTitle}>{item.product_name}</Text>

                      {item.next_due_date ? (
                        <View style={[styles.inlineMetaRow, { marginTop: 6 }]}>
                          <Calendar size={14} color="#D97706" strokeWidth={2.2} />
                          <Text style={styles.nextDueText}>Próxima dosis: {formatDateInput(item.next_due_date)}</Text>
                        </View>
                      ) : null}

                      {item.photo_uri ? <Image source={{ uri: item.photo_uri }} style={styles.stickerImage} /> : null}

                      <View style={styles.cardActionsRow}>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => openEditVaccineModal(item)}>
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
                  <Text style={styles.emptyText}>No hay notas médicas ni tratamientos registrados para {pet.name}.</Text>
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
                            {log.category === 'medication' ? 'REMEDIO' : log.category === 'consultation' ? 'CONSULTA' : 'SÍNTOMA'}
                          </Text>
                        </View>
                        <Text style={styles.dateText}>{formatDateInput(log.date)}</Text>
                      </View>

                      <Text style={[styles.itemTitle, log.is_completed === 1 && { textDecorationLine: 'line-through', color: '#9CA3AF' }]}>
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
                      {log.photo_uri ? <Image source={{ uri: log.photo_uri }} style={styles.stickerImage} /> : null}

                      {log.category === 'medication' && (
                        <TouchableOpacity
                          style={[styles.checkBtn, log.is_completed === 1 && { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' }]}
                          onPress={() => {
                            toggleMedicalLogStatus(log.id, log.is_completed === 1 ? 0 : 1);
                            loadData(pet.id);
                            triggerAutoSync(pet.id);
                          }}
                        >
                          {log.is_completed === 1 ? (
                            <CheckSquare size={16} color="#15803D" strokeWidth={2.2} />
                          ) : (
                            <Square size={16} color="#6B7280" strokeWidth={2} />
                          )}
                          <Text style={[styles.checkBtnText, log.is_completed === 1 && { color: '#15803D' }]}>
                            {log.is_completed === 1 ? 'Tratamiento Completado' : 'Marcar como completado'}
                          </Text>
                        </TouchableOpacity>
                      )}

                      <View style={styles.cardActionsRow}>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => openEditLogModal(log)}>
                          <Pencil size={13} color="#374151" strokeWidth={2.2} />
                          <Text style={styles.actionBtnText}>Editar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, styles.deleteActionBtn]} onPress={() => askDelete('log', log.id, log.title)}>
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
                  <Text style={[styles.sectionTitle, { color: '#DC2626' }]}>Clínica de Urgencia 24/7</Text>
                </View>

                <TextInput style={styles.input} value={clinicName} onChangeText={setClinicName} placeholder="Nombre Clínica 24 hrs" />
                <View style={[styles.row, { marginBottom: 10 }]}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginRight: 8, marginBottom: 0 }]}
                    value={clinicPhone}
                    onChangeText={setClinicPhone}
                    keyboardType="phone-pad"
                    placeholder="Teléfono Urgencia"
                  />
                  {clinicPhone ? (
                    <TouchableOpacity style={[styles.callBtn, { backgroundColor: '#DC2626' }]} onPress={() => callPhone(clinicPhone)}>
                      <Phone size={15} color="#FFF" strokeWidth={2.2} />
                      <Text style={styles.callBtnText}>Urgencia</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                <Text style={styles.helperLabel}>Ciudad / Comuna o dirección (opcional):</Text>
                <TextInput style={styles.input} value={clinicAddress} onChangeText={setClinicAddress} placeholder="Ej. Centro / Av. Principal 123" />

                <TouchableOpacity style={styles.mapBtn} onPress={openSmartMaps}>
                  <MapPin size={16} color="#1D4ED8" strokeWidth={2.2} />
                  <Text style={[styles.mapBtnText, { marginLeft: 6 }]}>
                    {clinicName ? `Buscar "${clinicName}" en Google Maps` : 'Abrir Google Maps'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.primaryBtn, { marginTop: 16 }]} onPress={handleSaveEmergency}>
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
                <Text style={styles.helperLabel}>Toca una categoría para buscar en el mapa usando tu ubicación actual:</Text>

                <TouchableOpacity style={styles.nearbyCardBtn} onPress={() => searchNearbyOnMap('Clínica veterinaria cerca de mi')}>
                  <View style={[styles.sheetIconCircle, { backgroundColor: '#DBEAFE' }]}>
                    <Stethoscope size={22} color="#2563EB" strokeWidth={2.2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetOptionTitle}>Veterinarias Cercanas</Text>
                    <Text style={styles.sheetOptionDesc}>Ver todas las consultas y clínicas alrededor tuyo</Text>
                  </View>
                  <Navigation size={18} color="#2563EB" strokeWidth={2.2} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.nearbyCardBtn, { borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]}
                  onPress={() => searchNearbyOnMap('Urgencia veterinaria 24 horas cerca de mi')}
                >
                  <View style={[styles.sheetIconCircle, { backgroundColor: '#FEE2E2' }]}>
                    <Siren size={22} color="#DC2626" strokeWidth={2.2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sheetOptionTitle, { color: '#991B1B' }]}>Urgencias 24 Horas</Text>
                    <Text style={[styles.sheetOptionDesc, { color: '#B91C1C' }]}>Hospitales veterinarios abiertos de noche o festivos</Text>
                  </View>
                  <Navigation size={18} color="#DC2626" strokeWidth={2.2} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.nearbyCardBtn} onPress={() => searchNearbyOnMap('Farmacia veterinaria pet shop cerca de mi')}>
                  <View style={[styles.sheetIconCircle, { backgroundColor: '#DCFCE7' }]}>
                    <ShoppingBag size={22} color="#16A34A" strokeWidth={2.2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetOptionTitle}>Farmacias y Pet Shops</Text>
                    <Text style={styles.sheetOptionDesc}>Remedios, alimento medicado y accesorios cercanos</Text>
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

      {/* MODALES MODULARES (QR, CUENTA CLOUD Y SINCRONIZACIÓN FAMILIAR) */}
      <QrEmergencyModal visible={qrModalVisible} pet={pet} onClose={() => setQrModalVisible(false)} />

      <CloudAccountModal
        visible={cloudModalVisible}
        onClose={() => setCloudModalVisible(false)}
        currentUser={currentUser}
        onShowToast={showToast}
      />

      <FamilySyncModal
        visible={familyModalVisible}
        onClose={() => setFamilyModalVisible(false)}
        pet={pet}
        currentUser={currentUser}
        onOpenAuthModal={() => setCloudModalVisible(true)}
        onSyncSuccess={(syncedPetId) => loadData(syncedPetId)}
        onShowToast={showToast}
      />

      {/* MODAL CREAR / EDITAR MASCOTA */}
      <Modal visible={petModalVisible} animationType="slide">
        <SafeAreaView style={styles.safeAreaModal}>
          {renderToastPill()}
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 90 }}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>{isCreatingNewPet ? 'Nueva Mascota' : 'Editar Ficha y Tutor'}</Text>
                {pet && (
                  <TouchableOpacity style={styles.closeIconBtn} onPress={handleCancelPetModal}>
                    <X size={20} color="#4B5563" />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity style={styles.photoPicker} onPress={() => openImagePickerSheet('pet')}>
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
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ingresa el nombre de tu mascota" />

              <Text style={styles.label}>Especie *</Text>
              <View style={styles.row}>
                {(['Perro', 'Gato', 'Otra'] as const).map((sp) => (
                  <TouchableOpacity
                    key={sp}
                    style={[styles.miniSelector, speciesMode === sp && styles.typeSelectorActive]}
                    onPress={() => setSpeciesMode(sp)}
                  >
                    <Text style={[styles.miniSelectorText, speciesMode === sp && { color: '#1D4ED8', fontWeight: '700' }]}>
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
                    <Text style={[styles.miniSelectorText, sex === sx && { color: '#1D4ED8', fontWeight: '700' }]}>{sx}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Raza / Mestizo</Text>
              <TextInput style={styles.input} value={breed} onChangeText={setBreed} placeholder="Ej. Mestizo, Cocker Spaniel..." />

              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.label}>Peso Actual (kg)</Text>
                  <TextInput style={styles.input} value={weight} onChangeText={setWeight} keyboardType="numeric" placeholder="Ej. 3.5" />
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

              <Text style={[styles.label, { color: '#DC2626' }]}>Alergias o Condiciones Críticas</Text>
              <TextInput
                style={[styles.input, { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' }]}
                value={allergies}
                onChangeText={setAllergies}
                placeholder="Ej. Alergia al pollo, cardíaco..."
              />

              <View style={styles.divider} />

              <View style={styles.sectionTitleRow}>
                <User size={18} color="#2563EB" strokeWidth={2.2} />
                <Text style={styles.sectionTitle}>Datos del Dueño / Tutor de {name.trim() || 'esta mascota'}</Text>
              </View>

              {existingOwners.length > 0 && (
                <View style={{ marginBottom: 8 }}>
                  <Text style={styles.helperLabel}>¿Es el mismo tutor de otra mascota? Toca para rellenar rápido:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {existingOwners.map((oPet) => (
                      <TouchableOpacity key={oPet.id} style={styles.copyOwnerPill} onPress={() => copyOwnerFromPet(oPet)}>
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
              <TextInput style={styles.input} value={ownerName} onChangeText={setOwnerName} placeholder="Ej. Juan Pérez" />

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
                  <TextInput style={styles.input} value={ownerRut} onChangeText={setOwnerRut} placeholder="12.345.678-9" />
                </View>
              </View>

              <Text style={styles.label}>Dirección / Comuna</Text>
              <TextInput style={styles.input} value={ownerAddress} onChangeText={setOwnerAddress} placeholder="Ej. Villa Alemana" />

              <TouchableOpacity style={styles.primaryBtn} onPress={handleSavePet}>
                <Text style={styles.primaryBtnText}>{isCreatingNewPet ? 'Crear Ficha de Mascota' : 'Guardar Cambios'}</Text>
              </TouchableOpacity>

              {pet && !isCreatingNewPet && (
                <TouchableOpacity style={styles.deletePetInlineBtn} onPress={() => askDelete('pet', pet.id, pet.name)}>
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
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 90 }}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>{editingVaccineId ? 'Editar Registro Sanitario' : 'Nuevo Registro Sanitario'}</Text>
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
                  <Syringe size={16} color={vType === 'vaccine' ? '#1D4ED8' : '#6B7280'} strokeWidth={2.2} />
                  <Text style={[styles.typeSelectorText, vType === 'vaccine' && { color: '#1D4ED8' }]}>Vacuna</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeSelector, vType === 'deworming' && styles.typeSelectorActive]}
                  onPress={() => handleSwitchVaccineType('deworming')}
                >
                  <ShieldCheck size={16} color={vType === 'deworming' ? '#1D4ED8' : '#6B7280'} strokeWidth={2.2} />
                  <Text style={[styles.typeSelectorText, vType === 'deworming' && { color: '#1D4ED8' }]}>Antiparasitario</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>{vType === 'vaccine' ? 'Nombre de la Vacuna *' : 'Producto Antiparasitario *'}</Text>
              <TextInput
                style={styles.input}
                value={vProduct}
                onChangeText={setVProduct}
                placeholder={vType === 'vaccine' ? 'Ej. Óctuple, Antirrábica...' : 'Ej. Bravecto, NexGard...'}
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

              <TouchableOpacity style={styles.photoPicker} onPress={() => openImagePickerSheet('vaccine')}>
                {vPhoto ? (
                  <Image source={{ uri: vPhoto }} style={styles.pickedImage} />
                ) : (
                  <View style={styles.photoPickerInner}>
                    <View style={styles.photoIconBadge}>
                      <Camera size={22} color="#2563EB" strokeWidth={2.2} />
                    </View>
                    <Text style={styles.photoPickerText}>Tomar Foto a Etiqueta/Sticker o Galería</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveVaccine}>
                <Text style={styles.primaryBtnText}>{editingVaccineId ? 'Guardar Cambios' : 'Guardar y Agendar Recordatorio'}</Text>
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
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 90 }}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>{editingLogId ? 'Editar Registro de Bitácora' : 'Nuevo Registro en Bitácora'}</Text>
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
                  style={[styles.typeSelector, lCategory === 'medication' && styles.typeSelectorActive]}
                  onPress={() => handleSwitchLogCategory('medication')}
                >
                  <Pill size={15} color={lCategory === 'medication' ? '#1D4ED8' : '#6B7280'} strokeWidth={2.2} />
                  <Text style={[styles.typeSelectorText, lCategory === 'medication' && { color: '#1D4ED8' }]}>Remedio</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeSelector, lCategory === 'consultation' && styles.typeSelectorActive]}
                  onPress={() => handleSwitchLogCategory('consultation')}
                >
                  <Stethoscope size={15} color={lCategory === 'consultation' ? '#1D4ED8' : '#6B7280'} strokeWidth={2.2} />
                  <Text style={[styles.typeSelectorText, lCategory === 'consultation' && { color: '#1D4ED8' }]}>Consulta</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeSelector, lCategory === 'symptom' && styles.typeSelectorActive]}
                  onPress={() => handleSwitchLogCategory('symptom')}
                >
                  <FileText size={15} color={lCategory === 'symptom' ? '#1D4ED8' : '#6B7280'} strokeWidth={2.2} />
                  <Text style={[styles.typeSelectorText, lCategory === 'symptom' && { color: '#1D4ED8' }]}>Síntoma</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>{logLabels.titleLabel}</Text>
              <TextInput style={styles.input} value={lTitle} onChangeText={setLTitle} placeholder={logLabels.titlePlaceholder} />

              {lCategory === 'medication' && (
                <View style={{ marginBottom: 4 }}>
                  <View style={styles.inlineMetaRow}>
                    <Bell size={13} color="#2563EB" strokeWidth={2.2} />
                    <Text style={[styles.label, { marginTop: 0, marginLeft: 5 }]}>Programar Alarma de Toma</Text>
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
                        style={[styles.miniSelector, lAlarmHours === opt.hrs && styles.typeSelectorActive]}
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
              <TextInput style={styles.input} value={lSchedule} onChangeText={setLSchedule} placeholder={logLabels.secondaryPlaceholder} />

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

              <TouchableOpacity style={styles.photoPicker} onPress={() => openImagePickerSheet('log')}>
                {lPhoto ? (
                  <Image source={{ uri: lPhoto }} style={styles.pickedImage} />
                ) : (
                  <View style={styles.photoPickerInner}>
                    <View style={styles.photoIconBadge}>
                      <Camera size={22} color="#2563EB" strokeWidth={2.2} />
                    </View>
                    <Text style={styles.photoPickerText}>Adjuntar Foto de Receta / Orden (Opcional)</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveLog}>
                <Text style={styles.primaryBtnText}>{editingLogId ? 'Guardar Cambios' : 'Guardar en Bitácora'}</Text>
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