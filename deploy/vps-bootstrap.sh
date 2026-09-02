#!/usr/bin/env bash
# =============================================================================
# deploy/vps-bootstrap.sh — Bootstrap VPS Hostinger (OpenWA + Caddy)
# =============================================================================
#
# Execute na VPS como root (primeira vez) ou como usuário com sudo:
#   curl -fsSL ... | bash   OU   bash deploy/vps-bootstrap.sh
#
# Pré-requisitos:
#   - Ubuntu 24.04 com Docker (template Hostinger)
#   - DNS: ops.corretorstudio.com → IP desta VPS
#   - Arquivos .env.openwa e .env.ops preenchidos em DEPLOY_DIR
#
# =============================================================================

set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/lead-flow-bot}"
REPO_DIR="${REPO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"
OPS_DOMAIN="${OPS_DOMAIN:-ops.corretorstudio.com}"
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
  log "Caddy configurado para ${OPS_DOMAIN}"
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
  mkdir -p "${DEPLOY_DIR}/deploy"
  cp -a "${REPO_DIR}/deploy/openwa-gateway" "${DEPLOY_DIR}/deploy/"

  if [[ ! -f "${DEPLOY_DIR}/.env.openwa" ]]; then
    if [[ -f "${REPO_DIR}/.env.openwa.example" ]]; then
      cp "${REPO_DIR}/.env.openwa.example" "${DEPLOY_DIR}/.env.openwa"
      log "Criado ${DEPLOY_DIR}/.env.openwa — PREENCHA antes de subir os containers"
    else
      die "Arquivo .env.openwa ausente em ${DEPLOY_DIR}"
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
  cp "${REPO_DIR}/deploy/hostinger/.env.ops.example" "${DEPLOY_DIR}/deploy/hostinger/" 2>/dev/null || true

  chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${DEPLOY_DIR}" 2>/dev/null || true
}

check_env_placeholders() {
  if grep -q 'change-me\|your-project\.supabase\.co\|jwt-scoped-openwa_storage-role' "${DEPLOY_DIR}/.env.openwa" 2>/dev/null; then
    die "Edite ${DEPLOY_DIR}/.env.openwa — ainda há placeholders change-me / your-project"
  fi
}

start_stacks() {
  log "Subindo containers (docker-compose.vps.yml)..."
  cd "${DEPLOY_DIR}"

  # --remove-orphans: derruba containers de serviços que saíram do compose
  # (n8n/Evolution em VPS provisionada antes da migração OpenWA).
  docker compose -f docker-compose.vps.yml --env-file .env.openwa up -d --remove-orphans

  log "Aguardando healthchecks..."
  sleep 15
  docker compose -f docker-compose.vps.yml ps
}

verify_endpoints() {
  log "Verificando endpoints..."
  curl -sfI "https://${OPS_DOMAIN}/healthz" >/dev/null && log "OK: https://${OPS_DOMAIN}/healthz" || log "AVISO: https://${OPS_DOMAIN} ainda não responde (DNS/SSL?)"
}

print_next_steps() {
  cat <<EOF

=============================================================================
Bootstrap concluído. Próximos passos manuais:
=============================================================================

1. Agente Ops: https://${OPS_DOMAIN}/healthz
   - Confirme OPS_AGENT_TOKEN preenchido em ${DEPLOY_DIR}/.env.ops

2. OpenWA Gateway — sessão por time é criada pela aplicação
   (POST /session/:instance com webhookUrl); não há UI para escanear QR aqui.

3. Vercel — copie variáveis de deploy/hostinger/vercel-env.production.example

4. hPanel → Snapshots — ativar backup automático da VPS

5. Guarde OPENWA_API_KEY e OPENWA_WEBHOOK_SECRET em local seguro
   (gerenciador de senhas) — o webhook secret precisa bater com o da Vercel

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
