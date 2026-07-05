import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import OpenAI from 'openai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/src', express.static(path.join(root, 'src')));
app.use(express.static(path.join(root, 'public')));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Knowledge base ────────────────────────────────────────────────────────────
function loadKB(filename) {
  try {
    return JSON.parse(readFileSync(path.join(root, 'src', 'data', 'knowledge', filename), 'utf8'));
  } catch (e) {
    console.warn(`[KB] No se pudo cargar ${filename}:`, e.message);
    return {};
  }
}
const KB = {
  training:        loadKB('training.json'),
  nutrition:       loadKB('nutrition.json'),
  economy:         loadKB('economy.json'),
  personalization: loadKB('personalization.json'),
  mindset:         loadKB('mindset.json'),
};
console.log('[KB] Base de conocimiento cargada:', Object.keys(KB).join(', '));

// ── wger integration ──────────────────────────────────────────────────────────
const WGER_BASE = 'https://wger.de/api/v2';

// Equipment IDs in wger → allowed for each infra level
const INFRA_EQUIPMENT = {
  'ninguno':      new Set([7, 4]),               // Sin equipo + colchoneta
  'parque':       new Set([7, 4, 6]),             // + barra de dominadas
  'gym-basico':   new Set([7, 4, 6, 1, 3, 8, 10, 2]), // + pesas, mancuernas, banca
  'gym-completo': null,                           // todo permitido
};

// Category IDs in wger
const WGER_CATEGORIES = {
  10: 'Abdominales',
  8:  'Brazos',
  12: 'Espalda',
  14: 'Pantorrillas',
  11: 'Pecho',
  9:  'Piernas',
  13: 'Hombros',
};

// Day focus → priority category IDs
const FOCUS_CATEGORIES = {
  atletismo:    [9, 14, 10],       // Piernas, pantorrillas, abdomen
  fuerza:       [11, 8, 12, 13],   // Pecho, brazos, espalda, hombros
  potencia:     [8, 12, 9, 11],    // Brazos, espalda, piernas, pecho
  movilidad:    [10, 9, 13, 12],   // Abdomen, piernas, hombros, espalda
  recuperacion: [10, 13, 12],      // Abdomen, hombros, espalda
  agarre:       [8, 12],           // Brazos, espalda
};

let wgerCache = {
  exercises: [],
  categories: WGER_CATEGORIES,
  loaded: false,
  loading: false,
  loadedAt: null,
  error: null,
};

async function fetchWgerPage(url) {
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'AthleticLabSystem/1.0' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`wger devolvió ${res.status} para ${url}`);
  return res.json();
}

function processWgerExercise(raw) {
  const esT = raw.translations?.find(t => t.language === 6);
  const enT = raw.translations?.find(t => t.language === 2);
  const best = esT || enT || raw.translations?.[0];
  if (!best?.name?.trim()) return null;

  const desc = (best.description || enT?.description || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);

  return {
    id: raw.id,
    name: best.name.trim(),
    name_en: enT?.name?.trim() || best.name.trim(),
    has_spanish: !!esT,
    description: desc,
    category: WGER_CATEGORIES[raw.category?.id] || raw.category?.name || 'General',
    category_id: raw.category?.id || 0,
    muscles: (raw.muscles || []).map(m => m.name_en || m.name).filter(Boolean),
    muscles_secondary: (raw.muscles_secondary || []).map(m => m.name_en || m.name).filter(Boolean),
    equipment: (raw.equipment || []).map(e => e.name).filter(Boolean),
    equipment_ids: (raw.equipment || []).map(e => e.id),
    image: raw.images?.[0]?.image || null,
  };
}

async function loadWgerExercises() {
  if (wgerCache.loading || wgerCache.loaded) return;
  wgerCache.loading = true;
  console.log('[wger] Iniciando carga de ejercicios desde wger.de...');

  try {
    const exercises = [];
    let url = `${WGER_BASE}/exerciseinfo/?format=json&limit=100&offset=0`;
    let page = 1;

    while (url) {
      console.log(`[wger] Página ${page}...`);
      const data = await fetchWgerPage(url);
      data.results.forEach(raw => {
        const ex = processWgerExercise(raw);
        if (ex) exercises.push(ex);
      });
      url = data.next;
      page++;
      if (url) await new Promise(r => setTimeout(r, 300)); // respetar rate limit
    }

    wgerCache.exercises = exercises;
    wgerCache.loaded = true;
    wgerCache.loadedAt = new Date().toISOString();
    console.log(`[wger] ✓ ${exercises.length} ejercicios cargados (${exercises.filter(e=>e.has_spanish).length} en español)`);
  } catch (err) {
    wgerCache.error = err.message;
    console.error('[wger] Error al cargar ejercicios:', err.message);
  } finally {
    wgerCache.loading = false;
  }
}

