#!/usr/bin/env bash
# Uso:  ./deploy.sh                      -> commit automático con fecha y hora
#       ./deploy.sh "agregué nivel 4"    -> commit con tu mensaje
set -euo pipefail
cd "$(dirname "$0")"

RAMA="main"

command -v git >/dev/null 2>&1 || { echo "❌ Git no está instalado: https://git-scm.com/downloads"; exit 1; }

# 1) Inicializar repositorio si hace falta
if [ ! -d .git ]; then
  echo "📁 Inicializando repositorio…"
  git init -b "$RAMA"
fi

# 2) Configurar el remoto (solo la primera vez)
if ! git remote get-url origin >/dev/null 2>&1; then
  echo "🔗 Aún no hay repositorio remoto."
  echo "   Crea uno VACÍO en GitHub y pega aquí su URL (ej: https://github.com/usuario/bichito.git)"
  read -r -p "URL: " URL
  [ -n "$URL" ] || { echo "❌ URL vacía."; exit 1; }
  git remote add origin "$URL"
fi

# 3) Preparar cambios
git add -A

# 4) Seguridad: nunca subir claves privadas ni contraseñas
if git diff --cached | grep -qE "BEGIN (RSA |EC )?PRIVATE KEY|\"private_key\"|DB_PASS *= *'[^']+'"; then
  echo "❌ Se detectó una clave privada o contraseña en los cambios. Cancelo para protegerte."
  echo "   Quita ese archivo (o su contenido) y vuelve a ejecutar."
  git reset -q
  exit 1
fi

# 5) Commit
if git diff --cached --quiet; then
  echo "ℹ️  No hay cambios nuevos que guardar."
else
  MSG="${1:-Actualización $(date '+%Y-%m-%d %H:%M')}"
  git commit -m "$MSG"
fi

# 6) Push (Netlify despliega solo al detectar el push)
git push -u origin "$(git branch --show-current)"

echo ""
echo "✅ Listo. Netlify publicará la nueva versión en 1–2 minutos."
