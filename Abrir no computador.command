#!/bin/bash
# Dê dois cliques neste arquivo para abrir o Acabou! no navegador.
# Para fechar o app, feche esta janela do Terminal.
cd "$(dirname "$0")"
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
if [ ! -d node_modules ]; then
  echo "Preparando o app pela primeira vez (pode levar 1 minuto)..."
  npm install
fi
echo ""
echo "  O app vai abrir no navegador."
echo "  Para jogar no iPad (mesmo Wi-Fi), abra no Safari o endereço 'Network' abaixo."
echo "  NÃO feche esta janela enquanto estiver jogando."
echo ""
npx vite --host --open
