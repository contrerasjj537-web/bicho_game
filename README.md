# El Bichito y las Plantas

Juego educativo. Todo se despliega con un solo comando:

    ./deploy.sh "qué cambié"        (Windows: doble clic en deploy.bat)

## Estructura
- `public/`            → el juego (index.html + img/), lo que ve el estudiante
- `netlify/functions/` → la API (`/api`), se despliega junto con el juego
- `firestore.rules`    → reglas de la base de datos (bloquea todo acceso desde el navegador)
- `legacy-php/`        → versión anterior en PHP/MySQL (ya no se usa; puedes borrarla)
- `test/`              → pruebas de la API: `npm install && npm test`

## Configurar el backend (una sola vez)

1. **Firebase** (https://console.firebase.google.com): crea un proyecto → *Build → Firestore Database → Crear base de datos*
   (modo producción; elige la región más cercana). No necesitas activar facturación.
2. En Firestore → pestaña **Reglas**: pega el contenido de `firestore.rules` y publica.
3. *Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada*. Se descarga un `.json`
   (**no lo subas a Git**, no lo compartas).
4. **Netlify** → Site configuration → Environment variables → agrega 4 variables:

   | Variable | Valor |
   |---|---|
   | `FIREBASE_PROJECT_ID` | `project_id` del .json |
   | `FIREBASE_CLIENT_EMAIL` | `client_email` del .json |
   | `FIREBASE_PRIVATE_KEY` | `private_key` del .json (completa, con los `\n`) |
   | `SECRETO` | una frase larga inventada por ti (protege la sesión del maestro) |

5. Haz un nuevo despliegue (`./deploy.sh` o *Trigger deploy* en Netlify).
6. Abre el juego → botón ⚙ (o `/#admin`) → PIN inicial **1234** → cámbialo de inmediato en Ajustes.

La primera vez, la base de datos está vacía y el juego usa los 5 niveles y 15 preguntas de fábrica;
en cuanto el maestro guarde algún cambio en el panel, se guardan en Firestore.

## Notas
- Plan gratuito de Firebase (Spark): 50 000 lecturas y 20 000 escrituras al día. Sobra para un salón de clase.
- Si algo falla, mira Netlify → Logs → Functions.
