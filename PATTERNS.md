# PATTERNS.md — Кодын стандарт ба давтагдах хэв маяг

> Энэ файл нь аудит болон code review-аас гарсан нийтлэг алдаа, шилдэг туршлагуудыг агуулна.
> Шинэ компонент бичихдээ эхлээд энийг уншаарай.

---

## 1. `useEffect` — Async fetch cleanup (🔴 Заавал)

Async fetch бүхий `useEffect` дотор **заавал** `cancelled` flag ашигла.
Үгүй бол component unmount болсны дараа `setState` дуудагдаж runtime warning/crash гарна.

```tsx
// ✅ Зөв
useEffect(() => {
  let cancelled = false;

  async function fetchData() {
    if (!firestore) return;
    const snap = await getDocs(someQuery);
    if (!cancelled) setData(snap.docs.map(d => d.data()));
  }

  fetchData();
  return () => { cancelled = true; };
}, [firestore, dependency]);

// ❌ Буруу — unmount болсон component-д setState дуудна
useEffect(() => {
  async function fetchData() {
    const snap = await getDocs(someQuery);
    setData(snap.docs.map(d => d.data())); // 💥 memory leak + warning
  }
  fetchData();
}, [firestore, dependency]);
```

---

## 2. `updateDocumentNonBlocking` vs `await updateDoc` (🔴 Заавал)

| Нөхцөл | Хэрэглэх |
|---|---|
| UI-д feedback шаардлагатай (toast, loading, error) | `await updateDoc(...)` |
| Background sync, log, analytics — user мэдэх шаардлагагүй | `updateDocumentNonBlocking(...)` |

```tsx
// ✅ UI-д feedback шаардлагатай үед
const handleSave = async () => {
  setIsLoading(true);
  try {
    await updateDoc(tDoc('employees', id), { field: value });
    toast({ title: 'Хадгалагдлаа' });
  } catch {
    toast({ variant: 'destructive', title: 'Алдаа гарлаа' });
  } finally {
    setIsLoading(false);
  }
};

// ❌ Буруу — алдааг барьж чадахгүй
const handleSave = async () => {
  try {
    updateDocumentNonBlocking(tDoc('employees', id), { field: value }); // fire-and-forget!
    toast({ title: 'Хадгалагдлаа' }); // алдаа гарсан ч энд хүрнэ
  } catch {
    // 💥 Энд хэзээ ч орохгүй
  }
};
```

---

## 3. Firebase Storage — `useFirebase()` hook ашиглах (🔴 Заавал)

`getStorage()` нь Firebase multi-app context-г зөв авахгүй. Үргэлж `useFirebase()` hook-оос аваарай.

```tsx
// ✅ Зөв
const { storage } = useFirebase();

const upload = async () => {
  if (!storage || !file) return;
  const storageRef = ref(storage, `path/to/${file.name}`);
  await uploadBytes(storageRef, file);
};

// ❌ Буруу
import { getStorage } from 'firebase/storage';

const upload = async () => {
  const storage = getStorage(); // 💥 wrong Firebase app instance
  const storageRef = ref(storage, `path/to/${file.name}`);
};
```

---

## 4. Dialog — `open` prop дээр form reset (🟡 Чухал)

Dialog хаагдах үед (backdrop click, ESC, Cancel) form-ийн утгыг заавал цэвэрлэ.
Үгүй бол дараагийн нээлтэд өмнөх утгууд харагдана.

```tsx
// ✅ Зөв
const form = useForm<FormValues>({ resolver: zodResolver(schema) });

useEffect(() => {
  if (!open) {
    form.reset();
  }
}, [open, form]);

// ❌ Буруу — зөвхөн submit дээр reset хийсэн
const onSubmit = async (data) => {
  await save(data);
  form.reset(); // dialog дахин нээгдэхэд л reset хийгдэнэ
  onOpenChange(false);
};
```

---

## 5. `URL.createObjectURL` — Memory leak запобіганню (🟡 Чухал)

File input бүхий компонент дотор object URL-г заавал revoke хий.

```tsx
// ✅ Зөв
const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  setPreview(prev => {
    if (prev) URL.revokeObjectURL(prev); // хуучин URL чөлөөлөх
    return URL.createObjectURL(file);
  });
  setFile(file);
};

// Component unmount болгон cleanup
useEffect(() => {
  return () => {
    if (preview) URL.revokeObjectURL(preview);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

// ❌ Буруу — revoke хэзээ ч дуудагдахгүй
const handleFileSelect = (e) => {
  setPreview(URL.createObjectURL(e.target.files[0])); // 💥 memory leak
};
```

---

## 6. Button — Loading & Disabled state (🟡 Чухал)

Async үйлдэл хийдэг товч бүрт `disabled` болон loading indicator байх ёстой.
Давхар click → давхар request → өгөгдлийн зөрчил.

```tsx
// ✅ Зөв
const [isLoading, setIsLoading] = useState(false);

const handleAction = async () => {
  setIsLoading(true);
  try {
    await doSomething();
  } finally {
    setIsLoading(false);
  }
};

<Button onClick={handleAction} disabled={isLoading}>
  {isLoading ? (
    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Боловсруулж байна...</>
  ) : (
    'Хадгалах'
  )}
</Button>

// ❌ Буруу
<Button onClick={handleAction}>Хадгалах</Button>
```

