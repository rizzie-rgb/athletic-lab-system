/**
 * app.js — Athletic Lab System
 * Lógica principal: navegación, estado, módulos, IA consciente del contexto.
 */

import { chatWithAI, scanTicket, generateRecipes, getDayPlan, getExercises, getExercisesStatus } from './api.js';
import { storeGet, storeSet, KEYS } from './storage.js';

// ═══════════════════════════════════════════════════════════
// ESTADO GLOBAL
// ═══════════════════════════════════════════════════════════
let profile = null;
let pantry = [];
let trainLog = [];
let nutritionLog = [];
let diarioEntries = [];
let currentModule = 'panel';
let currentStep = 1;
const TOTAL_STEPS = 4;
let goalSelected = 'rendimiento';
let chatHistory = [];
let mindChatHistory = [];

const QUOTES = [
  { text: '"Te conviertes en aquello a lo que le prestas atención."', author: '— Epicteto, Discursos', tag: 'Estoicismo' },
  { text: '"No es que el tiempo sea corto, sino que lo desperdiciamos."', author: '— Séneca, De Brevitate Vitae', tag: 'Estoicismo' },
  { text: '"La voluntad de ganar no importa si no tienes la voluntad de prepararte."', author: '— Vince Lombardi', tag: 'Competencia' },
  { text: '"No cuentes los días. Haz que los días cuenten."', author: '— Muhammad Ali', tag: 'Mentalidad' },
  { text: '"Être fort pour être utile." (Ser fuerte para ser útil.)', author: '— Georges Hébert, 1912', tag: 'Método Natural' },
  { text: '"La disciplina es elegir entre lo que quieres ahora y lo que quieres más."', author: '— Abraham Lincoln', tag: 'Disciplina' },
  { text: '"Lo que no me destruye, me hace más fuerte."', author: '— Nietzsche', tag: 'Resiliencia' },
  { text: '"No controlo el resultado, controlo el esfuerzo y la atención."', author: '— Reformulación estoica', tag: 'Control' },
];
let quoteIdx = 0;

const WEEK = [
  { key: 'lun', day: 'Lunes',    label: 'LUN', focus: 'Atletismo + movilidad ligera matutina',              color: 'var(--accent)' },
  { key: 'mar', day: 'Martes',   label: 'MAR', focus: 'Fuerza relativa — tirón, empuje, habilidades estáticas', color: 'var(--amber)' },
  { key: 'mie', day: 'Miércoles',label: 'MIÉ', focus: 'Atletismo — sin carga adicional de fuerza',          color: 'var(--accent)' },
  { key: 'jue', day: 'Jueves',   label: 'JUE', focus: 'Potencia + agarre + acondicionamiento',              color: 'var(--blue)' },
  { key: 'vie', day: 'Viernes',  label: 'VIE', focus: 'Atletismo + recuperación activa vespertina',         color: 'var(--accent)' },
  { key: 'sab', day: 'Sábado',   label: 'SÁB', focus: 'Movilidad avanzada + equilibrios + movimiento libre',color: 'var(--danger)' },
  { key: 'dom', day: 'Domingo',  label: 'DOM', focus: 'Descanso completo — recuperación activa ligera',     color: 'var(--dim)' },
];

// Cache de planes generados con persistencia diaria
let dayPlanCache = {};
let currentDayPlan = null;
let currentDayColor = null;

const EQUIP = [
  { cat: 'Carga', orig: 'Mancuernas', sub: 'Mochila cargada con libros / botellas / arena', why: 'Carga externa progresiva' },
  { cat: 'Carga', orig: 'Chaleco lastrado', sub: 'Mochila ajustada al cuerpo con bolsas de arena internas', why: 'Carga vertical distribuida' },
  { cat: 'Carga', orig: 'Kettlebell', sub: 'Bolsa con asa de cuerda cargada de arena o garrafón con asa', why: 'Carga con centro de masa desplazado' },
  { cat: 'Agarre', orig: 'Hangboard de escalada', sub: 'Borde de estante resistente, marco de puerta, toalla en barra', why: 'Fuerza de dedos y antebrazo' },
  { cat: 'Agarre', orig: 'Gripper / entrenador de agarre', sub: 'Pelota de tenis — 3×20 apretones, énfasis meñique y anular', why: 'Crítico para judo: kumi-kata se sostiene por esos dedos' },
  { cat: 'Agarre', orig: 'Farmer walk handles', sub: 'Baldes con asa cargados de agua o arena', why: 'Agarre + transporte cargado + anti-lateral de core' },
  { cat: 'Tirón', orig: 'Barra de dominadas', sub: 'Rama firme y segura / marco de puerta reforzado / barra de parque', why: 'Tirón vertical en suspensión' },
  { cat: 'Tirón', orig: 'Anillas de gimnasia', sub: 'Correas de tela resistente o asas de cuerda en soporte fijo', why: 'Agarre inestable — misma activación de estabilizadores' },
  { cat: 'Tirón', orig: 'Máquina de remo / poleas', sub: 'Banda elástica anclada a estructura fija', why: 'Tirón horizontal resistido' },
  { cat: 'Empuje', orig: 'Banco de pesas', sub: 'Dos sillas firmes de igual altura / banca de parque', why: 'Soporte elevado para ROM extendido' },
  { cat: 'Empuje', orig: 'Paralelas de fondos', sub: 'Dos sillas de respaldo alto / bordes de mesa robusta', why: 'Empuje vertical con ROM completo en hombro' },
  { cat: 'Empuje', orig: 'Press de banca pesado', sub: 'Push-ups con tempo lento (4 seg excéntrico) + variantes unilaterales', why: 'La intensidad relativa determina la adaptación' },
  { cat: 'Core', orig: 'Rueda abdominal', sub: 'Toalla sobre piso liso / tabla pequeña con ruedas', why: 'Anti-extensión de core en movimiento' },
  { cat: 'Core', orig: 'Rodillo de espuma', sub: 'Botella de vidrio o PVC envuelta en tela', why: 'Liberación miofascial por presión' },
  { cat: 'Acondicionamiento', orig: 'Soga de velocidad', sub: 'Cuerda de tendal cortada a medida axila-suelo', why: 'Coordinación de tobillo + acondicionamiento cardiovascular' },
  { cat: 'Acondicionamiento', orig: 'Cajón pliométrico', sub: 'Escalón firme de escalera / banco resistente de parque', why: 'Salto vertical con aterrizaje controlado' },
];

