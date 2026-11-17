import React from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { QrCode, AlertTriangle } from 'lucide-react-native';
import { Pet } from '../types/petpass';
import { buildPetVCard } from '../utils/helpers';
import { styles } from '../styles/appStyles';

interface Props {
  visible: boolean;
  pet: Pet | null;
  onClose: () => void;
}

export default function QrEmergencyModal({ visible, pet, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.qrModalOverlay}>
        <View style={styles.qrModalCard}>
          <View style={styles.sheetHandle} />
          <View style={{ alignItems: 'center', marginBottom: 14 }}>
            <View
              style={[
                styles.sheetIconCircle,
                { backgroundColor: '#DCFCE7', marginBottom: 8, marginRight: 0 },
              ]}
            >
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
            onPress={onClose}
          >
            <Text style={styles.primaryBtnText}>Cerrar Tarjeta</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}