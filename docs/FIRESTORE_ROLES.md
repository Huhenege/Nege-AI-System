# Firestore Roles ба Эрхийн Тодорхойлолт

Nege Systems системийн Firestore аюулгүй байдлын дүрмүүд болон эрхийн загварын тайлбар.

## 1. Эрхийн загвар (Roles)

Системд **Firebase Auth UID** нь `employees/{uid}` баримтаар холбогдож, **role** талбараар эрх тодорхойлогдоно.

| Role       | Тайлбар | Ерөнхий эрх |
|------------|---------|-------------|
| **admin**  | Системийн администратор | Бүх collection унших/бичих (зарим модульд хязгаарлагдмал) |
| **employee** | Энгийн ажилтан (default) | Өөртөө хамаарах мэдээллээ унших/засах, нийтлэл/талархал унших, төслийн гишүүнчлэлээр тодорхой эрх |

### Хэрэглэгдэх функцууд (firestore.rules дотор)

- **`isSignedIn()`** — Нэвтэрсэн эсэх (`request.auth != null`)
- **`isOwner(userId)`** — Өөрийн UID эсэх (`request.auth.uid == userId`)
- **`isAdmin()`** — `employees/{uid}` байгаа бөгөөд `role == 'admin'` эсэх

Админ шалгалт нь **employees** collection-ийг уншина. Тиймээс employees-д хандах эрх нь админ болгоход шаардлагатай.

---

## 2. Collection бүрийн эрх (Reference)

Доорх хүснэгт нь collection/зам бүрт **унших (R)** болон **бичих (W: create/update/delete)** хэнтэйг товчлон заасан.

