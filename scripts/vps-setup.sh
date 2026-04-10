#!/usr/bin/env bash
# =============================================================================
# scripts/vps-setup.sh
# Setup inicial do VPS Hostinger para hospedar o Lead Flow via Docker Compose
#
# Execute como root no VPS:
#   bash scripts/vps-setup.sh
#
# O que este script faz:
#   1. Instala dependências do sistema
#   2. Instala Docker Engine + Docker Compose v2 (plugin oficial)
#   3. Instala Nginx (reverse proxy host → container)
#   4. Cria diretórios de deploy e arquivos compose iniciais
#   5. Configura Nginx: 80 → 3000 (prod) e 3001 (staging)
#   6. Habilita Docker no boot via systemd
#
# Pré-requisito: Ubuntu 22.04 / 24.04 LTS
# =============================================================================

set -euo pipefail

DOMAIN_PRODUCTION="${DOMAIN_PRODUCTION:-app.seudominio.com.br}"
DOMAIN_STAGING="${DOMAIN_STAGING:-staging.seudominio.com.br}"
DEPLOY_PATH_PROD="/opt/lead-flow"
DEPLOY_PATH_STAGING="/opt/lead-flow-staging"
APP_PORT_PROD=3000
APP_PORT_STAGING=3001
GHCR_IMAGE="ghcr.io/matheuswillock/lead-flow-app"

echo "=============================="
echo " Lead Flow - VPS Setup (Docker)"
echo "=============================="
echo "Produção:  $DOMAIN_PRODUCTION -> porta $APP_PORT_PROD"
echo "Staging:   $DOMAIN_STAGING -> porta $APP_PORT_STAGING"
echo ""

# -----------------------------------------------------------------------------
# 1. Dependências do sistema
# -----------------------------------------------------------------------------
echo "[1/5] Atualizando pacotes..."
apt-get update -qq
apt-get install -y -qq \
  curl \
  gnupg2 \
  ca-certificates \
  lsb-release \
  nginx \
  certbot \
  python3-certbot-nginx \
  ufw

# -----------------------------------------------------------------------------
# 2. Docker Engine + Docker Compose v2 (plugin oficial)
# -----------------------------------------------------------------------------
echo "[2/5] Instalando Docker Engine..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
docker --version

# Docker Compose v2 como plugin (docker compose, não docker-compose)
if ! docker compose version &>/dev/null 2>&1; then
  apt-get install -y -qq docker-compose-plugin
fi
docker compose version

# Habilitar Docker no boot
systemctl enable docker
systemctl start docker

# -----------------------------------------------------------------------------
# 3. Diretórios de deploy e arquivos docker-compose
# -----------------------------------------------------------------------------
echo "[3/5] Criando diretórios e arquivos compose..."
mkdir -p "$DEPLOY_PATH_PROD"
mkdir -p "$DEPLOY_PATH_STAGING"

# Cria .env vazio (preenchido pelo CI ou manualmente)
touch "$DEPLOY_PATH_PROD/.env"
touch "$DEPLOY_PATH_STAGING/.env"

# docker-compose.yml — produção
cat > "$DEPLOY_PATH_PROD/docker-compose.yml" << COMPOSEEOF
# Gerenciado pelo CI (ci-main.yml)
# Atualizar com o arquivo do repositório após cada mudança estrutural

name: lead-flow

services:
  app:
    image: $GHCR_IMAGE:production
    container_name: lead-flow-production
    restart: unless-stopped
    ports:
      - "127.0.0.1:${APP_PORT_PROD}:3000"
    env_file:
      - $DEPLOY_PATH_PROD/.env
    environment:
      - NODE_ENV=production
      - NEXT_TELEMETRY_DISABLED=1
    healthcheck:
      test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 45s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
COMPOSEEOF

# docker-compose.staging.yml — staging
cat > "$DEPLOY_PATH_STAGING/docker-compose.staging.yml" << COMPOSEEOF
# Gerenciado pelo CI (ci-develop.yml)

name: lead-flow-staging

services:
  app:
    image: $GHCR_IMAGE:staging
    container_name: lead-flow-staging
    restart: unless-stopped
    ports:
      - "127.0.0.1:${APP_PORT_STAGING}:3000"
    env_file:
      - $DEPLOY_PATH_STAGING/.env
    environment:
      - NODE_ENV=production
      - NEXT_TELEMETRY_DISABLED=1
      - ASAAS_ENV=sandbox
    healthcheck:
      test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 45s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
COMPOSEEOF

# -----------------------------------------------------------------------------
# 4. Nginx — reverse proxy (host → container)
# -----------------------------------------------------------------------------
echo "[4/5] Configurando Nginx..."

