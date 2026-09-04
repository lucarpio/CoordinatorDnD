# 🎲 CoordinatorDnD

Aplicación web ligera, moderna y sin fricción (Zero Login) para coordinar sesiones mensuales de Dungeons & Dragons con quórum estricto (100%) y sincronización en tiempo real con Supabase.

---

## 🚀 Características Clave

1. **Zero Login / Cero Fricción**:
   - Acceso instantáneo mediante enlace único (`/m/[slug]`).
   - Cada jugador simplemente selecciona su nombre de un menú desplegable superior para marcar su disponibilidad.
   - Su selección se recuerda automáticamente en `localStorage`.

2. **Horario Fijo (8:30 PM)**:
   - Todas las sesiones son a las 8:30 PM (20:30) por defecto.

3. **Quórum Estricto (100%)**:
   - Una fecha solo se considera confirmada si **todos los participantes** registrados han marcado disponibilidad.
   - Cuando se alcanza el 100%, la celda se ilumina en verde esmeralda con una insignia destacada `★ Total/Total` y una animación de confeti.

4. **Sincronización en Tiempo Real**:
   - Votos sincronizados en vivo usando Supabase Realtime (vía canal Postgres Changes).

5. **Exportación y Compartición**:
   - **WhatsApp**: Copia un resumen formateado con emojis (🎲, ⚔️, 📅) listo para enviar al grupo.
   - **Google Calendar**: Enlace directo con horario de 8:30 PM a 11:59 PM.
   - **Descarga `.ics`**: Archivo compatible con Apple Calendar y Outlook.

---

## 🛠️ Configuración de Supabase

### 1. Ejecutar el Script SQL
Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard) -> **SQL Editor** y ejecuta el contenido del archivo:
[`supabase/schema.sql`](supabase/schema.sql)

Este script:
- Crea la tabla `polls` con la columna `availability` en formato `jsonb`.
- Configura las políticas RLS públicas para lectura, inserción y actualización sin login.
- Agrega la tabla `polls` a la publicación `supabase_realtime`.

### 2. Variables de Entorno
Crea un archivo `.env.local` en la raíz del proyecto (basado en `.env.example`):

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-aqui
```

---

## 💻 Desarrollo Local

Instalar dependencias:
```bash
npm install
```

Iniciar servidor de desarrollo:
```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.
