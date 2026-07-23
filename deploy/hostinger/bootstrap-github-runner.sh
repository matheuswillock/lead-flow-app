#!/usr/bin/env bash
# =============================================================================
# deploy/hostinger/bootstrap-github-runner.sh
# Instala GitHub Actions self-hosted runner(s) na VPS Hostinger (máx. 2).
# =============================================================================
#
# Uso (na VPS, como root):
#   export RUNNER_TOKEN="<registration token do GitHub>"
#   # Runner 1 (padrão):
#   bash deploy/hostinger/bootstrap-github-runner.sh
#   # Runner 2:
#   export RUNNER_INDEX=2
#   export RUNNER_TOKEN="<novo token>"
#   bash deploy/hostinger/bootstrap-github-runner.sh
#
# Opcional:
#   RUNNER_REPO_URL, RUNNER_NAME, RUNNER_LABELS, RUNNER_USER, RUNNER_HOME,
#   RUNNER_DIR, RUNNER_WORKDIR, NODE_OPTIONS, SKIP_HOST_DEPS=1
#
# Gerar token (local, com gh autenticado):
#   gh api -X POST repos/matheuswillock/lead-flow-app/actions/runners/registration-token --jq .token
#
# Capacidade: até 2 jobs em paralelo (2 runners, mesmas labels).
# O runner NÃO entra no grupo docker e NÃO recebe acesso a /opt/lead-flow-bot/.env*
# =============================================================================

set -euo pipefail

RUNNER_INDEX="${RUNNER_INDEX:-1}"
if [[ "${RUNNER_INDEX}" != "1" && "${RUNNER_INDEX}" != "2" ]]; then
  echo "[github-runner-bootstrap] ERRO: RUNNER_INDEX deve ser 1 ou 2 (máx. 2 runners)." >&2
  exit 1
fi

# Defaults por índice (podem ser sobrescritos via env)
if [[ "${RUNNER_INDEX}" == "1" ]]; then
  RUNNER_USER="${RUNNER_USER:-github-runner}"
  RUNNER_NAME="${RUNNER_NAME:-lead-flow-vps-1}"
else
  RUNNER_USER="${RUNNER_USER:-github-runner-2}"
  RUNNER_NAME="${RUNNER_NAME:-lead-flow-vps-2}"
fi

RUNNER_HOME="${RUNNER_HOME:-/home/${RUNNER_USER}}"
RUNNER_DIR="${RUNNER_DIR:-${RUNNER_HOME}/actions-runner}"
RUNNER_WORKDIR="${RUNNER_WORKDIR:-${RUNNER_HOME}/_work}"
RUNNER_REPO_URL="${RUNNER_REPO_URL:-https://github.com/matheuswillock/lead-flow-app}"
RUNNER_LABELS="${RUNNER_LABELS:-self-hosted,linux,x64,lead-flow-ci}"
RUNNER_VERSION="${RUNNER_VERSION:-2.329.0}"
# Heap um pouco menor: com 2 runners, dois next build podem competir pela RAM.
NODE_OPTIONS_DEFAULT="${NODE_OPTIONS:---max-old-space-size=2560}"
BUN_INSTALL_VERSION="${BUN_INSTALL_VERSION:-1.3.14}"
SKIP_HOST_DEPS="${SKIP_HOST_DEPS:-0}"
MAX_RUNNERS=2

log() { echo "[github-runner-bootstrap][vps-${RUNNER_INDEX}] $*"; }
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
  if [[ "${SKIP_HOST_DEPS}" == "1" ]]; then
    log "SKIP_HOST_DEPS=1 — pulando apt/bun/node"
    return
  fi

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

resolve_unit_name() {
  local expected="actions.runner.matheuswillock-lead-flow-app.${RUNNER_NAME}.service"
  if [[ -f "/etc/systemd/system/${expected}" ]]; then
    echo "${expected}"
    return
  fi
  # Fallback: unit cujo nome contém o RUNNER_NAME
  ls /etc/systemd/system/actions.runner.*.service 2>/dev/null \
    | xargs -n1 basename \
    | grep -F "${RUNNER_NAME}" \
    | head -1 || true
}

install_systemd_service() {
  log "Instalando serviço systemd do runner ${RUNNER_NAME}..."
  cd "${RUNNER_DIR}"

  # Só para este diretório — não mexe no outro runner
  if [[ -f ./svc.sh ]]; then
    ./svc.sh stop 2>/dev/null || true
    ./svc.sh uninstall 2>/dev/null || true
  fi

  ./svc.sh install "${RUNNER_USER}"

  local unit
  unit="$(resolve_unit_name)"

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
  local cleanup_script="/usr/local/sbin/github-runner-cleanup.sh"
  local cron_file="/etc/cron.d/github-runner-cleanup"

  log "Instalando limpeza segura de workdirs (todos os runners, idle-only)..."
  cat > "${cleanup_script}" <<'EOF'
#!/usr/bin/env bash
# Limpa workdirs antigos dos self-hosted runners (máx. 2) sem tocar em job ativo
# nem em caches compartilhados (_actions, _tool).
set -euo pipefail

if pgrep -f 'Runner.Worker' >/dev/null 2>&1; then
  echo "[github-runner-cleanup] Runner.Worker ativo — pulando limpeza"
  exit 0
fi

cleanup_workdir() {
  local workdir="$1"
  [[ -d "${workdir}" ]] || return 0

  find "${workdir}" -mindepth 1 -maxdepth 1 -type d \
    ! -name '_actions' \
    ! -name '_tool' \
    ! -name '_temp' \
    ! -name '_PipelineMapping' \
    ! -name '_update' \
    -mtime +7 \
    -print -exec rm -rf {} +

  find "${workdir}/_temp" -mindepth 1 -mtime +1 -delete 2>/dev/null || true
}

# Ambos os workdirs possíveis (vps-1 e vps-2)
cleanup_workdir /home/github-runner/_work
cleanup_workdir /home/github-runner-2/_work

echo "[github-runner-cleanup] OK"
EOF
  chmod 755 "${cleanup_script}"

  cat > "${cron_file}" <<EOF
# Limpa workdirs dos self-hosted runners (idle-only; preserva _actions/_tool)
15 3 * * * root ${cleanup_script} >> /var/log/github-runner-cleanup.log 2>&1
EOF
  chmod 644 "${cron_file}"
}

print_status() {
  log "Status (máx. ${MAX_RUNNERS} runners):"
  systemctl --no-pager --full status 'actions.runner.*' 2>/dev/null | head -50 || true
  log "Runner instalado: ${RUNNER_NAME} (user=${RUNNER_USER}, dir=${RUNNER_DIR})"
  log "Labels: ${RUNNER_LABELS}"
  log "Confira no GitHub: Settings → Actions → Runners (Idle/Online)."
}

main() {
  require_root
  require_token
  log "Instalando runner índice ${RUNNER_INDEX}/${MAX_RUNNERS}"
  install_host_deps
  create_runner_user
  download_runner
  configure_runner
  install_systemd_service
  install_cleanup_cron
  print_status
}

main "$@"
