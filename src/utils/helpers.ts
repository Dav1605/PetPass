import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as Notifications from 'expo-notifications';
import { Pet, VaccineDeworming, MedicalLog, EmergencyContact } from '../types/petpass';

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

export const formatDateInput = (text: string) => {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
};

export const parseDateTo9AM = (dateStr: string): Date | null => {
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year) || year < 2024) return null;
  const d = new Date(year, month, day, 9, 0, 0);
  return isNaN(d.getTime()) ? null : d;
};

export const buildPetVCard = (pet: Pet): string => {
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

export const requestNotificationPermissions = async () => {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus !== 'granted') {
    await Notifications.requestPermissionsAsync();
  }
};

export const scheduleRealNotification = async (
  title: string,
  body: string,
  options: { targetDate?: Date; intervalSeconds?: number }
) => {
  try {
    if (options.targetDate) {
      const now = Date.now();
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

export const exportPetSanitaryPDF = async (
  pet: Pet,
  vaccines: VaccineDeworming[],
  logs: MedicalLog[],
  em: EmergencyContact | null
) => {
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
            <td><strong>${l.title}</strong> ${l.is_completed ? '(Completado)' : ''}</td>
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

      ${pet.allergies ? `<div class="alert-box">⚠️ ALERTA MÉDICA / ALERGIAS: ${pet.allergies}</div>` : ''}

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
          <div class="row-text"><strong>Especie / Raza:</strong> ${pet.species} • ${pet.breed || 'Mestizo'}</div>
          <div class="row-text"><strong>Sexo / Peso:</strong> ${pet.sex} • ${pet.weight} kg</div>
          <div class="row-text"><strong>Fecha Nacimiento:</strong> ${pet.birth_date ? formatDateInput(pet.birth_date) : 'No registrada'}</div>
          <div class="row-text"><strong>Microchip:</strong> ${pet.microchip || 'No registrado'}</div>
        </div>

        <div class="card">
          <div class="card-title">Tutor / Dueño Responsable</div>
          <div class="row-text"><strong>Nombre:</strong> ${pet.owner_name || 'No especificado'}</div>
          <div class="row-text"><strong>RUT / ID:</strong> ${pet.owner_rut || 'No especificado'}</div>
          <div class="row-text"><strong>Teléfono:</strong> ${pet.owner_phone || 'No especificado'}</div>
          <div class="row-text"><strong>Dirección:</strong> ${pet.owner_address || 'No especificada'}</div>
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
            <div class="row-text"><strong>Clínica:</strong> ${em.emergency_clinic_name || '—'}</div>
            <div class="row-text"><strong>Teléfono:</strong> ${em.emergency_clinic_phone || '—'}</div>
            <div class="row-text"><strong>Dirección:</strong> ${em.emergency_address || '—'}</div>
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
};