#!/usr/bin/env bash
# =============================================================================
# deploy/hostinger/bootstrap-github-runner.sh
# Instala um GitHub Actions self-hosted runner (1 job) na VPS Hostinger.
# =============================================================================
#
# Uso (na VPS, como root):
#   export RUNNER_TOKEN="<registration token do GitHub>"
#   # Opcional:
#   # export RUNNER_REPO_URL="https://github.com/matheuswillock/lead-flow-app"
#   # export RUNNER_NAME="lead-flow-vps-1"
#   # export RUNNER_LABELS="self-hosted,linux,x64,lead-flow-ci"
#   # export NODE_OPTIONS="--max-old-space-size=3072"
#   bash deploy/hostinger/bootstrap-github-runner.sh
#
# Gerar token (local, com gh autenticado):
#   gh api -X POST repos/matheuswillock/lead-flow-app/actions/runners/registration-token --jq .token
#
# O runner NÃO entra no grupo docker e NÃO recebe acesso a /opt/lead-flow-bot/.env*
# =============================================================================

set -euo pipefail

RUNNER_USER="${RUNNER_USER:-github-runner}"
RUNNER_HOME="${RUNNER_HOME:-/home/${RUNNER_USER}}"
RUNNER_DIR="${RUNNER_DIR:-${RUNNER_HOME}/actions-runner}"
RUNNER_WORKDIR="${RUNNER_WORKDIR:-${RUNNER_HOME}/_work}"
RUNNER_REPO_URL="${RUNNER_REPO_URL:-https://github.com/matheuswillock/lead-flow-app}"
RUNNER_NAME="${RUNNER_NAME:-lead-flow-vps-1}"
RUNNER_LABELS="${RUNNER_LABELS:-self-hosted,linux,x64,lead-flow-ci}"
RUNNER_VERSION="${RUNNER_VERSION:-2.329.0}"
NODE_OPTIONS_DEFAULT="${NODE_OPTIONS:---max-old-space-size=3072}"
BUN_INSTALL_VERSION="${BUN_INSTALL_VERSION:-1.3.14}"

log() { echo "[github-runner-bootstrap] $*"; }
die() { echo "[github-runner-bootstrap] ERRO: $*" >&2; exit 1; }

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    die "Execute como root: sudo bash deploy/hostinger/bootstrap-github-runner.sh"
  fi
}

require_token() {
  if [[ -z "${RUNNER_TOKEN:-}" ]]; then
    die "Defina RUNNER_TOKEN (registration token do GitHub Actions)."
  fi
}

install_host_deps() {
  log "Instalando dependências de build (git, curl, ca-certificates, build-essential)..."
  apt-get update -y
  DEBIAN_FRONTEND=noninteractive apt-get install -y \
    git curl ca-certificates tar jq build-essential \
    libicu-dev libssl-dev

  if ! command -v bun >/dev/null 2>&1; then
    log "Instalando Bun ${BUN_INSTALL_VERSION} em /usr/local..."
    curl -fsSL "https://bun.sh/install" | BUN_INSTALL=/usr/local bash -s "bun-v${BUN_INSTALL_VERSION}"
  else
    log "Bun já presente: $(bun --version)"
  fi

  if ! command -v node >/dev/null 2>&1; then
    log "Instalando Node.js 24.x..."
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
    DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
  else
    log "Node já presente: $(node --version)"
  fi
}

create_runner_user() {
  if id -u "${RUNNER_USER}" >/dev/null 2>&1; then
    log "Usuário ${RUNNER_USER} já existe"
  else
    log "Criando usuário ${RUNNER_USER} (sem docker group)..."
    useradd --create-home --shell /bin/bash "${RUNNER_USER}"
  fi

  mkdir -p "${RUNNER_DIR}" "${RUNNER_WORKDIR}"
  chown -R "${RUNNER_USER}:${RUNNER_USER}" "${RUNNER_HOME}"

  # Hardening leve: sem leitura dos envs de produção Bethânia
  if [[ -d /opt/lead-flow-bot ]]; then
    chmod o-rwx /opt/lead-flow-bot 2>/dev/null || true
  fi
}