function filterExercisesByInfra(infra) {
  const allowed = INFRA_EQUIPMENT[infra];
  return wgerCache.exercises.filter(ex => {
    if (!allowed) return true;
    if (!ex.equipment_ids.length) return true;
    return ex.equipment_ids.some(id => allowed.has(id));
  });
}

function selectExercisesForDay(profile, dayFocus, max = 45) {
  if (!wgerCache.loaded) return [];
  const available = filterExercisesByInfra(profile?.infra || 'parque');
  const focusLower = dayFocus.toLowerCase();

  let priorityCats = [];
  if (focusLower.includes('atletismo') || focusLower.includes('cardio') || focusLower.includes('carrera')) {
    priorityCats = FOCUS_CATEGORIES.atletismo;
  } else if (focusLower.includes('fuerza') || focusLower.includes('empuje') || focusLower.includes('tirón')) {
    priorityCats = FOCUS_CATEGORIES.fuerza;
  } else if (focusLower.includes('potencia') || focusLower.includes('explosiv')) {
    priorityCats = FOCUS_CATEGORIES.potencia;
  } else if (focusLower.includes('agarre')) {
    priorityCats = FOCUS_CATEGORIES.agarre;
  } else if (focusLower.includes('movilidad') || focusLower.includes('frc')) {
    priorityCats = FOCUS_CATEGORIES.movilidad;
  } else if (focusLower.includes('recuper') || focusLower.includes('descanso')) {
    priorityCats = FOCUS_CATEGORIES.recuperacion;
  } else {
    priorityCats = Object.keys(WGER_CATEGORIES).map(Number);
  }

  const priority = available.filter(ex => priorityCats.includes(ex.category_id));
  const rest = available.filter(ex => !priorityCats.includes(ex.category_id));
  return [...priority, ...rest].slice(0, max);
}

// ── System prompt base ────────────────────────────────────────────────────────
const BASE_CONTEXT = `
Eres el asistente de ATHLETIC LAB SYSTEM — ecosistema de entrenamiento y bienestar inspirado en la Méthode Naturelle de Georges Hébert (1912). Principio: "Être fort pour être utile".

Módulos: (1) ENTRENAMIENTO: sistema híbrido (calistenia, gimnasia/anillas, escalada adaptada, parkour, movilidad/FRC); (2) NUTRICIÓN: optimiza lo que ya come el usuario, sin dietas cerradas; (3) MINDSET: psicología del rendimiento, estoicismo; (4) ECONOMÍA E INGENIO: equivalencia funcional para sustituir equipo; (5) PERSONALIZACIÓN: por perfil individual y contexto regional.

Estilo: directo, práctico, honesto sobre límites de la evidencia. Máximo 5 líneas por respuesta salvo que se pida más. No das diagnósticos médicos.
`.trim();