| Collection / Зам | R | W | Тэмдэглэл |
|------------------|---|---|-----------|
| **employees** | Нэвтэрсэн бүх хэрэглэгч | Create: нэвтэрсэн; Update/Delete: өөрөө эсвэл admin | Employee id = Firebase Auth UID |
| **employees/{id}/*** (дэд цуглуулга) | Өөрөө эсвэл admin | Өөрөө эсвэл admin | point_profile, assignedPrograms, vacationRequests, questionnaire, employmentHistory гэх мэт |
| **employees/{id}/point_profile/** | Нэвтэрсэн | Нэвтэрсэн | Онооны профайл (системийн логикоор бичигдэнэ) |
| **employees/{id}/assignedPrograms/** | Нэвтэрсэн | Create/Delete: admin; Update: нэвтэрсэн | Даалгавар төлөв гэх мэтийг mentor/баг шинэчилнэ |
| **employees/{id}/vacationRequests/** | Нэвтэрсэн | Create: өөрөө; Update: өөрөө / approver / admin | Чөлөөний хүсэлт |
| **departments** | Нэвтэрсэн | Admin | Хэлтэс/нэгж |
| **positions** | Нэвтэрсэн | Admin | Ажлын байр |
| **company/** (бүх зам) | Нэвтэрсэн (зарим нь public) | Admin | profile, branding/values, employeeCodeConfig, positionCodeConfig гэх мэт |
| **companyPolicies** | Нэвтэрсэн | Admin | Бодлого, журам |
| **companyHistory** | Нэвтэрсэн | Admin | Компанийн түүхэн үйл явдлууд |
| **company_profile** | Нэвтэрсэн | Admin | Компанийн профайл (хэрэв кодонд тусгаар collection болгосон бол) |
| **workSchedules**, **positionLevels**, **employmentTypes**, **jobCategories** | Нэвтэрсэн | Admin | Лавлах өгөгдөл (refCollection catch-all) |
| **attendance** | Admin (update); Create: өөрөө (employeeId нь өөрөө) | Ирцийн бичлэг өөрөө үүсгэнэ | |
| **onboarding_processes** | Нэвтэрсэн | Admin | Дасан зохицох процессууд |
| **offboarding_processes** | Нэвтэрсэн | Admin | Ажлаас чөлөөлөх процессууд |
| **onboardingPrograms/** (бүх дэд) | Нэвтэрсэн | Admin | Дасан зохицох хөтөлбөрийн загвар |
| **newHires** | Admin | Admin | |
| **organization_actions** | Нэвтэрсэн | Admin | Байгууллагын үйлдлүүд (жишээ нь томилгоо) |
| **settings/** | Нэвтэрсэн | Admin | Тохиргоо (жишээ нь onboarding) |
| **posts** | Нэвтэрсэн | Create/Delete: admin; Update: admin эсвэл зөвхөн reactions | Дотоод нийтлэл |
| **recognition_posts** | Нэвтэрсэн | Create: нэвтэрсэн; Update: өөрөө эсвэл reactions; Delete: өөрөө эсвэл admin | Онооны талархал |
| **point_transactions** | Өөрөө эсвэл admin | Create: нэвтэрсэн (системээр) | |
| **points_config**, **rewards** | Нэвтэрсэн | Admin | |
| **redemption_requests** | Өөрөө эсвэл admin | Create: нэвтэрсэн; Update: admin | Шагнал авах хүсэлт |
| **budget_point_requests** | Өөрөө (fromUserId) эсвэл admin | Create: нэвтэрсэн; Update/Delete: өөрөө эсвэл admin | Төсвийн оноо хүсэлт |
| **er_document_types**, **er_templates**, **er_workflows** | Нэвтэрсэн | Admin | Хөдөлмөрийн харилцааны лавлах |
| **er_process_document_types** | Нэвтэрсэн | Admin | ER процессын баримтын төрлүүд |
| **er_documents/** (+ activity) | Creator, employeeId, reviewers, admin | Статусаар (DRAFT/IN_REVIEW/REVIEWED) нарийвчилсан | Баримт, activity дэд цуглуулга |
| **vacancies** | Public (унших) | Admin | Сонгон шалгаруулалтын зар |
| **candidates**, **applications** | Admin | Create: Public (өргөдөл); Update/Delete: admin | |
| **interviews** | Нэвтэрсэн | Admin | |
| **projects** | Нэвтэрсэн | Create: нэвтэрсэн; Update/Delete: owner/createdBy эсвэл admin | |
| **projects/{id}/tasks** | Нэвтэрсэн | Owner/assignee/admin-аар нарийвчилсан | |
| **projects/{id}/messages** | Нэвтэрсэн | Create: нэвтэрсэн; Update/Delete: sender эсвэл admin | |
| **{path}/timeOffRequests/** (collection group) | Нэвтэрсэн | Admin эсвэл approverId | |
| **{path}/vacationRequests/** (collection group) | Нэвтэрсэн | Admin эсвэл approverId | |
| **{path}/assignedPrograms/** (collection group) | Нэвтэрсэн | Admin | |
| **{path}/tasks/** (collection group) | Нэвтэрсэн | — | Dashboard даалгаврын асуулгад |
| Бусад **{refCollection}/{docId}** | Нэвтэрсэн | Admin | Лавлах сангийн бусад цуглуулгууд |

---

## 3. Дүрмийн файлын байршил

- **Дүрмүүд**: `firestore.rules` (төслийн root)
- **Индекс**: `firestore.indexes.json`
- Deploy: `firebase deploy --only firestore`

---

## 4. Анхааруулга

- **employees** документын **role** талбар нь админ эрхийн цорын ганц эх сурвалж. Үүнийг зөвхөн одоо байгаа admin эсвэл backend/Cloud Functions-аар өөрчлөхөөр тохируулна.
- **company/** `allow read: if isSignedIn() || true` — зарим зам (жишээ нь лого, нэр) public уншигдах боломжтой. Нууцлал ихтэй мэдээлэл бол `isSignedIn()`-д л найдвартай.
- **vacancies**, **candidates**, **applications** — өргөдөл илгээх зориулалтаар create-ийг `true` (public) болгосон. Хэрэв ботов, спам эсэргүүцэл нэмэх бол Cloud Functions эсвэл рекапча баримтлуулна.
- Collection group дүрмүүд нь **алин ямар зам дахь** тухайн нэртэй дэд цуглуулгад нийгэмд ташигдана (жишээ нь `employees/xyz/vacationRequests/abc`).

---

## 5. Firestore консолд "Error loading documents"

**employees** (эсвэл `isSignedIn()` / `isAdmin()` шаардсан цуглуулга) консолд нээхэд "Error loading documents" гарах нь дүрмээс болсон хэвийн үзэгдэл.

### Шалтгаан

Firebase Console (Cloud Console) нь таны **Firebase Auth**-ийг илгээдэггүй. Консолоор харах үед `request.auth == null` тул:

- `isSignedIn()` → **false**
- `isAdmin()` → **false** (мөн `employees/$(request.auth.uid)` баримт үзэх боломжгүй)

Иймээс **employees**-ийн одоогийн дүрэм:

```
allow read: if isSignedIn() || (signup_config байгаа бөгөөд signup нээлттэй);
```

консолд **хангалттай** болох нь зөвхөн `system/signup_config` байгаа **бөгөөд** `open == true` үед л болно. Энэ нөхцөл биелээгүй бол консолд "Error loading documents" гарах нь хүлээгдэхүйц.

### Апп дахь эрх баталгаажуулах

Хэрэв алдаа нь **апп** дээр (нэвтэрсэн хэрэглэгч/админ үед) гарч байвал дарахийг шалгаарай:

| Шалгах зүйл | Тайлбар |
|-------------|--------|
| **Нэвтэрсэн эсэх** | Апп нэвтрэлт дууссаны дараа л Firestore асуулт илгээнэ. `request.auth` хоосон байвал олон цуглуулга уншихгүй. |
| **Админ эрх** | `isAdmin()` нь `employees/$(request.auth.uid)` баримтыг уншиж `role == 'admin'` эсэхийг шална. Энэ баримт байх, ба `role` талбар нь `'admin'` байх ёстой. |
| **Эзэмшигчийн эрх** | `isOwner(userId)` нь `request.auth.uid == userId` байгаа эсэхийг шална. Баримтын ID буюу `userId` нь хэрэглэгчийн Firebase UID-тай таарч байгаа эсэхийг баталгаажуулна. |

### Консолоор өгөгдөл харах (зөвхөн хөгжүүлэлт)

Консолоор **employees**-ийг шууд харахын тулд түр зуур дүрмийг сул болгож туршиж болно. **Үйлдвэрлэлийн орчинд энийг үлдээж болохгүй.**

`firestore.rules` дотор `match /employees/{employeeId}` блоконд:

- **Одоо:**  
  `allow read: if isSignedIn() || (exists(...signup_config) && get(...).data.get('open', false) == true);`
- **Түр туршилт:**  
  `allow read: if true;`  
  → Консолд баримтууд харагдана. Асуудал дүрмээс болсон эсэх нь тодорхой болно.

Туршилт дууссны дараа **заавал** анхны дүрмээ буцааж тавина.

---

**Хувилбар**: 1.0  
**Сүүлд шинэчлэгдсэн**: 2026-01-27
