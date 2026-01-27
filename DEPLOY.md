# Foundations Game - Deployment Guide

## 🚀 Opções de Deploy

### 1. **Railway** (Recomendado - Fácil)
```bash
# 1. Instalar Railway CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Conectar ao projeto
railway link

# 4. Deploy
railway up

# 5. Configurar variáveis de ambiente no dashboard
# DATABASE_URL, REDIS_URL, JWT_SECRET
```

### 2. **Render** (Gratuito limitado)
```bash
# 1. Conectar GitHub ao Render
# 2. Criar Web Service
# 3. Configurar build & start commands
# 4. Adicionar PostgreSQL e Redis add-ons
```

### 3. **Docker + VPS**
```bash
# No seu servidor VPS:
docker-compose up -d -f docker-compose.prod.yml
```

### 4. **Vercel** (Serverless)
- Limitações: WebSockets podem não funcionar bem
- Bom para API REST simples

## 📋 Pré-requisitos para Deploy

### Banco de Dados
- PostgreSQL (produção)
- Redis (para filas Bull)

### Variáveis de Ambiente
```env
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=your-secret-key
NODE_ENV=production
```

### Domínios
- API: api.seudominio.com
- Frontend: seudominio.com

## 🏗️ Arquivos de Configuração

### docker-compose.prod.yml
```yaml
version: '3.8'
services:
  app:
    build: .
    environment:
      - NODE_ENV=production
    ports:
      - "3000:3000"
```

### .env.production
```
DATABASE_URL=postgresql://prod-url
REDIS_URL=redis://prod-redis
JWT_SECRET=prod-secret
```

## 🔧 Comandos Essenciais

```bash
# Build
npm run build

# Migration em produção
npx prisma migrate deploy

# Seeds (se houver)
npx prisma db seed

# Health check
curl https://api.seudominio.com/health
```

## 📊 Monitoramento

- Logs: Railway/Render dashboards
- Health checks: `/health` endpoint
- Métricas: Prometheus + Grafana
- Alertas: UptimeRobot ou similar

## 💰 Custos Estimados

- **Railway**: $5-10/mês
- **Render**: Gratuito até limites
- **VPS**: $5-20/mês
- **PostgreSQL**: $10-50/mês

Quer que eu configure uma dessas opções específicas?