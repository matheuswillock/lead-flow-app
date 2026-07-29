#!/usr/bin/env bash
# =============================================================================
# deploy/vps-bootstrap.sh — Bootstrap VPS Hostinger (Evolution + N8N + Caddy)
# =============================================================================
#
# Execute na VPS como root (primeira vez) ou como usuário com sudo:
#   curl -fsSL ... | bash   OU   bash deploy/vps-bootstrap.sh
#
# Pré-requisitos:
#   - Ubuntu 24.04 com Docker (template Hostinger)
#   - DNS: evo.corretorstudio.com e n8n.corretorstudio.com → IP desta VPS
#   - Arquivos .env.evolution, .env.n8n e .env.ops preenchidos em DEPLOY_DIR
#
# =============================================================================

set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/lead-flow-bot}"
REPO_DIR="${REPO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"
EVO_DOMAIN="${EVO_DOMAIN:-evo.corretorstudio.com}"
N8N_DOMAIN="${N8N_DOMAIN:-n8n.corretorstudio.com}"
SKIP_CADDY="${SKIP_CADDY:-0}"
SKIP_HARDENING="${SKIP_HARDENING:-0}"

log() { echo "[vps-bootstrap] $*"; }
die() { echo "[vps-bootstrap] ERRO: $*" >&2; exit 1; }

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    die "Execute como root ou com sudo: sudo bash deploy/vps-bootstrap.sh"
  fi
}

install_caddy() {
  if [[ "${SKIP_CADDY}" == "1" ]]; then
    log "SKIP_CADDY=1 — pulando instalação do Caddy"
    return
  fi

  if command -v caddy >/dev/null 2>&1; then
    log "Caddy já instalado"
  else
    log "Instalando Caddy..."
    apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
    apt-get update
    apt-get install -y caddy
  fi

  local caddy_src="${REPO_DIR}/deploy/hostinger/Caddyfile"
  [[ -f "${caddy_src}" ]] || die "Caddyfile não encontrado: ${caddy_src}"

  cp "${caddy_src}" /etc/caddy/Caddyfile
  systemctl enable caddy
  systemctl reload caddy || systemctl restart caddy
  log "Caddy configurado para ${EVO_DOMAIN} e ${N8N_DOMAIN}"
}

setup_firewall() {
  if [[ "${SKIP_HARDENING}" == "1" ]]; then
    log "SKIP_HARDENING=1 — pulando UFW"
    return
  fi

  if command -v ufw >/dev/null 2>&1; then
    ufw allow OpenSSH || true
    ufw allow 80/tcp || true
    ufw allow 443/tcp || true
    ufw --force enable || true
    log "UFW: portas 22, 80, 443 abertas"
  fi
}

setup_deploy_user() {
  if [[ "${SKIP_HARDENING}" == "1" ]]; then
    return
  fi

  if id "${DEPLOY_USER}" &>/dev/null; then
    log "Usuário ${DEPLOY_USER} já existe"
  else
    log "Criando usuário ${DEPLOY_USER}..."
    adduser --disabled-password --gecos "" "${DEPLOY_USER}"
  fi

  usermod -aG docker "${DEPLOY_USER}" || true

  if [[ -d /root/.ssh ]] && [[ -f /root/.ssh/authorized_keys ]]; then
    mkdir -p "/home/${DEPLOY_USER}/.ssh"
    cp /root/.ssh/authorized_keys "/home/${DEPLOY_USER}/.ssh/" 2>/dev/null || true
    chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "/home/${DEPLOY_USER}/.ssh"
    chmod 700 "/home/${DEPLOY_USER}/.ssh"
    chmod 600 "/home/${DEPLOY_USER}/.ssh/authorized_keys" 2>/dev/null || true
  fi
}