---

## 7. Status/Label display — raw key бус label харуулах (🟢 Minor)

Firestore-д хадгалагдсан raw key (`"active"`, `"on_leave"`) нь UI-д шууд харагдаж болохгүй.
Config object-оос label авч харуул.

```tsx
// Config object
const STATUS_LABELS: Record<string, string> = {
  active: 'Идэвхтэй',
  on_leave: 'Чөлөөтэй',
  terminated: 'Ажлаас гарсан',
};

// ✅ Зөв
<Badge>{STATUS_LABELS[employee.status] ?? employee.status}</Badge>

// SelectItem-д
{Object.entries(STATUS_LABELS).map(([key, label]) => (
  <SelectItem key={key} value={key}>{label}</SelectItem>
))}

// ❌ Буруу
<Badge>{employee.status}</Badge> // "on_leave" харагдана
```

---

## 8. Firestore Loop Query — N+1 асуудал (🟡 Анхааруулга)

`for` loop дотор Firestore query хийх нь N+1 асуудал үүсгэнэ. Боломжтой бол `Promise.all` ашигла.

```tsx
// ✅ Илүү сайн (жижиг N үед)
const results = await Promise.all(
  projects.map(p => getDocs(tCollection('projects', p.id, 'tasks')))
);

// ⚠️ Хүлцэж болох (cancelled flag-тэй бол)
for (const p of projects) {
  if (cancelled) return;
  const snap = await getDocs(tCollection('projects', p.id, 'tasks'));
  // ...
}

// ❌ Буруу — cancelled check байхгүй, бүгдийг хүлээнэ
for (const p of projects) {
  const snap = await getDocs(...); // unmount болсон ч үргэлжлэнэ
}
```

---

## Шуурхай тэмдэглэл

- `tCollection` / `tDoc` нь dependency array-д орох ёстой (stable ref боловч eslint дүрмийг дагах)
- Import-уудыг файлын эхэнд нэг блок болгон цэгцлэ — доор тусдаа import бичихгүй
- `console.log` production code-д үлдээхгүй — `console.error` зөвхөн catch блокт

---

_Сүүлийн шинэчлэл: 2026-03-27 — хамт олон модулийн аудитаас_

---

## 9. AI Agent Patterns

### Tool Idempotency (🟢 Чухал)

Tool-ийн implementation idempotent байх ёстой — нэг input-д үргэлж нэг үр дүн гарна.
Тухайлбал `createProject` дуудлага алдаагаа буцааж, дахин дуудах боломж байхаар бичигдсэн.

```typescript
// ✅ Зөв — алдаа гарвал success: false буцааж, exception throw хийхгүй
async (input) => {
  try {
    await db.collection(...).doc(id).set(data);
    return { success: true, id };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ❌ Буруу — exception throw хийвэл Genkit tool loop-д эвдрэл гарна
async (input) => {
  await db.collection(...).doc(id).set(data); // throws if fails
  return { success: true };
}
```

---

### Agent Delegation Pattern (🟢 Orchestrator + Specialist)

Orchestrator нь specialist agent-уудын tool-уудыг нэгтгэж нэг `ai.generate()` дуудалтаар ашиглуулдаг.
Specialist агент нь өөрийн domain-д л анхаарна (employee, onboarding, org...).

```typescript
// ✅ Зөв бүтэц
// specialist agent: createEmployeeAgentTools(companyId) → Tool[]
// orchestrator: нэгтгэж буцаана
export function createOrchestratorTools(ctx) {
  return [
    createProjectToolForTenant(ctx.companyId, ctx.userId),
    ...createEmployeeAgentTools(ctx.companyId),
    ...createOnboardingAgentTools(ctx.companyId),
    // ...
  ];
}

// route.ts: нэг generate дуудалтаар ашиглана
const result = await ai.generate({
  system: buildOrchestratorSystemPrompt(ctx),
  messages,
  tools: createOrchestratorTools(ctx),
  maxTurns: 5,
});
```

---

### Context Passing Convention (🟢 Tenant Scoping)

Tool factory function нь `companyId` (заримдаа `userId`) авч, tool implementation дотор closure болгон ашиглана.
Энэ нь multi-tenant аюулгүй байдлыг хангана — нэг tool instance нь зөвхөн нэг tenant-д ажиллана.

```typescript
// ✅ Зөв — companyId closure-д
export function createEmployeeAgentTools(companyId: string) {
  const searchEmployees = ai.defineTool({ name: 'searchEmployees', ... },
    async ({ query }) => {
      const snap = await db().collection(`companies/${companyId}/employees`).get();
      // companyId нь closure-оос ирнэ — параметр биш
    }
  );
  return [searchEmployees] as const;
}

// ❌ Буруу — companyId tool input-д байвал AI буруу tenant руу чиглэж болно
```

_Сүүлийн шинэчлэл: 2026-03-27 — Orchestrator + Specialist Agents архитектур нэмэгдлээ_