function buildModuleContext(module, profile, moduleData) {
  const profileStr = profile ? `\nPERFIL DEL USUARIO:\n${JSON.stringify(profile, null, 2)}` : '';
  const contexts = {
    entrena: `Estás en ENTRENAMIENTO.\nBase de conocimiento:\n${JSON.stringify(KB.training)}\n${profileStr}\n${moduleData?.trainLog ? `\nÚltimas sesiones:\n${JSON.stringify(moduleData.trainLog.slice(0,3))}` : ''}`,
    nutricion: `Estás en NUTRICIÓN.\nBase de conocimiento:\n${JSON.stringify(KB.nutrition)}\n${profileStr}\n${moduleData?.pantry ? `\nDespensa:\n${JSON.stringify(moduleData.pantry)}` : ''}\n${moduleData?.nutritionLog ? `\nÚltimos registros:\n${JSON.stringify(moduleData.nutritionLog.slice(0,3))}` : ''}`,
    mindset: `Estás en MINDSET.\nBase de conocimiento:\n${JSON.stringify(KB.mindset)}\n${profileStr}\n${moduleData?.diarioEntries ? `\nDiario reciente:\n${JSON.stringify(moduleData.diarioEntries.slice(0,2))}` : ''}`,
    ingenio: `Estás en ECONOMÍA E INGENIO.\nBase de conocimiento:\n${JSON.stringify(KB.economy)}\n${profileStr}`,
    panel: `Estás en el PANEL PRINCIPAL. Puedes responder sobre cualquier módulo.\n${profileStr}`,
  };
  return (contexts[module] || contexts.panel).trim();
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

// Chat con contexto
app.post('/api/chat', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY no configurada.' });
    const { messages, module = 'panel', profile = null, moduleData = {} } = req.body;
    if (!Array.isArray(messages)) return res.status(400).json({ error: '"messages" debe ser un arreglo.' });

    const systemPrompt = `${BASE_CONTEXT}\n\n${buildModuleContext(module, profile, moduleData)}`;
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      max_tokens: 600,
      temperature: 0.7,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    });
    res.json({ reply: response.choices[0].message.content, module });
  } catch (err) {
    console.error('[/api/chat]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Escanear ticket
app.post('/api/scan-ticket', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY no configurada.' });
    const { imageBase64, mediaType = 'image/jpeg' } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'Se requiere imageBase64.' });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mediaType};base64,${imageBase64}` } },
          { type: 'text', text: `Analiza este ticket de compra y extrae todos los productos alimenticios. Responde ÚNICAMENTE con JSON válido sin texto adicional:\n{"items":[{"name":"Pechuga de pollo","quantity":1,"unit":"kg","category":"proteina"}]}\nCategorías: proteina|carbohidrato|verdura|fruta|lacteo|grasa|otro. Si no hay alimentos: {"items":[]}` }
        ]
      }]
    });

    const raw = response.choices[0].message.content.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    try { res.json(JSON.parse(raw)); } catch { res.json({ items: [] }); }
  } catch (err) {
    console.error('[/api/scan-ticket]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Generar recetas
app.post('/api/recipes', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY no configurada.' });
    const { profile, pantry, restrictions = '' } = req.body;
    const pantryStr = Array.isArray(pantry) && pantry.length
      ? pantry.map(i => `${i.name} (${i.quantity || i.qty} ${i.unit || ''})`).join(', ')
      : 'despensa vacía';

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content: `Eres nutricionista del sistema Athletic Lab. Genera 3 recetas usando principalmente la despensa disponible.\nPerfil: ${JSON.stringify(profile || {})}\nObjetivo: ${profile?.goal || 'rendimiento'}\nDespensa: ${pantryStr}\nRestricciones: ${restrictions || 'ninguna'}\n\nResponde ÚNICAMENTE con JSON:\n{"recetas":[{"titulo":"...","tiempo_min":20,"dificultad":"fácil","macros":{"kcal":0,"proteina_g":0,"carbos_g":0,"grasas_g":0},"ingredientes_usados":[{"name":"...","quantity":1,"unit":"..."}],"ingredientes_faltan":[],"pasos":["..."],"encaje_objetivo":"..."}]}`
      }]
    });

    const raw = response.choices[0].message.content.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    try { res.json(JSON.parse(raw)); } catch { res.json({ recetas: [] }); }
  } catch (err) {
    console.error('[/api/recipes]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Plan detallado del día (con ejercicios reales de wger)
app.post('/api/day-plan', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY no configurada.' });
    const { day, dayFocus, profile } = req.body;

    const wgerExercises = selectExercisesForDay(profile, dayFocus, 20);
    const wgerContext = wgerExercises.length
      ? `\nEJERCICIOS DE LA BASE DE DATOS WGER (úsalos cuando sea apropiado):\n${JSON.stringify(wgerExercises.map(e => ({ nombre: e.name, categoria: e.category, musculos: e.muscles.slice(0,2) })))}\n\nUsa ejercicios de esta lista siempre que sea posible. Puedes añadir ejercicios adicionales (sprints, saltos, CARs, etc.) si la lista no cubre el foco del día.`
      : '\n(Base de datos wger aún cargando — usa tu conocimiento de ejercicios de calistenia y atletismo)';

    const prompt = `Eres entrenador personal del sistema Athletic Lab. Diseña una sesión detallada para este día.

DÍA: ${day} — FOCO: ${dayFocus}