sync_deploy_dir() {
  mkdir -p "${DEPLOY_DIR}"
  log "Sincronizando arquivos para ${DEPLOY_DIR}..."

  cp "${REPO_DIR}/docker-compose.vps.yml" "${DEPLOY_DIR}/"
  cp -a "${REPO_DIR}/n8n" "${DEPLOY_DIR}/"
  cp -a "${REPO_DIR}/scripts/n8n-import-all-workflows.ts" "${DEPLOY_DIR}/scripts/" 2>/dev/null || mkdir -p "${DEPLOY_DIR}/scripts" && cp "${REPO_DIR}/scripts/n8n-import-all-workflows.ts" "${DEPLOY_DIR}/scripts/"

  if [[ ! -f "${DEPLOY_DIR}/.env.evolution" ]]; then
    if [[ -f "${REPO_DIR}/deploy/hostinger/.env.evolution.production.example" ]]; then
      cp "${REPO_DIR}/deploy/hostinger/.env.evolution.production.example" "${DEPLOY_DIR}/.env.evolution"
      log "Criado ${DEPLOY_DIR}/.env.evolution — PREENCHA antes de subir os containers"
    else
      die "Arquivo .env.evolution ausente em ${DEPLOY_DIR}"
    fi
  fi

  if [[ ! -f "${DEPLOY_DIR}/.env.n8n" ]]; then
    if [[ -f "${REPO_DIR}/deploy/hostinger/.env.n8n.production.example" ]]; then
      cp "${REPO_DIR}/deploy/hostinger/.env.n8n.production.example" "${DEPLOY_DIR}/.env.n8n"
      log "Criado ${DEPLOY_DIR}/.env.n8n — PREENCHA antes de subir os containers"
    else
      die "Arquivo .env.n8n ausente em ${DEPLOY_DIR}"
    fi
  fi

  if [[ ! -f "${DEPLOY_DIR}/.env.ops" ]]; then
    if [[ -f "${REPO_DIR}/deploy/hostinger/.env.ops.example" ]]; then
      cp "${REPO_DIR}/deploy/hostinger/.env.ops.example" "${DEPLOY_DIR}/.env.ops"
      log "Criado ${DEPLOY_DIR}/.env.ops — PREENCHA OPS_AGENT_TOKEN e BACKUP_DATABASE_URL"
    else
      log "AVISO: deploy/hostinger/.env.ops.example ausente — crie ${DEPLOY_DIR}/.env.ops manualmente"
    fi
  fi

  mkdir -p "${DEPLOY_DIR}/deploy/hostinger"
  cp -a "${REPO_DIR}/deploy/hostinger/studio-bot-ops" "${DEPLOY_DIR}/deploy/hostinger/" 2>/dev/null || true
  cp "${REPO_DIR}/deploy/hostinger/backup-supabase.sh" "${DEPLOY_DIR}/deploy/hostinger/" 2>/dev/null || true
  cp "${REPO_DIR}/deploy/hostinger/.env.ops.example" "${DEPLOY_DIR}/deploy/hostinger/" 2>/dev/null || true

  chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${DEPLOY_DIR}" 2>/dev/null || true
}

check_env_placeholders() {
  if grep -q 'SUBSTITUA_\|\[PASSWORD\]' "${DEPLOY_DIR}/.env.evolution" 2>/dev/null; then
    die "Edite ${DEPLOY_DIR}/.env.evolution — ainda há placeholders SUBSTITUA_ ou [PASSWORD]"
  fi
  if grep -q 'SUBSTITUA_\|5511XXXXXXXXX' "${DEPLOY_DIR}/.env.n8n" 2>/dev/null; then
    die "Edite ${DEPLOY_DIR}/.env.n8n — ainda há placeholders SUBSTITUA_ ou número de telefone"
  fi
}

start_stacks() {
  log "Subindo containers (docker-compose.vps.yml)..."
  cd "${DEPLOY_DIR}"

  # N8N_POSTGRES_PASSWORD é lido pelo compose a partir do shell — exportar de .env.n8n
  set -a
  # shellcheck disable=SC1091
  source .env.n8n
  set +a

  docker compose -f docker-compose.vps.yml --env-file .env.evolution --env-file .env.n8n up -d

  log "Aguardando healthchecks..."
  sleep 15
  docker compose -f docker-compose.vps.yml ps
}

verify_endpoints() {
  log "Verificando endpoints..."
  curl -sfI "https://${EVO_DOMAIN}" >/dev/null && log "OK: https://${EVO_DOMAIN}" || log "AVISO: https://${EVO_DOMAIN} ainda não responde (DNS/SSL?)"
  curl -sfI "https://${N8N_DOMAIN}/healthz" >/dev/null && log "OK: https://${N8N_DOMAIN}/healthz" || log "AVISO: https://${N8N_DOMAIN} ainda não responde"
}

print_next_steps() {
  cat <<EOF

=============================================================================
Bootstrap concluído. Próximos passos manuais:
=============================================================================

1. Evolution Manager: https://${EVO_DOMAIN}/manager
   - Criar instância "bethania"
   - Escanear QR Code WhatsApp
   - Webhook da instância: http://n8n:5678/webhook/bethania-inbound

2. N8N UI: https://${N8N_DOMAIN}
   - Criar usuário admin (primeiro acesso)
   - Importar workflows: cd ${DEPLOY_DIR} && bun run n8n:import:all
   - Ativar workflow "bethania-router"

3. Vercel — copie variáveis de deploy/hostinger/vercel-env.production.example

4. hPanel → Snapshots — ativar backup automático da VPS

5. Guarde N8N_ENCRYPTION_KEY em local seguro (gerenciador de senhas)

=============================================================================
EOF
}

main() {
  require_root
  log "Iniciando bootstrap (DEPLOY_DIR=${DEPLOY_DIR})"

  apt-get update
  apt-get upgrade -y

  setup_firewall
  setup_deploy_user
  install_caddy
  sync_deploy_dir
  check_env_placeholders
  start_stacks
  verify_endpoints
  print_next_steps
}

main "$@"
