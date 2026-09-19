# Deploy Hospital Zalo Hub on huyenvu-server

Production/staging layout:

- Web Admin: https://hub.huyenvu.cloud -> Cloudflare Tunnel -> 127.0.0.1:3000
- API: https://api-hub.huyenvu.cloud -> Cloudflare Tunnel -> 127.0.0.1:4000
- PostgreSQL: Docker private network only; no public host port

## 1. Clone/update source

```bash
cd /opt
sudo git clone https://github.com/bshuyenvu/hospital-zalo-hub.git
sudo chown -R "$USER":"$USER" /opt/hospital-zalo-hub
cd /opt/hospital-zalo-hub
```

If already cloned:

```bash
cd /opt/hospital-zalo-hub
git pull origin main
```

## 2. Create production environment

```bash
cp .env.production.example .env.production
chmod 600 .env.production
nano .env.production
```

Generate secrets locally on the server:

```bash
openssl rand -hex 32
openssl rand -base64 36
```

Use one strong value for `SESSION_SECRET` and another for `POSTGRES_PASSWORD`.

Do not paste Zalo secrets into GitHub.

## 3. Build and start

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Check status:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

Check API locally:

```bash
curl -fsS http://127.0.0.1:4000/health
```

Check Admin locally:

```bash
curl -I http://127.0.0.1:3000
```

Then verify externally:

- https://api-hub.huyenvu.cloud/health
- https://hub.huyenvu.cloud

## 4. First bootstrap

The database is intentionally not seeded automatically.

Run once:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec api npm run db:seed
```

This creates sample departments and `ADMIN001`.

For the first Zalo linking only, if no other internal authentication exists yet:

1. Temporarily set `ALLOW_DEV_AUTH=true`.
2. Restart API:
   ```bash
   docker compose --env-file .env.production -f docker-compose.prod.yml up -d api
   ```
3. Sign in as ADMIN001 and link the intended Zalo account.
4. Immediately set `ALLOW_DEV_AUTH=false`.
5. Restart API again.

Do not leave development login enabled on an Internet-facing environment.

## 5. Zalo callback

Configure the Zalo application callback URL exactly as:

```text
https://api-hub.huyenvu.cloud/v1/auth/zalo/callback
```

Set the real Zalo values only in `.env.production`, then restart API.

## 6. Logs and update

Logs:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f --tail=200 api admin
```

Update:

```bash
cd /opt/hospital-zalo-hub
git pull origin main
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Database backup:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U hospital -d hospital_hub > hospital_hub_$(date +%F_%H%M).sql
```
