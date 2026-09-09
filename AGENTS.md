# 🎲 Directivas de Desarrollo para Agentes de IA (CoordinatorDnD)

Este documento define las reglas operativas, flujo de trabajo con Git, convenciones de arquitectura y estándares de rendimiento obligatorios para cualquier agente de IA que opere en este repositorio.

---

## 1. 📋 Reglas Globales de Interacción
- **Explicación previa obligatoria:** Antes de ejecutar cualquier comando en la terminal, proporciona una explicación breve y clara de qué va a hacer el comando y por qué es necesario.
- **Idioma:** Responder e interactuar preferentemente en español.

---

## 2. 🌿 Flujo de Trabajo Git y Despliegues (Obligatorio)
1. **Ramas de Trabajo:** Todo nuevo desarrollo, corrección (fix) o funcionalidad (feature) debe trabajarse en una rama nueva (`feat/...`, `fix/...`, `docs/...`). Nunca commitear directamente sobre `preview` ni sobre `main`.
2. **Build Local Previo:** Ejecutar siempre `npm run build` localmente y verificar que termine con 0 errores antes de hacer commit.
3. **Commit y Push:** Commitear con mensajes descriptivos siguiendo el estándar *Conventional Commits* (`feat:`, `fix:`, `perf:`, `refactor:`, `docs:`) y pushear la rama a GitHub.
4. **Pull Request a `preview`:** Una vez terminados y validados los cambios, crear el Pull Request hacia la rama de staging `preview`.
5. **Pase a Producción (`main`):** Solo tras validar y probar en el entorno de staging (`preview`), se genera el PR de `preview` hacia `main`. Usar siempre la opción **"Create a merge commit"** para preservar la sincronización del árbol de Git.

---

## 3. ⚡ Rendimiento Gráfico y Móvil (Estrictas)
- **Prohibido `filter: blur(100px+)`:** NUNCA usar filtros de desenfoque masivo (`blur-[100px..150px]`) en orbes o fondos de página. En pantallas móviles de alta densidad (Retina, 3x), obligan a la GPU a calcular convoluciones gaussianas de cientos de píxeles, provocando sobrecalentamiento extremo del dispositivo, *thermal throttling* y congelamiento de pantalla en negro.
- **Usar `radial-gradient`:** Todo efecto de luz ambiental difusa debe construirse con gradientes radiales matemáticos puros (`radial-gradient(circle, ...)`) con costo 0 de GPU.
- **Evitar dobles `backdrop-filter` anidados:** En móviles (`max-width: 640px`), los controles de formulario e inputs situados dentro de contenedores `.liquid-glass` deben tener `backdrop-filter: none` para no saturar el pipeline gráfico de la GPU móvil.
- **Aceleración por capas:** Utilizar `transform: translateZ(0)` en tarjetas con desenfoque para aislar su composición.

---

## 4. ⚛️ Buenas Prácticas de React y Ciclo de Vida
- **Limpieza de Temporizadores:** Todo `setTimeout` o `setInterval` debe almacenar su referencia en un `useRef` y limpiarse obligatoriamente en el retorno de un `useEffect` (`clearTimeout`). Limpiar también el temporizador previo antes de iniciar uno nuevo.
- **Regla de Oro de Hooks:** NUNCA invocar hooks después de un `if (...) return null;`. Todos los hooks (`useState`, `useEffect`, `useRef`, `useMemo`, `useCallback`) deben declararse al inicio del componente.
- **Stale Closures y Listeners:** Toda función pasada a listeners de eventos (ej. `keydown`, `click`) debe memorizarse con `useCallback` con sus dependencias explícitas o sincronizarse mediante `useRef`. Retornar siempre `removeEventListener`.
- **Keys Semánticas Únicas:** Prohibido usar `key={idx}` en listas dinámicas (`.map`). Usar siempre identificadores semánticos únicos y estables (`key={item.id}`, `key={name}`, `key={slug}`).
- **Almacenamiento Seguro (WebViews y Privacidad):** Todo acceso a `localStorage` o `sessionStorage` debe estar envuelto en un bloque defensivo `try { ... } catch { ... }` para no romper en navegadores restringidos (navegador interno de WhatsApp, Safari en navegación privada estricta).
- **Hidratación Limpia:** Componentes que leen del navegador o de storage de cliente deben usar una bandera `isMounted` antes de renderizar diferencias visuales para evitar advertencias de desajuste de hidratación (SSR mismatch).

---

## 5. 🌐 Arquitectura y Multiidioma (i18n)
- **Diccionarios Centralizados:** Todos los textos de la interfaz deben residir en `/locales/es.json` y `/locales/en.json`.
- **Sincronización:** Toda nueva clave agregada a `es.json` debe agregarse obligatoriamente a `en.json`.
- **Uso de `useMemo` con traducciones:** Constantes o arrays que contengan textos traducidos (`t(...)`) deben memorizarse con `useMemo(() => ..., [t])` para preservar la reactividad al alternar el idioma.
- **Streaming UI:** Mantener siempre `app/loading.tsx` activo en Next.js App Router para evitar pantallas negras durante arranques en frío (*cold starts*) de Supabase o conexiones móviles lentas.