PERFIL:
- Nivel de actividad: ${profile?.activity || 'moderado'}
- Tipo de entrenamiento: ${profile?.trainType || 'hibrido'}
- Objetivo: ${profile?.goal || 'rendimiento'}
- Infraestructura: ${profile?.infra || 'gym-basico'}
- Lesiones: ${profile?.injuries || 'ninguna'}
- Disciplinas: ${(profile?.disciplines || []).join(', ') || 'calistenia, atletismo'}
${wgerContext}

REGLAS:
- Empieza SIEMPRE con calentamiento que incluya CARs (rotaciones articulares controladas)
- Incluye sets, reps Y descanso en cada ejercicio
- Si es día de atletismo: distancias/tiempos específicos de carrera
- Si hay lesión: adapta o elimina ejercicios que la comprometan
- Adapta el volumen al objetivo: rendimiento = alto volumen/intensidad, recuperación = bajo

Responde ÚNICAMENTE con JSON válido:
{
  "dia": "${day}",
  "foco": "${dayFocus}",
  "duracion_total_min": 60,
  "intensidad": "alta|moderada|baja|recuperación",
  "bloques": [
    {
      "nombre": "Calentamiento",
      "duracion_min": 10,
      "descripcion": "Propósito del bloque",
      "ejercicios": [
        {
          "nombre": "CARs de cadera",
          "series": 1,
          "reps": "3 por lado",
          "descanso_seg": 0,
          "tecnica": "Detalle de ejecución",
          "equivalencia_sin_equipo": null
        }
      ]
    }
  ],
  "nota_final": "Consejo específico para este atleta en este día."
}`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      max_tokens: 2500,
      temperature: 0.6,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.choices[0].message.content.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    try { res.json(JSON.parse(raw)); }
    catch { res.status(500).json({ error: 'No se pudo parsear el plan del día.' }); }
  } catch (err) {
    console.error('[/api/day-plan]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Biblioteca de ejercicios wger
app.get('/api/exercises', (req, res) => {
  const { q = '', category = '', equipment = '', muscle = '', infra = '', limit = '40', offset = '0' } = req.query;

  let results = wgerCache.exercises;

  // Filtrar por infraestructura del usuario
  if (infra && INFRA_EQUIPMENT[infra]) {
    const allowed = INFRA_EQUIPMENT[infra];
    results = results.filter(ex =>
      !allowed ? true :
      !ex.equipment_ids.length ? true :
      ex.equipment_ids.some(id => allowed.has(id))
    );
  }

  // Filtrar por búsqueda de texto
  if (q.trim()) {
    const qL = q.toLowerCase();
    results = results.filter(ex =>
      ex.name.toLowerCase().includes(qL) ||
      ex.name_en.toLowerCase().includes(qL) ||
      ex.muscles.some(m => m.toLowerCase().includes(qL)) ||
      ex.category.toLowerCase().includes(qL)
    );
  }

  // Filtrar por categoría
  if (category) results = results.filter(ex => ex.category_id == category);

  // Filtrar por músculo
  if (muscle) {
    const mL = muscle.toLowerCase();
    results = results.filter(ex =>
      ex.muscles.some(m => m.toLowerCase().includes(mL)) ||
      ex.muscles_secondary.some(m => m.toLowerCase().includes(mL))
    );
  }

  const total = results.length;
  const lim = parseInt(limit);
  const off = parseInt(offset);

  res.json({
    total,
    offset: off,
    exercises: results.slice(off, off + lim),
    wger_status: {
      loaded: wgerCache.loaded,
      loading: wgerCache.loading,
      count: wgerCache.exercises.length,
      error: wgerCache.error,
    },
    categories: wgerCache.categories,
  });
});

// Estado de carga de wger
app.get('/api/exercises/status', (req, res) => {
  res.json({
    loaded: wgerCache.loaded,
    loading: wgerCache.loading,
    count: wgerCache.exercises.length,
    loadedAt: wgerCache.loadedAt,
    error: wgerCache.error,
  });
});

// Fallback SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(root, 'public', 'index.html'));
});

// ── Arrancar ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🏋️  Athletic Lab System corriendo en http://localhost:${PORT}`);
  console.log(`📚 Base de conocimiento: ${Object.keys(KB).length} módulos cargados`);
  console.log(`🤖 Modelo: ${process.env.OPENAI_MODEL || 'gpt-4o-mini'}`);
  console.log(`🔗 Iniciando carga de ejercicios desde wger.de en segundo plano...`);
  // Cargar wger en background sin bloquear el servidor
  loadWgerExercises().catch(err => console.error('[wger] Error fatal:', err));
});