const AUDIT_QUESTIONS = [
  '¿Tu primera comida del día incluye una fuente de proteína?',
  '¿Comiste algo en la ventana de 1-2 horas post-entreno?',
  '¿Más de 2L de agua hoy?',
  '¿Hubo alguna comida omitida por falta de tiempo?',
  '¿Alguna comida incluyó verdura o fruta?',
];

let equipFilter = 'Todos';

// ═══════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  loadPersistedData();
  bindEvents();
  renderQuote();
  renderDiscs();
  renderEquip();
  renderAuditChecks();
  renderWeek();

  // Inicializar subtabs en estado correcto desde el arranque
  switchNutriTab('inicio');
  switchMindTab('chat');
  switchTrainTab('sesion');

  if (profile) {
    calcMacros();
    updateTopbar();
  }
});

function loadPersistedData() {
  profile       = storeGet(KEYS.PROFILE)       || null;
  pantry        = storeGet(KEYS.PANTRY)        || [];
  trainLog      = storeGet(KEYS.TRAIN_LOG)     || [];
  nutritionLog  = storeGet(KEYS.NUTRITION_LOG) || [];
  diarioEntries = storeGet(KEYS.DIARIO)        || [];

  // --- NUEVA LÓGICA DE CACHÉ PERSISTENTE ---
  const todayStr = new Date().toLocaleDateString('es-PE');
  const savedPlans = storeGet('ATH_DAY_PLANS') || {};
  if (savedPlans.date === todayStr) {
    dayPlanCache = savedPlans.plans || {}; // Si es hoy, recupera las rutinas
  } else {
    dayPlanCache = {}; // Si es un nuevo día, limpia la memoria
    storeSet('ATH_DAY_PLANS', { date: todayStr, plans: {} });
  }
  // -----------------------------------------

  renderPantry();
  renderTrainLog();
  renderNutritionLog();
  renderDiario();
}

// ═══════════════════════════════════════════════════════════
// NAVEGACIÓN
// ═══════════════════════════════════════════════════════════
window.goTo = function(screenId) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.add('hidden');
  });
  document.getElementById(screenId).classList.remove('hidden');
}

function goToDashboard() {
  calcMacros();
  updateTopbar();
  goTo('s-dash');
}

// ═══════════════════════════════════════════════════════════
// BIND EVENTS
// ═══════════════════════════════════════════════════════════
function bindEvents() {
  // Splash
  document.getElementById('btn-start').addEventListener('click', () => goTo('s-onboard'));
  document.getElementById('btn-enter').addEventListener('click', () => goToDashboard());

  // Stepper
  document.getElementById('btn-next').addEventListener('click', () => moveStepper(1));
  document.getElementById('btn-back').addEventListener('click', () => moveStepper(-1));

  // Onboarding — intent pills
  document.querySelectorAll('.intent-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.intent-pill').forEach(p => p.classList.remove('sel'));
      pill.classList.add('sel');
      goalSelected = pill.dataset.val;
    });
  });

  // Onboarding — capsules
  document.querySelectorAll('#disc-caps .capsule').forEach(c => {
    c.addEventListener('click', () => c.classList.toggle('sel'));
  });

  // Tabs principales
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchMod(btn.dataset.mod, btn));
  });

  // Subtabs entrenamiento
  document.querySelectorAll('#train-subtabs .btn-ghost').forEach(btn => {
    btn.addEventListener('click', () => switchTrainTab(btn.dataset.ttab));
  });

  // Biblioteca — filtros de categoría
  document.getElementById('lib-cat-filters')?.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    document.querySelectorAll('#lib-cat-filters button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    libState.category = btn.dataset.catid || '';
    libState.offset = 0;
    loadLibrary(true);
  });

  // Biblioteca — búsqueda
  document.getElementById('lib-search')?.addEventListener('input', debounce(() => {
    libState.q = document.getElementById('lib-search').value;
    libState.offset = 0;
    loadLibrary(true);
  }, 400));

  // Biblioteca — cargar más
  document.getElementById('btn-lib-more')?.addEventListener('click', () => {
    libState.offset += libState.limit;
    loadLibrary(false);
  });

  // Subtabs nutrición
  document.querySelectorAll('#nutri-subtabs .btn-ghost').forEach(btn => {
    btn.addEventListener('click', () => switchNutriTab(btn.dataset.ntab));
  });

  // Subtabs mindset
  document.querySelectorAll('#mind-subtabs .btn-ghost').forEach(btn => {
    btn.addEventListener('click', () => switchMindTab(btn.dataset.mtab));
  });

  // Citas
  document.getElementById('btn-rotate-quote').addEventListener('click', () => {
    quoteIdx = (quoteIdx + 1) % QUOTES.length;
    renderQuote();
  });

  // Bitácora entrenamiento
  document.getElementById('btn-save-train').addEventListener('click', saveTrainEntry);

  // Nutrición log
  document.getElementById('btn-save-nutri').addEventListener('click', saveNutriEntry);

  // Diario
  document.getElementById('btn-save-diario').addEventListener('click', saveDiarioEntry);

  // Ticket
  document.getElementById('ticket-input').addEventListener('change', handleTicket);

  // Recetas
  document.getElementById('btn-gen-recipes').addEventListener('click', handleRecipes);

  // Equip search
  document.getElementById('equip-search').addEventListener('input', renderEquip);

  // Equip filters
  document.getElementById('equip-filters').addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    equipFilter = btn.dataset.cat;
    document.querySelectorAll('#equip-filters button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderEquip();
  });

  // Chat global FAB
  document.getElementById('chat-fab').addEventListener('click', () => {
    document.getElementById('chat-panel').classList.toggle('open');
  });
  document.getElementById('btn-close-chat').addEventListener('click', () => {
    document.getElementById('chat-panel').classList.remove('open');
  });
  document.getElementById('btn-send-chat').addEventListener('click', sendGlobalChat);
  document.getElementById('chat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') sendGlobalChat();
  });

  // Chat mindset
  document.getElementById('btn-send-mind').addEventListener('click', sendMindChat);
  document.getElementById('mind-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') sendMindChat();
  });
}