cat > /etc/nginx/sites-available/lead-flow-production << NGINXEOF
server {
    listen 80;
    server_name $DOMAIN_PRODUCTION;

    # Aumenta limite para uploads de anexos de leads
    client_max_body_size 20M;

    location / {
        proxy_pass         http://127.0.0.1:$APP_PORT_PROD;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINXEOF

cat > /etc/nginx/sites-available/lead-flow-staging << NGINXEOF
server {
    listen 80;
    server_name $DOMAIN_STAGING;

    client_max_body_size 20M;

    location / {
        proxy_pass         http://127.0.0.1:$APP_PORT_STAGING;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/lead-flow-production /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/lead-flow-staging /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl enable nginx
systemctl restart nginx

# -----------------------------------------------------------------------------
# 5. Firewall básico
# Docker gerencia suas próprias regras iptables — não expor 3000/3001 no UFW
# -----------------------------------------------------------------------------
echo "[5/5] Configurando UFW..."
ufw allow ssh
ufw allow 'Nginx Full'
ufw --force enable

echo ""
echo "=============================="
echo " Setup concluído!"
echo "=============================="
echo ""
echo "Próximos passos manuais:"
echo ""
echo "1. Aponte os DNS:"
echo "   $DOMAIN_PRODUCTION  -> IP do VPS"
echo "   $DOMAIN_STAGING     -> IP do VPS"
echo ""
echo "2. Instale SSL (Let's Encrypt) após propagar DNS:"
echo "   certbot --nginx -d $DOMAIN_PRODUCTION"
echo "   certbot --nginx -d $DOMAIN_STAGING"
echo ""
echo "3. Adicione a chave SSH pública do GitHub Actions ao authorized_keys:"
echo "   echo 'SUA_CHAVE_PUBLICA_ED25519' >> ~/.ssh/authorized_keys"
echo ""
echo "4. Configure os GitHub Secrets no repositório:"
echo "   Settings > Secrets and variables > Actions > New repository secret"
echo ""
echo "   Infraestrutura (obrigatórios para deploy):"
echo "     HOSTINGER_HOST        IP ou hostname do VPS"
echo "     HOSTINGER_USER        usuário SSH (ex: root)"
echo "     HOSTINGER_SSH_KEY     chave privada SSH (conteúdo completo)"
echo "     HOSTINGER_PORT        22 (ou porta configurada)"
echo ""
echo "   Aplicação (migrar do painel Vercel):"
echo "     NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo "     SUPABASE_SERVICE_ROLE_KEY"
echo "     SUPABASE_LEAD_ATTACHMENTS_BUCKET / SUPABASE_PROFILE_ICONS_BUCKET"
echo "     POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_HOST / POSTGRES_PORT / POSTGRES_DB"
echo "     DATABASE_URL / DIRECT_URL"
echo "     RESEND_API_KEY / RESEND_OWNER_EMAIL / SUPPORT_EMAIL / EMAIL_TEST_MODE"
echo "     ASAAS_API_KEY / ASAAS_WALLET_ID / ASAAS_WEBHOOK_TOKEN"
echo "     ASAAS_ENV / ASAAS_URL / ASAAS_URL_sandbox"
echo "     NEXT_PUBLIC_APP_URL"
echo "     NEXT_API_BASE_URL (padrão: /api/v1)"
echo "     ENCRYPTION_KEY / NEXT_PUBLIC_ENCRYPTION_KEY"
echo "     INTEGRATIONS_ENCRYPTION_KEY"
echo "     META_APP_SECRET / META_ACCESS_TOKEN / META_VERIFY_TOKEN"
echo "     GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET"
echo ""
echo "   Staging (opcionais — se banco/URL forem diferentes):"
echo "     STAGING_NEXT_PUBLIC_APP_URL"
echo "     STAGING_DATABASE_URL / STAGING_DIRECT_URL"
echo ""
echo "5. Primeiro deploy: faça push para main."
echo "   O CI vai buildar a imagem Docker, fazer push no GHCR e reiniciar o container."
echo ""
echo "   Comandos úteis no VPS após o primeiro deploy:"
echo "     docker compose -f $DEPLOY_PATH_PROD/docker-compose.yml ps"
echo "     docker compose -f $DEPLOY_PATH_PROD/docker-compose.yml logs -f"
echo "     docker compose -f $DEPLOY_PATH_PROD/docker-compose.yml restart"
echo ""
echo "   Rollback para versão anterior:"
echo "     # Substitua <sha> pelo SHA do commit anterior"
echo "     docker pull $GHCR_IMAGE:prod-<sha>"
echo "     docker tag $GHCR_IMAGE:prod-<sha> $GHCR_IMAGE:production"
echo "     docker compose -f $DEPLOY_PATH_PROD/docker-compose.yml up -d"
