# ARQUITECTURA

## Mapa de módulos → código

| Módulo del sistema | Archivo principal | Base de conocimiento | Endpoint backend |
|---|---|---|---|
| Panel | `src/js/app.js` → `mod-panel` | Todos | `/api/chat?module=panel` |
| Entrenamiento | `src/js/app.js` → `mod-entrena` | `training.json` | `/api/chat?module=entrena` |
| Nutrición | `src/js/app.js` → `mod-nutri` | `nutrition.json` | `/api/chat`, `/api/scan-ticket`, `/api/recipes` |
| Mindset | `src/js/app.js` → `mod-mindset` | `mindset.json` | `/api/chat?module=mindset` |
| Ingenio | `src/js/app.js` → `mod-ingenio` | `economy.json` | `/api/chat?module=ingenio` |

## Por qué el chat es consciente del módulo activo

Cuando el usuario habla con el asistente, el cliente envía:

```json
{
  "messages": [...historial],
  "module": "nutri",
  "profile": { ...perfil del usuario },
  "moduleData": { "pantry": [...], "nutritionLog": [...] }
}
```

El servidor construye un prompt de sistema distinto según el módulo — incluyendo el JSON de conocimiento relevante y los datos actuales del usuario (despensa, bitácora, diario). La IA no responde desde conocimiento genérico: responde desde el contexto específico del módulo y del perfil.

## Flujo de seguridad de la API key

```
Usuario → cliente JS → POST /api/chat → server.js → OpenAI API
                                          ↑
                                    OPENAI_API_KEY
                                    (solo en servidor,
                                    nunca en cliente)
```

## Base de conocimiento

Los archivos JSON en `src/data/knowledge/` se cargan **al arrancar el servidor** con `readFileSync`. No hay consultas a base de datos — son simplemente objetos JavaScript en memoria. Si se edita un JSON, hay que reiniciar el servidor con `Ctrl+C` + `npm start`.

## Decisiones pendientes (no tomadas aún)

- Framework de frontend (hoy: vanilla JS)
- Base de datos real para multi-usuario (hoy: localStorage por usuario, sin cuenta)
- Autenticación de usuarios
- Plataforma de despliegue (Railway, Render, Fly.io son buenas opciones gratuitas para Express)
- Módulo de Casos Especiales (rehabilitación/adultos mayores) — requiere validación profesional antes de implementar