// ═══════════════════════════════════════════════════════════
// STEPPER (ONBOARDING)
// ═══════════════════════════════════════════════════════════
const STEP_LABELS = ['Paso 1 — Biometría', 'Paso 2 — Entrenamiento', 'Paso 3 — Objetivo', 'Paso 4 — Restricciones'];

function moveStepper(dir) {
  if (dir === 1 && currentStep === TOTAL_STEPS) {
    saveProfile();
    goToDashboard();
    return;
  }
  document.getElementById('step-' + currentStep).classList.remove('active');
  currentStep = Math.max(1, Math.min(TOTAL_STEPS, currentStep + dir));
  document.getElementById('step-' + currentStep).classList.add('active');
  document.getElementById('step-label').textContent = STEP_LABELS[currentStep - 1];
  document.getElementById('step-count').textContent = currentStep + ' / ' + TOTAL_STEPS;
  document.getElementById('step-progress').style.width = (currentStep / TOTAL_STEPS * 100) + '%';

  const backBtn = document.getElementById('btn-back');
  const nextBtn = document.getElementById('btn-next');
  backBtn.style.display = currentStep > 1 ? 'block' : 'none';
  nextBtn.style.width = currentStep > 1 ? '67%' : '100%';
  nextBtn.textContent = currentStep < TOTAL_STEPS ? 'Siguiente →' : 'Completar diagnóstico ✓';
}

// ═══════════════════════════════════════════════════════════
// PERFIL
// ═══════════════════════════════════════════════════════════
function saveProfile() {
  const disciplines = [...document.querySelectorAll('#disc-caps .capsule.sel')]
    .map(c => c.textContent.trim());

  profile = {
    name:       document.getElementById('in-name').value || 'Atleta',
    age:        +document.getElementById('in-age').value,
    sex:        document.getElementById('in-sex').value,
    height:     +document.getElementById('in-height').value,
    weight:     +document.getElementById('in-weight').value,
    country:    document.getElementById('in-country').value,
    activity:   document.getElementById('in-activity').value,
    trainType:  document.getElementById('in-train-type').value,
    trainFreq:  +document.getElementById('in-freq').value,
    trainDur:   +document.getElementById('in-dur').value,
    sleep:      +document.getElementById('in-sleep').value,
    job:        document.getElementById('in-job').value,
    goal:       goalSelected,
    goalText:   document.getElementById('in-goal-text').value,
    restrict:   document.getElementById('in-restrict').value,
    budget:     document.getElementById('in-budget').value,
    infra:      document.getElementById('in-infra').value,
    injuries:   document.getElementById('in-injuries').value,
    disciplines,
  };
  storeSet(KEYS.PROFILE, profile);
}

function updateTopbar() {
  if (!profile) return;
  document.getElementById('topbar-name').textContent = profile.name;
  const goalLabel = { rendimiento: 'Rendimiento Atlético', ganar: 'Ganar Músculo', perder: 'Perder Grasa', recomposicion: 'Recomposición', salud: 'Salud General' };
  document.getElementById('topbar-goal').textContent = goalLabel[profile.goal] || '–';
  const countryMeta = { PE: 'PER', MX: 'MEX', CO: 'COL', AR: 'ARG', CL: 'CHI', ES: 'ESP', US: 'USA', BR: 'BRA' };
  document.getElementById('topbar-meta').textContent = (countryMeta[profile.country] || profile.country) + ' // ACTIVO';
}

// ═══════════════════════════════════════════════════════════
// MACROS (Mifflin-St Jeor)
// ═══════════════════════════════════════════════════════════
function calcMacros() {
  const p = profile;
  if (!p) return;

  const bmr = p.sex === 'M'
    ? 10 * p.weight + 6.25 * p.height - 5 * p.age + 5
    : 10 * p.weight + 6.25 * p.height - 5 * p.age - 161;

  const mult = { sedentario: 1.2, ligero: 1.375, moderado: 1.55, intenso: 1.725 };
  const tdee = Math.round(bmr * (mult[p.activity] || 1.55));

  const kcalMap = { perder: tdee - 400, ganar: tdee + 300, rendimiento: tdee, recomposicion: tdee, salud: tdee };
  const kcal = kcalMap[p.goal] || tdee;
  const prot = Math.round(p.weight * 2.2);
  const carbs = Math.round((kcal - prot * 4) * 0.55 / 4);

  const currency = { PE: 'S/', MX: '$', CO: '$', AR: '$', CL: '$', ES: '€', US: '$', BR: 'R$' }[p.country] || 'S/';
  const costMap = { critico: '12–18', moderado: '20–30', comodo: '30–50' };
  const cost = currency + (costMap[p.budget] || '20–30');

  setEl('d-kcal', kcal); setEl('d-prot', prot + 'g'); setEl('d-cost', cost);
  setEl('n-kcal', kcal); setEl('n-prot', prot + 'g'); setEl('n-carbs', carbs + 'g');
}