download_runner() {
  local arch tarball url
  arch="$(uname -m)"
  case "${arch}" in
    x86_64) tarball="actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz" ;;
    aarch64|arm64) tarball="actions-runner-linux-arm64-${RUNNER_VERSION}.tar.gz" ;;
    *) die "Arquitetura não suportada: ${arch}" ;;
  esac

  url="https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${tarball}"

  if [[ -x "${RUNNER_DIR}/run.sh" ]]; then
    log "Runner já extraído em ${RUNNER_DIR}"
    return
  fi

  log "Baixando ${tarball}..."
  sudo -u "${RUNNER_USER}" bash -c "
    set -euo pipefail
    cd '${RUNNER_DIR}'
    curl -fsSL -o '${tarball}' '${url}'
    tar xzf '${tarball}'
    rm -f '${tarball}'
  "
}

configure_runner() {
  if [[ -f "${RUNNER_DIR}/.runner" ]]; then
    log "Runner já configurado (.runner presente) — pulando ./config.sh"
    return
  fi

  log "Registrando runner ${RUNNER_NAME} em ${RUNNER_REPO_URL}..."
  sudo -u "${RUNNER_USER}" bash -c "
    set -euo pipefail
    cd '${RUNNER_DIR}'
    ./config.sh --unattended \
      --url '${RUNNER_REPO_URL}' \
      --token '${RUNNER_TOKEN}' \
      --name '${RUNNER_NAME}' \
      --labels '${RUNNER_LABELS}' \
      --work '${RUNNER_WORKDIR}' \
      --replace
  "
}

install_systemd_service() {
  log "Instalando serviço systemd do runner..."
  cd "${RUNNER_DIR}"

  if [[ -f ./svc.sh ]]; then
    ./svc.sh stop 2>/dev/null || true
    ./svc.sh uninstall 2>/dev/null || true
  fi

  ./svc.sh install "${RUNNER_USER}"

  local unit
  unit="$(systemctl list-unit-files --type=service 'actions.runner.*' --no-legend 2>/dev/null | awk '{print $1}' | head -1 || true)"
  if [[ -z "${unit}" ]]; then
    unit="$(ls /etc/systemd/system/actions.runner.*.service 2>/dev/null | xargs -n1 basename | head -1 || true)"
  fi

  if [[ -n "${unit}" ]]; then
    mkdir -p "/etc/systemd/system/${unit}.d"
    cat > "/etc/systemd/system/${unit}.d/override.conf" <<EOF
[Service]
Environment=NODE_OPTIONS=${NODE_OPTIONS_DEFAULT}
Environment=CI=true
Environment=NEXT_TELEMETRY_DISABLED=1
Environment=PATH=/usr/local/bin:/usr/bin:/bin
EOF
    systemctl daemon-reload
    systemctl enable "${unit}"
    systemctl restart "${unit}"
    log "Serviço ativo: ${unit}"
  else
    ./svc.sh start
    log "svc.sh start executado (unit name não detectado)"
  fi
}

install_cleanup_cron() {
  local cron_file="/etc/cron.d/github-runner-cleanup"
  log "Configurando limpeza diária de ${RUNNER_WORKDIR} (arquivos >7 dias)..."
  cat > "${cron_file}" <<EOF
# Limpa workdirs antigos do self-hosted runner (evita disco cheio)
15 3 * * * ${RUNNER_USER} find ${RUNNER_WORKDIR} -mindepth 1 -mtime +7 -delete 2>/dev/null || true
EOF
  chmod 644 "${cron_file}"
}

print_status() {
  log "Status:"
  systemctl --no-pager --full status 'actions.runner.*' 2>/dev/null | head -40 || true
  log "Pronto. Confira no GitHub: Settings → Actions → Runners (Idle/Online)."
  log "Labels esperadas: ${RUNNER_LABELS}"
}

main() {
  require_root
  require_token
  install_host_deps
  create_runner_user
  download_runner
  configure_runner
  install_systemd_service
  install_cleanup_cron
  print_status
}

main "$@"
