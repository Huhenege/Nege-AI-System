# Firebase CLI – идэвхжүүлэх болон ашиглах

## Суулгах (хэрэв байхгүй бол)

```bash
npm install -g firebase-tools
```

## Идэвхжүүлэх (нэг удаа)

### 1. Firebase руу нэвтрэх
Браузер нээгдэж, Google бүртгэлээрээ нэвтэрнэ.

```bash
firebase login
```

### 2. Төслийг сонгох
Төслийн хавтас дотор:

```bash
cd "/Users/huhenege/Documents/HR system Cursor"
firebase use nege-ai-system
```

### 3. Шалгах
Ямар төсөл идэвхтэй байгааг харах:

```bash
firebase use
```

## Index deploy

Rules API-д эрхгүй бол rules-гүй тохиргоо ашиглана:

```bash
firebase deploy --only firestore:indexes --config firebase.indexes-only.json
```

Бүх зүйл deploy (rules + indexes) — эрх байвал:

```bash
firebase deploy
```

## Бусад тустай командууд

- **Төслийн жагсаалт:** `firebase projects:list`
- **Нэвтрэлт шалгах:** `firebase login:list`
- **Гарах:** `firebase logout`
