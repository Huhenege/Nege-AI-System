# Firestore Index үүсгэх заавар

## Шуурхай шийдэл:

### Арга 1: Автомат холбоос ашиглах (Хамгийн хялбар)
1. Mobile апп дээр улаан хайрцагт байгаа "Index үүсгэх холбоос" дээр дарна уу
2. Firebase Console нээгдэнэ
3. "Create Index" товч дарна уу
4. 2-5 минут хүлээнэ үү (index бэлэн болтол)
5. Mobile аппыг refresh хийнэ үү

### Арга 2: Гараар үүсгэх
1. Firebase Console руу очно уу: https://console.firebase.google.com
2. Төслөө сонгоно уу
3. Зүүн цэснээс "Firestore Database" сонгоно уу
4. Дээд хэсгээс "Indexes" таб руу очно уу
5. "Create Index" товч дарна уу
6. Дараах мэдээллийг оруулна уу:
   - Collection ID: `er_documents`
   - Fields to index:
     * Field: `reviewers` | Type: `Array-contains-any`
     * Field: `status` | Type: `Ascending`
     * Field: `updatedAt` | Type: `Descending`
   - Query scope: `Collection`
7. "Create" дарна уу

## Index бэлэн болсныг хэрхэн мэдэх вэ?

Firebase Console дээр Indexes хэсэгт очоод:
- Статус нь "Building" байвал хүлээнэ үү
- Статус нь "Enabled" болвол бэлэн болсон гэсэн үг

Ихэвчлэн 2-5 минут орчим хугацаа шаардагдана.

## Index бэлэн болсны дараа:

1. Mobile аппыг refresh хийнэ үү (эсвэл хуудсыг дахин ачаална уу)
2. Улаан алдааны мэдээлэл алга болж, баримт харагдах ёстой
3. Debug Info хэсэгт "Documents found: 1" (эсвэл илүү) гэж харагдана

## Яагаад энэ асуудал гарсан бэ?

Firestore-д `array-contains-any` болон бусад талбарууд дээр хамтад нь шүүлт хийхэд заавал index шаардлагатай. Энэ нь өгөгдлийн санг хурдан болгодог.

Бид `reviewers` массив дээр `array-contains-any` ашиглаж, мөн `status` болон `updatedAt` дээр шүүлт хийж байгаа учраас composite index шаардлагатай болсон.

---

## 403 "The caller does not have permission" (Index deploy)

`firebase deploy` ажиллуулахад **Firebase Rules** руу эрхгүй бол 403 гарна. Дараахыг туршина уу.

### Зөвхөн индекс deploy (Rules шалгалтгүй)

Firebase CLI нь `firestore:indexes` deploy хийхэд ч `firestore.rules`-ийг шалгаж, Rules API дуудаж 403 өгдөг. Тиймээс **rules-гүй** тусгай тохиргоо ашиглана:

```bash
firebase deploy --only firestore:indexes --config firebase.indexes-only.json
```

- `firebase.indexes-only.json` — зөвхөн `firestore.indexes` агуулна, `rules` байхгүй тул Rules API дуудагдахгүй.
- Хэрэв энд ч **403** (Firestore indexes API) гарвал бүртгэлд индекс үүсгэх эрх байхгүй гэсэн үг; доорх **гараар үүсгэх** аргыг ашиглана.

### Эрх засах (төсөлд Owner/Admin хэрэгтэй)

1. [Google Cloud Console](https://console.cloud.google.com) → төсөл **nege-ai-system** сонгоно.
2. **IAM & Admin** → **IAM**.
3. Өөрийн бүртгэл эсвэл service account-ыг олж, дараах ролуудын нэгийг нэмнэ:
   - **Firebase Admin** (эсвэл)
   - **Firebase Rules Administrator** (зөвхөн rules)
   - Firestore indexes-д: **Cloud Datastore User** / **Firebase Admin** ихэвчлэн хангалттай.

Дараа нь дахин `firebase deploy --only firestore:indexes` эсвэл `firebase deploy` ажиллуулна.

### Гараар индекс үүсгэх (РД/ТТД шалгалт)

CLI-ээр эрхгүй бол Console-оор **Collection group** индекс үүсгэнэ.

1. [Firebase Console](https://console.firebase.google.com) → төсөл сонгоно.
2. **Firestore Database** → **Indexes** таб.
3. **Create index** дарна.
4. Дараах хоёр индекс тус бүрийг гараар үүсгэнэ.

**Индекс 1 – Регистрийн дугаар (РД)**

- **Collection ID:** `questionnaire`
- **Query scope:** **Collection group**
- **Fields:**  
  - `registrationNumber` — Ascending
- **Create** дарна.

**Индекс 2 – Татвар төлөгчийн дугаар (ТТД)**

- **Collection ID:** `questionnaire`
- **Query scope:** **Collection group**
- **Fields:**  
  - `idCardNumber` — Ascending
- **Create** дарна.

Бэлэн болтол 2–5 минут хүлээнэ. Статус **Enabled** болсон үед РД/ТТД давхардлын шалгалт ажиллана.
