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
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '../config/firebase';
import {
  Cloud,
  Mail,
  Lock,
  User,
  LogOut,
  CheckCircle2,
  X,
  ShieldCheck,
  Share2,
} from 'lucide-react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
  currentUser: FirebaseUser | null;
  onShowToast: (msg: string, type?: 'success' | 'delete' | 'warning') => void;
}

export default function CloudAccountModal({
  visible,
  onClose,
  currentUser,
  onShowToast,
}: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password.trim()) {
      onShowToast('Ingresa tu correo y contraseña', 'warning');
      return;
    }
    if (password.length < 6) {
      onShowToast('La contraseña debe tener al menos 6 caracteres', 'warning');
      return;
    }
    if (mode === 'register' && !fullName.trim()) {
      onShowToast('Ingresa tu nombre para identificarte como tutor', 'warning');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        if (fullName.trim()) {
          await updateProfile(cred.user, { displayName: fullName.trim() });
        }
        onShowToast('¡Cuenta creada y conectada a PetPass Cloud!', 'success');
      } else {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
        onShowToast('¡Sesión iniciada correctamente!', 'success');
      }
      setPassword('');
      onClose();
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/email-already-in-use') {
        onShowToast('Este correo ya está registrado. Inicia sesión.', 'warning');
      } else if (code === 'auth/invalid-email') {
        onShowToast('El formato del correo no es válido', 'warning');
      } else if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        onShowToast('Correo o contraseña incorrectos', 'warning');
      } else {
        onShowToast('Error al conectar con Firebase Auth', 'warning');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      onShowToast('Sesión cerrada (Tus datos locales siguen intactos)', 'success');
      onClose();
    } catch (error) {
      onShowToast('No se pudo cerrar la sesión', 'warning');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetContainer}
        >
          <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
            <View style={styles.headerRow}>
              <View style={styles.titleWrap}>
                <View style={styles.iconCircle}>
                  <Cloud size={22} color="#2563EB" strokeWidth={2.2} />
                </View>
                <View>
                  <Text style={styles.title}>PetPass Cloud</Text>
                  <Text style={styles.subtitle}>Sincronización familiar y Red SOS</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <X size={20} color="#475569" />
              </TouchableOpacity>
            </View>

            {currentUser ? (
              <View style={styles.loggedBox}>
                <View style={styles.statusBanner}>
                  <CheckCircle2 size={20} color="#16A34A" strokeWidth={2.3} />
                  <Text style={styles.statusBannerText}>Conectado a la nube en tiempo real</Text>
                </View>

                <View style={styles.userCard}>
                  <Text style={styles.userLabel}>TUTOR CONECTADO</Text>
                  <Text style={styles.userName}>
                    {currentUser.displayName || 'Tutor PetPass'}
                  </Text>
                  <Text style={styles.userEmail}>{currentUser.email}</Text>
                </View>

                <View style={styles.infoBox}>
                  <Share2 size={18} color="#1D4ED8" strokeWidth={2.2} />
                  <Text style={styles.infoText}>
                    Con tu cuenta activa ya puedes compartir fichas de mascotas con tu pareja o familia y publicar alertas en la Red SOS.
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.logoutBtn}
                  onPress={handleLogout}
                  disabled={loading}
                >
                  <LogOut size={16} color="#DC2626" strokeWidth={2.2} />
                  <Text style={styles.logoutBtnText}>Cerrar sesión en este dispositivo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <View style={styles.switchRow}>
                  <TouchableOpacity
                    style={[styles.switchTab, mode === 'login' && styles.switchTabActive]}
                    onPress={() => setMode('login')}
                  >
                    <Text
                      style={[
                        styles.switchTabText,
                        mode === 'login' && styles.switchTabTextActive,
                      ]}
                    >
                      Iniciar Sesión
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.switchTab, mode === 'register' && styles.switchTabActive]}
                    onPress={() => setMode('register')}
                  >
                    <Text
                      style={[
                        styles.switchTabText,
                        mode === 'register' && styles.switchTabTextActive,
                      ]}
                    >
                      Crear Cuenta Gratis
                    </Text>
                  </TouchableOpacity>
                </View>

                {mode === 'register' && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Tu Nombre (Tutor)</Text>
                    <View style={styles.inputWrap}>
                      <User size={17} color="#64748B" />
                      <TextInput
                        style={styles.input}
                        value={fullName}
                        onChangeText={setFullName}
                        placeholder="Ej. David Álvarez"
                      />
                    </View>
                  </View>
                )}

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Correo Electrónico</Text>
                  <View style={styles.inputWrap}>
                    <Mail size={17} color="#64748B" />
                    <TextInput
                      style={styles.input}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      placeholder="correo@ejemplo.com"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Contraseña (mínimo 6 caracteres)</Text>
                  <View style={styles.inputWrap}>
                    <Lock size={17} color="#64748B" />
                    <TextInput
                      style={styles.input}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      placeholder="••••••••"
                    />
                  </View>
                </View>

                <View style={styles.offlineNote}>
                  <ShieldCheck size={16} color="#475569" />
                  <Text style={styles.offlineNoteText}>
                    Modo híbrido: Tus datos locales siguen funcionando 100% offline aunque no inicies sesión.
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={handleAuth}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitBtnText}>
                      {mode === 'login' ? 'Entrar a mi Cuenta' : 'Registrarme y Conectar'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
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
  sheetContainer: {
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
    marginBottom: 16,
  },
  titleWrap: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  title: { fontSize: 19, fontWeight: 'bold', color: '#0F172A' },
  subtitle: { fontSize: 12, color: '#64748B' },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
  },
  switchTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  switchTabActive: {
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  switchTabText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  switchTabTextActive: { color: '#2563EB', fontWeight: '700' },
  inputGroup: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 8,
    fontSize: 15,
    color: '#0F172A',
  },
  offlineNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
    marginTop: 4,
    marginBottom: 14,
  },
  offlineNoteText: {
    fontSize: 12,
    color: '#475569',
    marginLeft: 8,
    flex: 1,
  },
  submitBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  submitBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
  loggedBox: { paddingVertical: 6 },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  statusBannerText: {
    color: '#166534',
    fontWeight: '700',
    fontSize: 13,
    marginLeft: 8,
  },
  userCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  userLabel: { fontSize: 11, fontWeight: '700', color: '#2563EB', marginBottom: 4 },
  userName: { fontSize: 18, fontWeight: 'bold', color: '#0F172A' },
  userEmail: { fontSize: 13, color: '#64748B', marginTop: 2 },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 12,
    color: '#1E3A8A',
    marginLeft: 10,
    flex: 1,
    lineHeight: 17,
  },
  logoutBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutBtnText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 8,
  },
});