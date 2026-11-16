# Cazaclientes

Herramienta interna para encontrar locales sin presencia online, armar el mensaje justo según el rubro y llevar el seguimiento de cada contacto.

## Qué hace

1. **Busca locales gratis, sin clave ni tarjeta:**
   - Botones que abren Google Maps con cada rubro de la ciudad. Lo que ves ahí (si aparece, si tiene web o solo redes, reseñas, fotos, horarios) lo cargás con "Cargar un local que vi en Maps" y la app le pone puntaje.
   - Búsqueda automática en OpenStreetMap. En cada resultado, "Anotar lo que vi" ajusta el puntaje con lo que viste en Maps.
   - Opcional y pago: la API de Google Places (elegí "OpenStreetMap + API de Google" en Fuente). Necesita la clave en Vercel; ver más abajo.
2. **Les pone un puntaje de oportunidad** (0 a 100) según qué les falta:
   - no aparecen en Google Maps;
   - no tienen web, o solo usan Instagram, Facebook, PedidosYa o Booking;
   - tienen pocas reseñas, no tienen fotos o no tienen horarios.

   Un local con muchas reseñas y sin web suma extra: tiene clientes y le falta la página.
3. **Arma los mensajes según el rubro y lo que le falta**: WhatsApp (se abre con el texto listo), mail (asunto y cuerpo) y un guion para la visita en persona, con respuestas a las objeciones típicas. No incluye precios. Siempre lleva una línea para que el local pueda pedir que no le escribas más.
4. **Seguimiento**: estado de cada local (por contactar, contactado, respondió, demo enviada, cliente, no interesado), fecha para volver a escribir, notas, historial y un resumen con la tasa de cierre. Se descarga en Excel (CSV) y se puede hacer copia de seguridad.
5. **Pegar local de Maps**: en Google Maps tocás Compartir → Copiar y lo pegás. Completa nombre, dirección, enlace y ciudad, y busca teléfono y web en OpenStreetMap (`api/maps-link.js` abre los enlaces cortos de Maps).
6. **Ventas** (ideas de Sellbird, en español y con WhatsApp):
   - Bandeja del día con secuencia de 3 mensajes (primero, recordatorio y último aviso). Si el local responde o pide la baja, se corta.
   - Chequeo antes de enviar: contacto válido, frase de baja, largo, datos vacíos, máximo diario y horario.
   - Revisar la web del local (`api/revisar.js`): si no se adapta al celular, carta en PDF, sin reservas, web vieja, sin WhatsApp, quién la hizo, y mails de contacto con verificación del dominio. El mensaje usa lo que encontró.
   - Respuestas sugeridas: pegás lo que contestó y detecta si pidió la baja, pregunta el precio, le interesa, más adelante, ya tiene quien se lo haga o es automática.
   - Puente con Sellbird para campañas de mail desde la PC: exporta los locales, `sellbird_puente.py` los carga en Sellbird y después se importa su `prospects.csv`.
7. **Nube**: con una clave, los mismos datos en el celular, la PC y cualquier equipo (`api/datos.js`, Upstash Redis de Vercel). Funciona sin conexión y sube los cambios al volver.

## Activar la nube (una sola vez)

1. En vercel.com, entrá al proyecto → pestaña **Storage** → **Create Database** → **Upstash for Redis** (plan gratis) → conectalo a este proyecto sin cambiar el prefijo de las variables.
2. En **Settings → Environment Variables** agregá `CC_CLAVE` con una clave larga que elijas vos.
3. **Deployments → Redeploy**.
4. En Cazaclientes → **Ajustes → Clave de la nube**, poné la misma clave en cada equipo.

## Publicarlo en Vercel

1. Subí esta carpeta a un repositorio nuevo de GitHub, con la carpeta `api` incluida.
2. En vercel.com: **Add New → Project**, elegí el repositorio y tocá **Deploy**.
3. En el proyecto de Vercel, entrá a **Settings → Environment Variables** y agregá:
   - `GOOGLE_PLACES_KEY`: tu clave de Google (ver abajo).
   - `ACCESS_CODE`: un código que inventes. Protege tu clave para que nadie más gaste tu cupo.
4. Volvé a desplegar (**Deployments → Redeploy**) y en la app, en **Ajustes**, escribí el mismo código de acceso.

Sin la clave de Google, la app funciona igual pero busca solo en OpenStreetMap. Si abrís `index.html` directo desde la computadora, también funciona solo con OpenStreetMap.

## Clave de Google Places

1. Entrá a console.cloud.google.com y creá un proyecto. Hay que cargar una tarjeta para activar la facturación, aunque el uso normal entra en el cupo gratis.
2. Activá **Places API (New)**.
3. En **Credenciales**, creá una clave de API y restringila a "Places API (New)".
4. **Importante:** en **Cuotas**, limitá "Text Search" a unas 30 consultas por día. Así nunca pasás el cupo gratis y no te cobran nada.

Cupo gratis: la búsqueda pide teléfono, web y reseñas, que en Google es la categoría "Enterprise". Tiene **1.000 consultas gratis por mes**, y cada término de búsqueda cuenta como una. Una búsqueda de un rubro usa entre 5 y 6 consultas, y una búsqueda puntual usa 1. La app te muestra cuántas llevás en el mes.

## Reglas que respeta

- **Google:** sus condiciones no permiten guardar sus datos por mucho tiempo. La app guarda el identificador del local y borra el teléfono, la web y las reseñas de Google a los 30 días. Lo que anotás vos (teléfono, mail, notas) queda guardado.
- **OpenStreetMap:** los datos se pueden guardar citando la fuente, que figura al pie.
- **Mensajes:** de a uno, nunca envíos masivos. WhatsApp bloquea los números que mandan mensajes en masa. Cada mensaje dice quién sos y cómo pedir que no le escribas más (Ley 25.326 de datos personales).

## Ajustar textos y rubros

En `index.html`, el objeto `RUBROS` tiene, para cada rubro, qué buscar en Google y en OpenStreetMap, qué ofrecer y el beneficio principal. Los mensajes se arman en las funciones `hallazgo()` y `mensajes()`.