// ═══════════════════════════════════════════════════════════
// NAVEGACIÓN ENTRE MÓDULOS
// ═══════════════════════════════════════════════════════════
function switchMod(mod, btn) {
  currentModule = mod;
  document.querySelectorAll('.modcontent').forEach(el => el.classList.add('hidden'));
  document.getElementById('mod-' + mod).classList.remove('hidden');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  // Reinicializar subtabs al entrar al módulo
  if (mod === 'nutri') switchNutriTab('inicio');
  if (mod === 'mindset') switchMindTab('chat');
  if (mod === 'entrena') { switchTrainTab('sesion'); checkWgerStatus(); }
  // Resetear historial del chat global al cambiar módulo
  chatHistory = [];
}

function switchNutriTab(tab) {
  ['inicio', 'despensa', 'recetas'].forEach(t => {
    const el = document.getElementById('ntab-' + t);
    if (el) el.classList.toggle('tab-hidden', t !== tab);
  });
  document.querySelectorAll('#nutri-subtabs .btn-ghost').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.ntab === tab);
  });
}

function switchMindTab(tab) {
  ['chat', 'diario', 'protocolos'].forEach(t => {
    const el = document.getElementById('mtab-' + t);
    if (el) el.classList.toggle('tab-hidden', t !== tab);
  });
  document.querySelectorAll('#mind-subtabs .btn-ghost').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mtab === tab);
  });
}

// ═══════════════════════════════════════════════════════════
// RENDER: DISCIPLINAS
// ═══════════════════════════════════════════════════════════
function renderDiscs() {
  const list = document.getElementById('disc-list');
  if (!list) return;
  list.innerHTML = DISCIPLINES.map(d => `
    <div class="disc-row">
      <div class="disc-icon" style="background:${d.color}18">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${d.color}" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
      </div>
      <div>
        <div style="font-size:12px;font-weight:500;color:var(--text)">${d.name}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">${d.desc}</div>
      </div>
    </div>
  `).join('');
}

// ═══════════════════════════════════════════════════════════
// RENDER: CITA DEL DÍA
// ═══════════════════════════════════════════════════════════
function renderQuote() {
  const q = QUOTES[quoteIdx];
  document.getElementById('quote-text').textContent = q.text;
  document.getElementById('quote-author').textContent = q.author;
  document.getElementById('quote-tag').textContent = q.tag;
}

// ═══════════════════════════════════════════════════════════
// RENDER: AUDITORÍA NUTRICIONAL
// ═══════════════════════════════════════════════════════════
function renderAuditChecks() {
  const el = document.getElementById('audit-checks');
  if (!el) return;
  el.innerHTML = AUDIT_QUESTIONS.map(q => `
    <div style="display:flex;align-items:center;gap:10px">
      <div style="width:16px;height:16px;border:1px solid var(--border);border-radius:4px;flex-shrink:0;cursor:pointer;transition:all .15s"
           onclick="this.style.background=this.style.background?'':'var(--accent)';this.style.borderColor=this.style.background?'var(--accent)':'var(--border)'">
      </div>
      <span style="font-size:11px;color:var(--muted)">${q}</span>
    </div>
  `).join('');
}

// ═══════════════════════════════════════════════════════════
// RENDER: EQUIP (INGENIO)
// ═══════════════════════════════════════════════════════════
function renderEquip() {
  // Filtros
  const filtersEl = document.getElementById('equip-filters');
  if (filtersEl && !filtersEl.dataset.built) {
    const cats = ['Todos', ...new Set(EQUIP.map(e => e.cat))];
    filtersEl.innerHTML = cats.map(c => `
      <button class="btn-ghost${c === equipFilter ? ' active' : ''}" data-cat="${c}" style="font-size:10px;padding:6px 11px">${c}</button>
    `).join('');
    filtersEl.dataset.built = '1';
  }

  const q = (document.getElementById('equip-search')?.value || '').toLowerCase();
  const list = document.getElementById('equip-list');
  if (!list) return;

  const filtered = EQUIP.filter(e =>
    (equipFilter === 'Todos' || e.cat === equipFilter) &&
    (e.orig.toLowerCase().includes(q) || e.sub.toLowerCase().includes(q) || e.cat.toLowerCase().includes(q))
  );

  list.innerHTML = filtered.length
    ? filtered.map(e => `
        <div class="replace-row">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <span class="tag tag-dim">${e.cat}</span>
          </div>
          <div class="orig">${e.orig}</div>
          <div class="sub">→ ${e.sub}</div>
          <div class="why">${e.why}</div>
        </div>
      `).join('')
    : '<div style="font-size:12px;color:var(--dim);padding:10px 0">Sin resultados para esa búsqueda.</div>';
}

// ═══════════════════════════════════════════════════════════
// PANTRY
// ═══════════════════════════════════════════════════════════
function renderPantry() {
  const list = document.getElementById('pantry-list');
  const countEl = document.getElementById('pantry-count');
  if (!list) return;

  if (!pantry.length) {
    list.innerHTML = '<div style="font-size:12px;color:var(--dim);padding:8px 0">La despensa está vacía — escanea un ticket para comenzar.</div>';
    if (countEl) countEl.textContent = '0 ítems';
    return;
  }

  if (countEl) countEl.textContent = pantry.length + ' ítem' + (pantry.length !== 1 ? 's' : '');

  const catColor = { proteina: 'var(--accent)', carbohidrato: 'var(--amber)', verdura: '#60D080', fruta: '#F08040', lacteo: 'var(--blue)', grasa: '#C0C060', otro: 'var(--muted)' };

  list.innerHTML = pantry.map((item, i) => `
    <div class="pantry-item fadein">
      <div>
        <div style="font-size:12px;font-weight:500">${item.name}</div>
        <div style="font-size:10px;color:${catColor[item.category] || 'var(--muted)'};margin-top:2px">${item.category || 'otro'}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:12px;color:var(--accent);font-weight:700">${item.quantity} ${item.unit || ''}</div>
        <button onclick="removePantryItem(${i})" style="font-size:10px;color:var(--danger);background:none;border:none;cursor:pointer;padding:0;margin-top:2px">eliminar</button>
      </div>
    </div>
  `).join('');
}

