# Upstash Redis — Rate Limiter Setup

## Яагаад хэрэгтэй вэ?

Vercel serverless deployment-д request бүр өөр container instance дээр ажилладаг.
In-memory rate limiting (`Map`) нь instance хооронд мэдээлэл хуваалцдаггүй тул
**production-д rate limiting ажиллахгүй**.

Upstash Redis нь serverless-д зориулсан HTTP-based Redis бөгөөд:
- Vercel-тэй native интеграц
- Үнэгүй tier: 10,000 req/өдөр
- Sliding window алгоритм

---

## Тохируулах алхмууд

### 1. Upstash account үүсгэх
https://console.upstash.com → Sign up (GitHub-аар)

### 2. Redis database үүсгэх
- "Create Database" → нэр: `nege-ratelimit`
- Region: `ap-northeast-1` (Tokyo — Монголд ойрхон)
- Type: Regional
- "Create" дарах

### 3. REST credentials авах
Database → "REST API" tab-ийг нээх:
- `UPSTASH_REDIS_REST_URL` → `https://...upstash.io`
- `UPSTASH_REDIS_REST_TOKEN` → `AX...`

### 4. Vercel-д env variable нэмэх
Vercel Dashboard → Project → Settings → Environment Variables:

```
UPSTASH_REDIS_REST_URL    = https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN  = your-token-here
```

Environment: ✅ Production, ✅ Preview (Development optional)

### 5. Redeploy
```bash
vercel --prod
```
эсвэл Vercel Dashboard → Deployments → Redeploy

---

## Баталгаажуулах

Deploy дараа API log шалгах:
- `[rate-limiter] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set` гэсэн warning **гарахгүй** байх ёстой
- `/api/companies/register`-д 5 удаа хурдан дарахад 429 response ирэх ёстой

---

## Хязгаарлалтын тохиргоо

| Route | Лимит | Цонх |
|---|---|---|
| `/api/companies/register` | 5 | 60 сек |
| `/api/auth/ensure-claims` | 20 | 60 сек |
| `/api/setup` | 30 | 60 сек |
| `/api/calendar` | 60 | 60 сек |
| `/api/super-admin/company/delete` | 5 | 300 сек |
| `/api/billing/create-invoice` | 5 | 60 сек |
| Standard routes | 60 | 60 сек |
| AI routes | 10 | 60 сек |
