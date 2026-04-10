#!/usr/bin/env bash
# =============================================================================
# scripts/vps-setup.sh
# Setup inicial do VPS Hostinger para hospedar o Lead Flow (Next.js standalone)
#
# Execute como root no VPS:
#   curl -fsSL <url-do-script> | bash
#   ou: bash scripts/vps-setup.sh
#
# O que este script faz:
#   1. Instala Node.js 24 (via NodeSource)
#   2. Instala PM2 globalmente
#   3. Instala Nginx
#   4. Cria diretórios de deploy (/var/www/lead-flow e /var/www/lead-flow-staging)
#   5. Configura Nginx como reverse proxy (porta 80 → 3000 e 3001)
#   6. Configura PM2 para iniciar na reinicialização do servidor
#
# Pré-requisito: Ubuntu 22.04 / 24.04 LTS
# =============================================================================

set -euo pipefail

DOMAIN_PRODUCTION="${DOMAIN_PRODUCTION:-app.seudominio.com.br}"
DOMAIN_STAGING="${DOMAIN_STAGING:-staging.seudominio.com.br}"
DEPLOY_PATH_PROD="/var/www/lead-flow"
DEPLOY_PATH_STAGING="/var/www/lead-flow-staging"
APP_PORT_PROD=3000
APP_PORT_STAGING=3001

echo "=============================="
echo " Lead Flow - VPS Setup"
echo "=============================="
echo "Produção:  $DOMAIN_PRODUCTION -> porta $APP_PORT_PROD"
echo "Staging:   $DOMAIN_STAGING -> porta $APP_PORT_STAGING"
echo ""

# -----------------------------------------------------------------------------
# 1. Dependências do sistema
# -----------------------------------------------------------------------------
echo "[1/6] Atualizando pacotes..."
apt-get update -qq
apt-get install -y -qq curl gnupg2 rsync nginx certbot python3-certbot-nginx ufw

# -----------------------------------------------------------------------------
# 2. Node.js 24 via NodeSource
# -----------------------------------------------------------------------------
echo "[2/6] Instalando Node.js 24..."
if ! command -v node &>/dev/null || [[ "$(node -v)" != v24* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y -qq nodejs
fi
node -v
npm -v

# -----------------------------------------------------------------------------
# 3. PM2
# -----------------------------------------------------------------------------
echo "[3/6] Instalando PM2..."
npm install -g pm2 --quiet
pm2 -v

# -----------------------------------------------------------------------------
# 4. Diretórios de deploy
# -----------------------------------------------------------------------------
echo "[4/6] Criando diretórios de deploy..."
mkdir -p "$DEPLOY_PATH_PROD"
mkdir -p "$DEPLOY_PATH_STAGING"
# Permissão para o usuário de deploy (ajuste 'ubuntu' se necessário)
# chown -R ubuntu:ubuntu "$DEPLOY_PATH_PROD" "$DEPLOY_PATH_STAGING"

# -----------------------------------------------------------------------------
# 5. Nginx — reverse proxy
# -----------------------------------------------------------------------------
echo "[5/6] Configurando Nginx..."

cat > /etc/nginx/sites-available/lead-flow-production << NGINXEOF
server {
    listen 80;
    server_name $DOMAIN_PRODUCTION;

    # Aumenta limite de upload para anexos de leads
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
# 6. PM2 — startup na reinicialização
# -----------------------------------------------------------------------------
echo "[6/6] Configurando PM2 startup..."
pm2 startup systemd -u root --hp /root | tail -1 | bash || true

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
echo "   cat sua-chave-publica.pub >> ~/.ssh/authorized_keys"
echo ""
echo "4. Configure os GitHub Secrets no repositório:"
echo "   Settings > Secrets and variables > Actions"
echo ""
echo "   Secrets de infraestrutura (obrigatórios para deploy):"
echo "     HOSTINGER_HOST        - IP ou hostname do VPS"
echo "     HOSTINGER_USER        - Usuário SSH (ex: root ou ubuntu)"
echo "     HOSTINGER_SSH_KEY     - Chave privada SSH (conteúdo completo)"
echo "     HOSTINGER_PORT        - Porta SSH (padrão: 22)"
echo ""
echo "   Secrets da aplicação (migrar do painel Vercel):"
echo "     NEXT_PUBLIC_SUPABASE_URL"
echo "     NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo "     SUPABASE_SERVICE_ROLE_KEY"
echo "     SUPABASE_LEAD_ATTACHMENTS_BUCKET"
echo "     SUPABASE_PROFILE_ICONS_BUCKET"
echo "     POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_HOST / POSTGRES_PORT / POSTGRES_DB"
echo "     DATABASE_URL"
echo "     DIRECT_URL"
echo "     RESEND_API_KEY"
echo "     RESEND_OWNER_EMAIL / SUPPORT_EMAIL"
echo "     EMAIL_TEST_MODE"
echo "     ASAAS_API_KEY / ASAAS_WALLET_ID / ASAAS_WEBHOOK_TOKEN"
echo "     ASAAS_ENV / ASAAS_URL / ASAAS_URL_sandbox"
echo "     NEXT_PUBLIC_APP_URL"
echo "     NEXT_API_BASE_URL"
echo "     ENCRYPTION_KEY / NEXT_PUBLIC_ENCRYPTION_KEY"
echo "     INTEGRATIONS_ENCRYPTION_KEY"
echo "     META_APP_SECRET / META_ACCESS_TOKEN / META_VERIFY_TOKEN"
echo "     GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET"
echo ""
echo "   Secrets opcionais para staging separado:"
echo "     STAGING_NEXT_PUBLIC_APP_URL"
echo "     STAGING_DATABASE_URL"
echo "     STAGING_DIRECT_URL"
echo ""
echo "5. Primeiro deploy: faça push para a branch main."
echo "   PM2 será iniciado automaticamente via CI."
