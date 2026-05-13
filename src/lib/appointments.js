import { compareIds } from './utils';

export const tryParseJsonValue = (value) => {
  if (typeof value !== 'string') return value;
  const raw = value.trim();
  if (!raw) return value;
  try {
    return JSON.parse(raw);
  } catch {
    return value;
  }
};

export const normalizeObjectValue = (value) => {
  const parsed = tryParseJsonValue(value);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
};

export const normalizeArrayValue = (value) => {
  const parsed = tryParseJsonValue(value);
  return Array.isArray(parsed) ? parsed : [];
};

export const parseAnimalIdsField = (value) => {
  if (Array.isArray(value)) return value.filter((item) => item !== null && item !== undefined && String(item).trim() !== '');
  if (value === null || value === undefined) return [];
  if (typeof value === 'number') return [value];
  if (typeof value === 'object') {
    if (value.id !== undefined && value.id !== null) return [value.id];
    if (value._id !== undefined && value._id !== null) return [value._id];
    return [];
  }
  const raw = String(value).trim();
  if (!raw) return [];
  if (raw.startsWith('{') && raw.endsWith('}')) {
    return raw
      .slice(1, -1)
      .split(',')
      .map((item) => item.trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1'))
      .filter(Boolean);
  }
  if (raw.startsWith('[') && raw.endsWith(']')) {
    const parsed = tryParseJsonValue(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => (item === null || item === undefined ? '' : String(item).trim()))
        .filter(Boolean);
    }
    return [];
  }
  if (raw.includes(',')) {
    return raw
      .split(',')
      .map((item) => item.trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1'))
      .filter(Boolean);
  }
  return [raw];
};

export const getAppointmentAnimalIds = (appointmentItem) => {
  if (!appointmentItem) return [];
  const values = [
    ...parseAnimalIdsField(appointmentItem.animal_ids),
    ...parseAnimalIdsField(appointmentItem.animalIds),
    appointmentItem.animal_id,
    appointmentItem.animalId
  ];
  const normalized = values
    .map((item) => (item === null || item === undefined ? '' : String(item).trim()))
    .filter(Boolean);
  return [...new Set(normalized)];
};

export const includesAnimalInAppointment = (appointmentItem, animalId) => {
  if (!appointmentItem || !animalId) return false;
  return getAppointmentAnimalIds(appointmentItem).some((itemId) => compareIds(itemId, animalId));
};

export const getAppointmentClientId = (appointmentItem) => {
  return getRecordClientId(appointmentItem);
};

export const getRecordClientId = (recordItem) => {
  if (!recordItem || typeof recordItem !== 'object') return null;
  return (
    recordItem.client_id ||
    recordItem.clientId ||
    recordItem.id_client ||
    recordItem.owner_id ||
    recordItem.ownerId ||
    recordItem.client?.id ||
    recordItem.client?._id ||
    recordItem.owner?.id ||
    recordItem.owner?._id ||
    null
  );
};

export const getAppointmentPropertyId = (appointmentItem) => {
  return getRecordPropertyId(appointmentItem);
};

export const getRecordPropertyId = (recordItem) => {
  if (!recordItem || typeof recordItem !== 'object') return null;
  return (
    recordItem.property_id ||
    recordItem.propertyId ||
    recordItem.id_property ||
    recordItem.property?.id ||
    recordItem.property?._id ||
    null
  );
};

export const normalizeAppointmentForAnalysis = (appointmentItem) => {
  if (!appointmentItem || typeof appointmentItem !== 'object') return null;
  return {
    ...appointmentItem,
    client_id: getAppointmentClientId(appointmentItem),
    property_id: getAppointmentPropertyId(appointmentItem),
    animal_ids: getAppointmentAnimalIds(appointmentItem),
    procedures: normalizeArrayValue(appointmentItem.procedures),
    medications: normalizeArrayValue(appointmentItem.medications),
    photos: normalizeArrayValue(appointmentItem.photos),
    reproductive_data: normalizeObjectValue(appointmentItem.reproductive_data),
    andrological_data: normalizeObjectValue(appointmentItem.andrological_data),
    consultoria_data: normalizeObjectValue(appointmentItem.consultoria_data)
  };
};
