/**
 * api.js — Todas las llamadas al backend del servidor.
 * El cliente NUNCA llama directamente a OpenAI — siempre pasa por /server.
 * Esto mantiene la clave de API segura en el servidor.
 */

// ── Chat con contexto de módulo ──────────────────────────────────────────────
/**
 * @param {Array} messages - historial de mensajes [{role, content}]
 * @param {string} module - módulo activo: 'panel'|'entrenamiento'|'nutricion'|'mindset'|'ingenio'
 * @param {Object} profile - perfil completo del usuario
 * @param {Object} moduleData - datos del módulo activo (bitácora, despensa, etc.)
 * @returns {Promise<string>} - respuesta de texto del asistente
 */
export async function chatWithAI(messages, module = 'panel', profile = null, moduleData = {}) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, module, profile, moduleData }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Error del servidor: ${response.status}`);
  }

  const data = await response.json();
  return data.reply;
}

// ── Escanear ticket de compra ────────────────────────────────────────────────
/**
 * @param {File} imageFile - archivo de imagen del ticket
 * @returns {Promise<{items: Array}>}
 */
export async function scanTicket(imageFile) {
  const base64 = await fileToBase64(imageFile);
  const mediaType = imageFile.type || 'image/jpeg';

  const response = await fetch('/api/scan-ticket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: base64, mediaType }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Error al escanear ticket: ${response.status}`);
  }

  return response.json();
}

// ── Generar recetas ──────────────────────────────────────────────────────────
/**
 * @param {Object} profile - perfil del usuario
 * @param {Array} pantry - items de la despensa
 * @param {string} restrictions - restricciones alimentarias
 * @returns {Promise<{recetas: Array}>}
 */
export async function generateRecipes(profile, pantry, restrictions = '') {
  const response = await fetch('/api/recipes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile, pantry, restrictions }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Error al generar recetas: ${response.status}`);
  }

  return response.json();
}

// ── Helper ───────────────────────────────────────────────────────────────────
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Generar plan detallado de un día ────────────────────────────────────────
export async function getDayPlan(day, dayFocus, profile) {
  const response = await fetch('/api/day-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ day, dayFocus, profile }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Error del servidor: ${response.status}`);
  }

  return response.json();
}

// ── Biblioteca de ejercicios wger ────────────────────────────────────────────
export async function getExercises({ q = '', category = '', muscle = '', infra = '', limit = 40, offset = 0 } = {}) {
  const params = new URLSearchParams({ q, category, muscle, infra, limit, offset });
  const response = await fetch(`/api/exercises?${params}`);
  if (!response.ok) throw new Error(`Error ${response.status}`);
  return response.json();
}

export async function getExercisesStatus() {
  const response = await fetch('/api/exercises/status');
  if (!response.ok) throw new Error(`Error ${response.status}`);
  return response.json();
}