window.removePantryItem = function(idx) {
  pantry.splice(idx, 1);
  storeSet(KEYS.PANTRY, pantry);
  renderPantry();
};

// ═══════════════════════════════════════════════════════════
// TICKET SCAN
// ═══════════════════════════════════════════════════════════
async function handleTicket(e) {
  const file = e.target.files[0];
  if (!file) return;

  const loader = document.getElementById('pantry-loader');
  loader.style.display = 'block';

  try {
    const result = await scanTicket(file);
    if (result.items && result.items.length) {
      // Fusionar con despensa existente
      result.items.forEach(newItem => {
        const existing = pantry.find(p =>
          p.name.toLowerCase() === newItem.name.toLowerCase()
        );
        if (existing) {
          existing.quantity = (parseFloat(existing.quantity) || 0) + (parseFloat(newItem.quantity) || 1);
        } else {
          pantry.push(newItem);
        }
      });
      storeSet(KEYS.PANTRY, pantry);
      renderPantry();
    } else {
      alert('No se encontraron alimentos en el ticket. Intenta con una foto más clara.');
    }
  } catch (err) {
    console.error(err);
    alert('Error al escanear el ticket: ' + err.message);
  } finally {
    loader.style.display = 'none';
    e.target.value = '';
  }
}

// ═══════════════════════════════════════════════════════════
// RECETAS
// ═══════════════════════════════════════════════════════════
async function handleRecipes() {
  const loader = document.getElementById('recetas-loader');
  const list = document.getElementById('recetas-list');
  loader.style.display = 'block';
  list.innerHTML = '';

  try {
    const result = await generateRecipes(profile, pantry, profile?.restrict || '');
    const recetas = result.recetas || [];

    if (!recetas.length) {
      list.innerHTML = '<div style="font-size:12px;color:var(--dim);padding:10px 0">No se generaron recetas. Añade ingredientes a tu despensa primero.</div>';
      return;
    }

    list.innerHTML = recetas.map((r, i) => `
      <div class="recipe-card fadein" style="animation-delay:${i * .1}s">
        <div class="recipe-card-head">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
            <div style="font-size:13px;font-weight:500;line-height:1.3">${r.titulo}</div>
            <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;flex-shrink:0">
              <span class="tag tag-green">${r.tiempo_min} min</span>
              <span class="tag tag-dim">${r.dificultad}</span>
            </div>
          </div>
        </div>
        <div class="recipe-card-body">
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px">
            <div class="macro"><div class="v" style="color:var(--text)">${r.macros?.kcal || '–'}</div><div class="l">kcal</div></div>
            <div class="macro"><div class="v text-accent">${r.macros?.proteina_g || '–'}g</div><div class="l">prot</div></div>
            <div class="macro"><div class="v" style="color:var(--amber)">${r.macros?.carbos_g || '–'}g</div><div class="l">carbos</div></div>
            <div class="macro"><div class="v" style="color:var(--muted)">${r.macros?.grasas_g || '–'}g</div><div class="l">grasas</div></div>
          </div>
          <p style="font-size:11px;color:var(--muted);font-style:italic;margin-bottom:10px">${r.encaje_objetivo || ''}</p>
          ${r.pasos && r.pasos.length ? `
            <div style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:6px">Preparación</div>
            <ol style="font-size:11px;color:var(--muted);line-height:1.7;padding-left:16px">
              ${r.pasos.map(paso => `<li>${paso}</li>`).join('')}
            </ol>
          ` : ''}
          <button class="btn-ghost w-full mt-10" onclick="markCooked(this, ${i})">Marcar como cocinado →</button>
        </div>
      </div>
    `).join('');

    // Guardar en historial
    const history = storeGet(KEYS.RECIPE_HISTORY) || [];
    history.unshift({ date: new Date().toLocaleDateString('es-PE'), count: recetas.length });
    storeSet(KEYS.RECIPE_HISTORY, history.slice(0, 20));

  } catch (err) {
    console.error(err);
    list.innerHTML = `<div style="font-size:12px;color:var(--danger);padding:10px 0">Error: ${err.message}</div>`;
  } finally {
    loader.style.display = 'none';
  }
}

window.markCooked = function(btn, idx) {
  btn.textContent = '✓ Cocinado';
  btn.style.color = 'var(--accent)';
  btn.style.borderColor = 'var(--accent)';
  btn.disabled = true;
};

// ═══════════════════════════════════════════════════════════
// LOGS
// ═══════════════════════════════════════════════════════════
function saveTrainEntry() {
  const input = document.getElementById('train-log-input');
  const text = input.value.trim();
  if (!text) return;
  trainLog.unshift({ date: new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }), text });
  storeSet(KEYS.TRAIN_LOG, trainLog);
  input.value = '';
  renderTrainLog();
}

function renderTrainLog() {
  const list = document.getElementById('train-log-list');
  if (!list) return;
  list.innerHTML = trainLog.slice(0, 6).map(e => `
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px 12px">
      <div style="font-size:9px;color:var(--accent);letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">${e.date}</div>
      <div style="font-size:12px;color:var(--muted);line-height:1.5">${e.text}</div>
    </div>
  `).join('') || '<div style="font-size:12px;color:var(--dim)">Sin registros aún.</div>';
}

function saveNutriEntry() {
  const input = document.getElementById('nutri-log-input');
  const text = input.value.trim();
  if (!text) return;
  nutritionLog.unshift({ date: new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }), text });
  storeSet(KEYS.NUTRITION_LOG, nutritionLog);
  input.value = '';
  renderNutritionLog();
}

