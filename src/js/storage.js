/**
 * storage.js — Persistencia de datos del usuario.
 * Usa localStorage (entorno de navegador real / app desplegada).
 * La clave 'al_' prefija todas las entradas para evitar colisiones.
 */

const PREFIX = 'al_';

export function storeGet(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('[storage] get error:', key, e);
    return null;
  }
}

export function storeSet(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.warn('[storage] set error:', key, e);
  }
}

export function storeDel(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch (e) {
    console.warn('[storage] del error:', key, e);
  }
}

// Claves estándar del sistema
export const KEYS = {
  PROFILE:         'profile',
  PANTRY:          'pantry_items',
  TRAIN_LOG:       'train_log',
  NUTRITION_LOG:   'nutrition_log',
  DIARIO:          'diario_entries',
  RECIPE_HISTORY:  'recipe_history',
};
