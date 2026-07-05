# Athletic Lab System

> *"Être fort pour être utile."* — Georges Hébert, 1912

Sistema híbrido de athleticism y bienestar. Funciona con o sin gimnasio, con o sin presupuesto, en cualquier región del mundo.

---

## ¿Qué es esto?

Una aplicación web de entrenamiento y bienestar construida sobre cuatro principios:

- **Máxima adaptabilidad** — funciona sin equipamiento, sin infraestructura formal
- **Alta transferibilidad** — todo lo que entrenas se conecta con otros deportes y disciplinas
- **Optimización, no prescripción** — en nutrición, el sistema ajusta lo que ya comes; no impone dietas cerradas
- **Ingenio sobre recursos** — si no tienes el equipo, el sistema te enseña a reemplazarlo por equivalencia funcional

Inspirado en la *Méthode Naturelle* de Georges Hébert e integrado con IA (OpenAI) para dar respuestas conscientes del contexto de cada módulo.

---

## Módulos

| Módulo | Qué hace |
|---|---|
| **Panel** | Vista general, macros del día, estructura semanal |
| **Entrenamiento** | Sistema híbrido: calistenia, gimnasia, parkour, escalada, FRC. Bitácora de sesión. |
| **Nutrición** | Macros calibrados por Mifflin-St Jeor. Despensa con escaneo de tickets (visión IA). Generación de recetas. |
| **Mindset** | Coach IA de psicología del rendimiento. Filosofía estoica. Diario. Protocolos. |
| **Ingenio** | Base de datos de sustituciones de equipamiento por equivalencia funcional. |

El chatbot flotante en la esquina inferior derecha tiene acceso al módulo activo y al perfil del usuario — no solo conversa en abstracto.

---

## Estructura

```
athletic-lab/
├── public/
│   └── index.html              ← entrada de la SPA
├── src/
│   ├── css/
│   │   └── main.css            ← todos los estilos (sin Tailwind CDN)
│   ├── js/
│   │   ├── app.js              ← lógica principal
│   │   ├── api.js              ← llamadas al servidor
│   │   └── storage.js          ← persistencia en localStorage
│   └── data/
│       └── knowledge/          ← base de conocimiento en JSON
│           ├── training.json
│           ├── nutrition.json
│           ├── economy.json
│           ├── mindset.json
│           └── personalization.json
├── server/
│   ├── server.js               ← Express: endpoints de chat, tickets y recetas
│   ├── package.json
│   └── .env.example
└── docs/
    └── ARQUITECTURA.md
```

---

## Cómo correrlo localmente

Necesitas **Node.js v18+** instalado.

```bash
# 1. Entra a la carpeta del servidor
cd server

# 2. Instala dependencias
npm install

# 3. Crea tu archivo de variables de entorno
cp .env.example .env
# Abre .env y pon tu clave real de OpenAI:
# OPENAI_API_KEY=sk-proj-...

# 4. Arranca
npm start
```

Abre `http://localhost:3000` en tu navegador.

### Modelos disponibles

En tu `.env` puedes configurar:

```
OPENAI_MODEL=gpt-4o-mini   # más económico, suficiente para chat y recetas
OPENAI_MODEL=gpt-4o        # recomendado para escaneo de tickets (visión)
```

---

## Base de conocimiento interna

Los archivos en `src/data/knowledge/` son la base de datos interna del sistema. El servidor los inyecta automáticamente en el contexto del prompt según el módulo activo — la IA no inventa: responde desde esta base verificada.

Para expandir el conocimiento del sistema, edita estos JSON. No requieren recompilar nada.

---

## Contribuir

El proyecto está concebido como colaborativo. Si quieres añadir:

- Más sustituciones de equipamiento para tu región → `economy.json`
- Más fuentes de proteína económica de tu país → `nutrition.json`
- Más protocolos de entrenamiento verificados → `training.json`
- Un módulo nuevo → crea el HTML en `index.html`, el JS en `src/js/modules/`, y el endpoint en `server/server.js`

Abre un PR con una descripción breve de qué añades y por qué.

---

## Decisiones técnicas deliberadas

- **Sin framework de frontend** — HTML/CSS/JS vanilla para que sea legible y modificable por cualquier colaborador sin setup
- **Sin Tailwind CDN** — CSS custom completo sin warnings de producción ni dependencias externas de build
- **La clave de API nunca sale del servidor** — el cliente llama a `/api/chat`, no directamente a OpenAI
- **Base de conocimiento en JSON estáticos** — sin base de datos, sin migración, fácil de editar y versionar

---

## Licencia

MIT — úsalo, modifícalo, distribúyelo.