function renderNutritionLog() {
  const list = document.getElementById('nutrition-log-list');
  if (!list) return;
  list.innerHTML = nutritionLog.slice(0, 6).map(e => `
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px 12px">
      <div style="font-size:9px;color:var(--accent);letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">${e.date}</div>
      <div style="font-size:12px;color:var(--muted);line-height:1.5">${e.text}</div>
    </div>
  `).join('') || '<div style="font-size:12px;color:var(--dim)">Sin registros aún.</div>';
}

function saveDiarioEntry() {
  const input = document.getElementById('diario-input');
  const text = input.value.trim();
  if (!text) return;
  diarioEntries.unshift({ date: new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }), text });
  storeSet(KEYS.DIARIO, diarioEntries);
  input.value = '';
  renderDiario();
}

function renderDiario() {
  const list = document.getElementById('diario-list');
  if (!list) return;
  list.innerHTML = diarioEntries.slice(0, 6).map(e => `
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px 12px">
      <div style="font-size:9px;color:var(--danger);letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">${e.date}</div>
      <div style="font-size:12px;color:var(--muted);line-height:1.5;font-family:var(--font-serif);font-style:italic">${e.text}</div>
    </div>
  `).join('') || '<div style="font-size:12px;color:var(--dim)">Sin entradas aún.</div>';
}

// ═══════════════════════════════════════════════════════════
// CHAT GLOBAL (con contexto del módulo activo)
// ═══════════════════════════════════════════════════════════
async function sendGlobalChat() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';

  const msgs = document.getElementById('chat-msgs');
  appendMsg(msgs, 'user', text);
  chatHistory.push({ role: 'user', content: text });
  msgs.scrollTop = msgs.scrollHeight;

  const typingEl = appendTyping(msgs);

  try {
    const moduleData = buildModuleData();
    const reply = await chatWithAI(chatHistory, currentModule, profile, moduleData);
    typingEl.remove();
    appendMsg(msgs, 'bot', reply);
    chatHistory.push({ role: 'assistant', content: reply });
  } catch (err) {
    typingEl.remove();
    appendMsg(msgs, 'bot', 'Error: ' + err.message + '\n\nVerifica que el servidor esté corriendo con npm start.');
  }
  msgs.scrollTop = msgs.scrollHeight;
}

