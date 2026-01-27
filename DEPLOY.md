# Foundations Game - Deployment Guide

## 🚀 Deploy no Render (GRÁTIS - Hoje!)

### Passo 1: Conectar GitHub
1. Acesse [render.com](https://render.com)
2. Faça login com GitHub
3. Clique "New" → "Blueprint"
4. Conecte seu repositório: `DiogoBarrosMartins/foundations`

### Passo 2: Configurar Serviços
O `render.yaml` criará automaticamente:
- ✅ **Web Service** (API NestJS)
- ✅ **PostgreSQL** (banco de dados)
- ✅ **Redis** (filas Bull)

### Passo 3: Deploy
1. Clique "Apply"
2. Aguarde ~10-15 minutos
3. Acesse a URL gerada

### Passo 4: Configurar Banco
Após deploy, execute no terminal do Render:
```bash
npx prisma migrate deploy
npx prisma generate
```

---

## 🔧 Configuração Manual (se Blueprint falhar)

### Criar PostgreSQL
1. "New" → "PostgreSQL"
2. Nome: `foundations-db`
3. Copie a `DATABASE_URL`

### Criar Redis
1. "New" → "Redis"
2. Nome: `foundations-redis`
3. Copie a `REDIS_URL`

### Criar Web Service
1. "New" → "Web Service"
2. Conectar GitHub repo
3. Configurar:
   - **Build Command**: `npm run deploy:prepare`
   - **Start Command**: `npm run start:prod`
4. Adicionar Environment Variables:
   ```
   NODE_ENV=production
   DATABASE_URL=postgresql://...
   REDIS_URL=redis://...
   JWT_SECRET=your-secret-here
   ```

---

## 📊 Status do Deploy

- **Tier Gratuito**: 750h/mês (~30 dias)
- **Banco**: 256MB PostgreSQL grátis
- **Redis**: 30MB grátis
- **Auto-scaling**: Não (gratuito)

---

## 🧪 Testar Deploy

```bash
# Health check
curl https://your-app.render.com/health

# API endpoints
curl https://your-app.render.com/
curl https://your-app.render.com/world/map

# Swagger docs
open https://your-app.render.com/docs
```

---

## 💰 Upgrade Futuro

Quando precisar de mais recursos:
- **Web Service**: $7/mês (512MB RAM)
- **PostgreSQL**: $7/mês (1GB)
- **Redis**: $10/mês (1GB)

**Quer que eu te ajude com algum passo específico?** 🎯

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