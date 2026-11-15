# Cazaclientes

Herramienta interna para encontrar locales sin presencia online, armar el mensaje justo según el rubro y llevar el seguimiento de cada contacto.

## Qué hace

1. **Busca locales** de una ciudad y un rubro en Google Places y en OpenStreetMap, y une los resultados.
2. **Les pone un puntaje de oportunidad** (0 a 100) según qué les falta:
   - no aparecen en Google Maps;
   - no tienen web, o solo usan Instagram, Facebook, PedidosYa o Booking;
   - tienen pocas reseñas, no tienen fotos o no tienen horarios.

   Un local con muchas reseñas y sin web suma extra: tiene clientes y le falta la página.
3. **Arma los mensajes según el rubro y lo que le falta**: WhatsApp (se abre con el texto listo), mail (asunto y cuerpo) y un guion para la visita en persona, con respuestas a las objeciones típicas. No incluye precios. Siempre lleva una línea para que el local pueda pedir que no le escribas más.
4. **Seguimiento**: estado de cada local (por contactar, contactado, respondió, demo enviada, cliente, no interesado), fecha para volver a escribir, notas, historial y un resumen con la tasa de cierre. Se descarga en Excel (CSV) y se puede hacer copia de seguridad.

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