// ═══════════════════════════════════════════════════════════
// CHAT MINDSET
// ═══════════════════════════════════════════════════════════
async function sendMindChat() {
  const input = document.getElementById('mind-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';

  const msgs = document.getElementById('mind-messages');
  appendMsg(msgs, 'user', text);
  mindChatHistory.push({ role: 'user', content: text });
  msgs.scrollTop = msgs.scrollHeight;

  const typingEl = appendTyping(msgs);

  try {
    const moduleData = { diarioEntries: diarioEntries.slice(0, 3) };
    const reply = await chatWithAI(mindChatHistory, 'mindset', profile, moduleData);
    typingEl.remove();
    appendMsg(msgs, 'bot', reply);
    mindChatHistory.push({ role: 'assistant', content: reply });
  } catch (err) {
    typingEl.remove();
    appendMsg(msgs, 'bot', 'Error de conexión: ' + err.message);
  }
  msgs.scrollTop = msgs.scrollHeight;
}

// ═══════════════════════════════════════════════════════════
// HELPERS DE CHAT
// ═══════════════════════════════════════════════════════════
function appendMsg(container, role, text) {
  const emptyEl = container.querySelector('.chat-empty');
  if (emptyEl) emptyEl.remove();

  const div = document.createElement('div');
  div.className = (role === 'user' ? 'msg-user' : 'msg-bot') + ' fadein';
  div.textContent = text;
  container.appendChild(div);
}

function appendTyping(container) {
  const div = document.createElement('div');
  div.className = 'msg-bot';
  div.innerHTML = '<span class="pulse-dot"></span>';
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

// ═══════════════════════════════════════════════════════════
// DATOS DEL MÓDULO ACTIVO (para contexto de IA)
// ═══════════════════════════════════════════════════════════
function buildModuleData() {
  switch (currentModule) {
    case 'entrena':
      return { trainLog: trainLog.slice(0, 5) };
    case 'nutri':
      return { pantry: pantry.slice(0, 20), nutritionLog: nutritionLog.slice(0, 5) };
    case 'mindset':
      return { diarioEntries: diarioEntries.slice(0, 3) };
    case 'ingenio':
      return { userEquip: profile ? { infra: profile.infra, budget: profile.budget } : {} };
    default:
      return {};
  }
}

// ═══════════════════════════════════════════════════════════
// UTIL
// ═══════════════════════════════════════════════════════════
function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ═══════════════════════════════════════════════════════════
// SEMANA CLICKEABLE
// ═══════════════════════════════════════════════════════════
function renderWeek() {
  const container = document.getElementById('week-rows-panel');
  if (!container) return;

  container.innerHTML = WEEK.map(w => `
    <div class="week-row" onclick="openDayModal('${w.key}','${w.day}','${w.label}',\`${w.focus}\`,'${w.color}')">
      <div class="week-day" style="color:${w.color}">${w.label}</div>
      <div class="week-focus" style="flex:1">
        <span id="wfocus-${w.key}">${w.focus}</span>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${w.color}" stroke-width="2" style="flex-shrink:0;opacity:.5">
        <path d="M9 18l6-6-6-6"/>
      </svg>
    </div>
  `).join('');
}

// ═══════════════════════════════════════════════════════════
// NAVEGACIÓN DE RUTINAS (PANTALLA 2 Y 3)
// ═══════════════════════════════════════════════════════════

window.openDayModal = async function(key, day, label, focus, color) {
  // 1. Navegación inmediata a Pantalla 2 (feedback visual instantáneo)
  goTo('s-day-blocks');
  
  document.getElementById('sdb-day-label').textContent = label;
  document.getElementById('sdb-day-label').style.color = color;
  document.getElementById('sdb-day-focus').textContent = focus;
  
  const metaEl = document.getElementById('sdb-meta');
  const blocksEl = document.getElementById('sdb-blocks');
  
  metaEl.innerHTML = '';
  blocksEl.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;text-align:center;gap:12px">
      <span class="pulse-dot" style="width:12px;height:12px;background:${color}"></span>
      <p style="font-size:12px;color:var(--muted)">El Coach IA está programando tu sesión...</p>
    </div>
  `;

  try {
    let plan = dayPlanCache[key];
    if (!plan) {
      // Si no hay caché, llama a la IA y guárdalo persistente
      plan = await getDayPlan(day, focus, profile);
      dayPlanCache[key] = plan;
      storeSet('ATH_DAY_PLANS', { date: new Date().toLocaleDateString('es-PE'), plans: dayPlanCache });
    }
    
    currentDayPlan = plan;
    currentDayColor = color;
    renderDayBlocks(plan, color);
    
  } catch (err) {
    blocksEl.innerHTML = `
      <div style="background:var(--bg);border:1px solid var(--danger);border-radius:12px;padding:14px;font-size:12px;color:var(--danger)">
        Error al generar la rutina: ${err.message}
      </div>
    `;
  }
};

window.renderDayBlocks = function(plan, color) {
  const intensityColor = { 'alta': 'var(--danger)', 'moderada': 'var(--amber)', 'baja': 'var(--accent)', 'recuperación': 'var(--blue)' };
  const iColor = intensityColor[plan.intensidad?.toLowerCase()] || 'var(--muted)';
  
  document.getElementById('sdb-meta').innerHTML = `
    <span class="tag" style="background:${color}18;color:${color};border:1px solid ${color}40">⏱ ${plan.duracion_total_min || '–'} min</span>
    <span class="tag" style="background:${iColor}18;color:${iColor};border:1px solid ${iColor}40">${plan.intensidad || 'moderada'}</span>
  `;

  const blocksEl = document.getElementById('sdb-blocks');
  if (!plan.bloques || plan.bloques.length === 0) {
    blocksEl.innerHTML = '<p style="font-size:12px;color:var(--dim)">Sin bloques de entrenamiento.</p>';
    return;
  }

  // Cards de cada bloque
  let html = plan.bloques.map((b, idx) => `
    <div onclick="openBlock(${idx})" style="background:var(--bg);border:1px solid var(--border);border-radius:14px;padding:16px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;transition:background 0.2s" onmouseover="this.style.background='var(--s1)'" onmouseout="this.style.background='var(--bg)'">
      <div>
        <h3 class="fb" style="font-size:18px;line-height:1;margin-bottom:4px">${b.nombre}</h3>
        <p style="font-size:11px;color:var(--muted)">⏱ ${b.duracion_min || 0} min • ${b.ejercicios?.length || 0} ejercicios</p>
      </div>
      <div style="color:var(--muted)">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
      </div>
    </div>
  `).join('');

  // Nota del entrenador al final
  if (plan.nota_final) {
    html += `
      <div style="background:var(--bg);border-left:2px solid ${color};padding:12px 16px;margin-top:8px">
        <div style="font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:${color};margin-bottom:4px">Nota del entrenador</div>
        <p style="font-size:12px;color:var(--muted);line-height:1.6;font-family:var(--font-serif);font-style:italic">${plan.nota_final}</p>
      </div>
    `;
  }
  
  html += `
    <button class="btn-ghost w-full" style="margin-top:16px" onclick="regenerateDayPlan('${plan.dia}')">
      Regenerar rutina (IA) →
    </button>
  `;
  
  blocksEl.innerHTML = html;
};

window.openBlock = function(idx) {
  if (!currentDayPlan || !currentDayPlan.bloques[idx]) return;
  const b = currentDayPlan.bloques[idx];
  
  goTo('s-day-exercises'); // Navegar a Pantalla 3
  
  document.getElementById('sde-block-name').textContent = b.nombre;
  document.getElementById('sde-block-name').style.color = currentDayColor;
  document.getElementById('sde-block-desc').textContent = b.descripcion || '';
  
  const listEl = document.getElementById('sde-exercises');
  
  if (!b.ejercicios || b.ejercicios.length === 0) {
    listEl.innerHTML = '<p style="font-size:12px;color:var(--dim)">Sin ejercicios para este bloque.</p>';
    return;
  }
  
  listEl.innerHTML = b.ejercicios.map(ex => `
    <div class="exercise-row">
      <div class="exercise-name">${ex.nombre}</div>
      <div class="exercise-meta">
        <span class="exercise-badge" style="background:var(--s2);color:var(--text)">${ex.series} series</span>
        <span class="exercise-badge" style="background:var(--s2);color:var(--accent)">${ex.reps}</span>
        ${ex.descanso_seg ? `<span class="exercise-badge" style="background:var(--s2);color:var(--muted)">Descanso ${ex.descanso_seg}s</span>` : ''}
      </div>
      ${ex.tecnica ? `<p class="exercise-tip" style="margin-top:8px">" ${ex.tecnica} "</p>` : ''}
      ${ex.equivalencia_sin_equipo ? `
        <div class="exercise-equiv">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;margin-top:1px"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          <span><b>Ingenio:</b> ${ex.equivalencia_sin_equipo}</span>
        </div>
      ` : ''}
    </div>
  `).join('');
};

window.regenerateDayPlan = function(day) {
  const w = WEEK.find(x => x.day === day || x.key === day);
  if (!w) return;
  
  // Borrar del caché persistente
  delete dayPlanCache[w.key];
  storeSet('ATH_DAY_PLANS', { date: new Date().toLocaleDateString('es-PE'), plans: dayPlanCache });
  
  // Volver a llamar a la API
  openDayModal(w.key, w.day, w.label, w.focus, w.color);
};

window.regenerateDayPlan = function(day, btn) {
  const w = WEEK.find(w => w.day === day || w.key === day);
  if (!w) return;
  delete dayPlanCache[w.key];
  btn.textContent = 'Regenerando…';
  btn.disabled = true;
  openDayModal(w.key, w.day, w.label, w.focus, w.color);
};

// ═══════════════════════════════════════════════════════════
// PROTOCOLOS — FILTRO POR SUBCATEGORÍA
// ═══════════════════════════════════════════════════════════
window.switchProtoFilter = function(btn) {
  const target = btn.dataset.proto;

  // Actualizar botones activos
  document.querySelectorAll('#proto-filters .btn-ghost').forEach(b => {
    b.classList.toggle('active', b === btn);
  });

  // Mostrar solo la subcategoría seleccionada
  ['rendimiento', 'visualizacion', 'relajacion', 'mindfulness'].forEach(cat => {
    const el = document.getElementById('proto-' + cat);
    if (el) el.style.display = cat === target ? 'flex' : 'none';
  });
};

// ═══════════════════════════════════════════════════════════
// SUBTABS ENTRENAMIENTO
// ═══════════════════════════════════════════════════════════
function switchTrainTab(tab) {
  ['sesion', 'biblioteca'].forEach(t => {
    const el = document.getElementById('ttab-' + t);
    if (el) el.classList.toggle('tab-hidden', t !== tab);
  });
  document.querySelectorAll('#train-subtabs .btn-ghost').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.ttab === tab);
  });
  if (tab === 'biblioteca') {
    checkWgerStatus();
    if (!libState.loaded) loadLibrary(true);
  }
}

// ═══════════════════════════════════════════════════════════
// BIBLIOTECA DE EJERCICIOS (wger)
// ═══════════════════════════════════════════════════════════
const libState = {
  q: '',
  category: '',
  muscle: '',
  offset: 0,
  limit: 30,
  total: 0,
  loaded: false,
};

async function checkWgerStatus() {
  const bar = document.getElementById('wger-status-bar');
  try {
    const status = await getExercisesStatus();
    if (bar) {
      if (status.loading && !status.loaded) {
        bar.style.display = 'block';
        bar.querySelector('span:last-child').textContent =
          `Cargando ejercicios desde wger.de… (${status.count} cargados hasta ahora)`;
        setTimeout(checkWgerStatus, 3000);
      } else if (status.loaded) {
        bar.style.display = 'none';
        if (!libState.loaded) loadLibrary(true);
      } else if (status.error) {
        bar.style.display = 'block';
        bar.querySelector('span:last-child').textContent =
          `No se pudo conectar a wger.de — ${status.error}`;
        bar.querySelector('.pulse-dot').style.background = 'var(--danger)';
      }
    }
  } catch (e) {
    if (bar) {
      bar.style.display = 'block';
      bar.querySelector('span:last-child').textContent = 'Error al verificar estado de ejercicios.';
    }
  }
}

async function loadLibrary(reset = false) {
  const listEl  = document.getElementById('lib-list');
  const countEl = document.getElementById('lib-count');
  const moreBtn = document.getElementById('btn-lib-more');
  const emptyEl = document.getElementById('lib-empty');
  if (!listEl) return;

  if (reset) {
    listEl.innerHTML = `
      <div class="flex-col gap-8">
        ${[1,2,3,4].map(() => `<div class="skel" style="height:72px;border-radius:12px"></div>`).join('')}
      </div>`;
    if (emptyEl) emptyEl.style.display = 'none';
    if (moreBtn) moreBtn.style.display = 'none';
  }

  try {
    const data = await getExercises({
      q: libState.q,
      category: libState.category,
      infra: profile?.infra || '',
      limit: libState.limit,
      offset: libState.offset,
    });

    libState.total = data.total;
    libState.loaded = true;

    if (countEl) {
      countEl.textContent = `${data.total} ejercicio${data.total !== 1 ? 's' : ''}${profile?.infra && profile.infra !== 'gym-completo' ? ' (filtrados para tu infraestructura)' : ''}`;
    }

    const exercises = data.exercises || [];

    if (reset) listEl.innerHTML = '';

    if (!exercises.length && reset) {
      if (emptyEl) emptyEl.style.display = 'block';
      if (moreBtn) moreBtn.style.display = 'none';
      return;
    }

    exercises.forEach(ex => {
      const card = document.createElement('div');
      card.className = 'exercise-lib-card fadein';
      card.innerHTML = `
        <div style="display:flex;align-items:flex-start;gap:10px">
          ${ex.image ? `<img src="${ex.image}" alt="${ex.name}" style="width:52px;height:52px;border-radius:8px;object-fit:cover;flex-shrink:0;background:var(--s2)">` : `<div style="width:52px;height:52px;border-radius:8px;background:var(--s2);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--border2)" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M6 20v-2a6 6 0 0 1 12 0v2"/></svg></div>`}
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:500;color:var(--text);margin-bottom:3px;line-height:1.3">${ex.name}</div>
            <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:4px">
              <span class="tag tag-dim" style="font-size:8px">${ex.category}</span>
              ${ex.muscles.slice(0,2).map(m => `<span class="tag tag-green" style="font-size:8px">${m}</span>`).join('')}
              ${ex.equipment[0] ? `<span class="tag tag-amber" style="font-size:8px">${ex.equipment[0]}</span>` : ''}
            </div>
            ${ex.description ? `<p style="font-size:10px;color:var(--dim);line-height:1.4">${ex.description.slice(0, 120)}${ex.description.length > 120 ? '…' : ''}</p>` : ''}
          </div>
        </div>`;
      listEl.appendChild(card);
    });

    const shown = libState.offset + exercises.length;
    if (moreBtn) {
      moreBtn.style.display = shown < libState.total ? 'block' : 'none';
      moreBtn.textContent = `Cargar más (${libState.total - shown} restantes) →`;
    }

  } catch (err) {
    if (reset) listEl.innerHTML = `<div style="font-size:12px;color:var(--danger);padding:10px 0">Error: ${err.message}</div>`;
  }
}

// ── Debounce helper ───────────────────────────────────────────────────────────
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
