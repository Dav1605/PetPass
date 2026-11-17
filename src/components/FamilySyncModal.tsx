import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { User as FirebaseUser } from 'firebase/auth';
import { Share2, DownloadCloud, UploadCloud, X, RefreshCw, KeyRound } from 'lucide-react-native';
import { Pet } from '../types/petpass';
import { uploadPetToCloud, downloadPetFromCloudCode } from '../services/cloudSync';

interface Props {
  visible: boolean;
  onClose: () => void;
  pet: Pet | null;
  currentUser: FirebaseUser | null;
  onOpenAuthModal: () => void;
  onSyncSuccess: (petId: number) => void;
  onShowToast: (msg: string, type?: 'success' | 'delete' | 'warning') => void;
}

export default function FamilySyncModal({
  visible,
  onClose,
  pet,
  currentUser,
  onOpenAuthModal,
  onSyncSuccess,
  onShowToast,
}: Props) {
  const [inputCode, setInputCode] = useState('');
  const [loadingUpload, setLoadingUpload] = useState(false);
  const [loadingDownload, setLoadingDownload] = useState(false);

  const handleUploadPet = async () => {
    if (!currentUser) {
      onClose();
      onOpenAuthModal();
      onShowToast('Inicia sesión primero para sincronizar en la nube', 'warning');
      return;
    }
    if (!pet) return;

    setLoadingUpload(true);
    try {
      const code = await uploadPetToCloud(pet);
      onSyncSuccess(pet.id);
      onShowToast(`¡Ficha de ${pet.name} sincronizada! Código: ${code}`, 'success');
    } catch (err: any) {
      onShowToast(err?.message || 'Error al subir la mascota', 'warning');
    } finally {
      setLoadingUpload(false);
    }
  };

  const handlePullLatest = async () => {
    if (!pet?.cloud_id) return;
    setLoadingDownload(true);
    try {
      const { localPetId, petName } = await downloadPetFromCloudCode(pet.cloud_id);
      onSyncSuccess(localPetId);
      onShowToast(`Datos de ${petName} actualizados desde la nube`, 'success');
      onClose();
    } catch (err: any) {
      onShowToast(err?.message || 'Error al actualizar desde la nube', 'warning');
    } finally {
      setLoadingDownload(false);
    }
  };

  const handleLinkByCode = async () => {
    if (!inputCode.trim()) {
      onShowToast('Escribe el código de 6 letras y números', 'warning');
      return;
    }
    setLoadingDownload(true);
    try {
      const { localPetId, petName } = await downloadPetFromCloudCode(inputCode);
      setInputCode('');
      onSyncSuccess(localPetId);
      onShowToast(`¡${petName} vinculada en tu teléfono!`, 'success');
      onClose();
    } catch (err: any) {
      onShowToast(err?.message || 'No se encontró el código ingresado', 'warning');
    } finally {
      setLoadingDownload(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheet}
        >
          <ScrollView contentContainerStyle={{ paddingBottom: 26 }} keyboardShouldPersistTaps="handled">
            <View style={styles.headerRow}>
              <View style={styles.titleWrap}>
                <View style={styles.iconCircle}>
                  <Share2 size={21} color="#7C3AED" strokeWidth={2.2} />
                </View>
                <View>
                  <Text style={styles.title}>Acceso Compartido Familiar</Text>
                  <Text style={styles.subtitle}>Multi-Tutor en tiempo real (Android / iOS)</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <X size={20} color="#475569" />
              </TouchableOpacity>
            </View>

            {/* SECCIÓN 1: COMPARTIR / ACTUALIZAR MASCOTA ACTUAL */}
            {pet && (
              <View style={styles.card}>
                <Text style={styles.sectionTag}>1. COMPARTIR O SINCRONIZAR A {pet.name.toUpperCase()}</Text>
                <Text style={styles.desc}>
                  Sube el carnet, vacunas y bitácora de {pet.name} a la nube y comparte el código con tu pareja o familia.
                </Text>

                {pet.cloud_id ? (
                  <View style={styles.codeBanner}>
                    <Text style={styles.codeLabel}>CÓDIGO FAMILIAR DE {pet.name.toUpperCase()}:</Text>
                    <Text style={styles.codeValue}>{pet.cloud_id}</Text>
                    <Text style={styles.codeHint}>
                      Ingresa este código en el otro teléfono para tener la misma ficha
                    </Text>
                  </View>
                ) : null}

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <TouchableOpacity
                    style={[styles.primaryBtn, { flex: 1 }]}
                    onPress={handleUploadPet}
                    disabled={loadingUpload}
                  >
                    {loadingUpload ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <>
                        <UploadCloud size={16} color="#FFFFFF" strokeWidth={2.2} />
                        <Text style={styles.primaryBtnText}>
                          {pet.cloud_id ? 'Subir Cambios' : 'Generar Código Cloud'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {pet.cloud_id && (
                    <TouchableOpacity
                      style={styles.secondaryBtn}
                      onPress={handlePullLatest}
                      disabled={loadingDownload}
                    >
                      <RefreshCw size={16} color="#2563EB" strokeWidth={2.2} />
                      <Text style={styles.secondaryBtnText}>Traer Cambios</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* SECCIÓN 2: VINCULAR MASCOTA CON CÓDIGO */}
            <View style={styles.card}>
              <Text style={styles.sectionTag}>2. VINCULAR MASCOTA CON CÓDIGO FAMILIAR</Text>
              <Text style={styles.desc}>
                ¿Tu pareja o familiar ya subió la mascota? Escribe aquí su código de 6 caracteres para descargar su ficha completa en tu teléfono:
              </Text>

              <View style={styles.inputRow}>
                <KeyRound size={18} color="#64748B" />
                <TextInput
                  style={styles.codeInput}
                  value={inputCode}
                  onChangeText={(t) => setInputCode(t.toUpperCase())}
                  placeholder="EJ: A7K9P2"
                  autoCapitalize="characters"
                  maxLength={8}
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: '#2563EB', marginTop: 10 }]}
                onPress={handleLinkByCode}
                disabled={loadingDownload}
              >
                {loadingDownload ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <DownloadCloud size={17} color="#FFFFFF" strokeWidth={2.2} />
                    <Text style={styles.primaryBtnText}>Descargar y Vincular Mascota</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    maxHeight: '90%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  titleWrap: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3E8FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  title: { fontSize: 18, fontWeight: 'bold', color: '#0F172A' },
  subtitle: { fontSize: 12, color: '#64748B' },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  sectionTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7C3AED',
    marginBottom: 4,
  },
  desc: { fontSize: 12.5, color: '#475569', lineHeight: 18 },
  codeBanner: {
    backgroundColor: '#F3E8FF',
    borderWidth: 1.5,
    borderColor: '#C084FC',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  codeLabel: { fontSize: 10, fontWeight: '700', color: '#6B21A8' },
  codeValue: {
    fontSize: 26,
    fontWeight: '900',
    color: '#4C1D95',
    letterSpacing: 4,
    marginVertical: 4,
  },
  codeHint: { fontSize: 11, color: '#6B21A8', textAlign: 'center' },
  primaryBtn: {
    backgroundColor: '#7C3AED',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13.5, marginLeft: 6 },
  secondaryBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: { color: '#1D4ED8', fontWeight: '700', fontSize: 13, marginLeft: 5 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  codeInput: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 10,
    fontSize: 17,
    fontWeight: 'bold',
    letterSpacing: 3,
    color: '#0F172A',
  },
});