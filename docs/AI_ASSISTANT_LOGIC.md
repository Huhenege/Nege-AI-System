# AI Туслах Функцийн Логик

Энэхүү баримт нь Nege Systems-д суурилагдсан AI туслахын ажиллах логик болон өгөгдлийн урсгалыг харуулна.

## Архитектурын урсгал (Sequence Diagram)

```mermaid
sequenceDiagram
    autonumber
    actor User as Хэрэглэгч
    participant UI as Floating Chat UI
    participant API as /api/assistant/chat
    participant Genkit as Genkit AI (Gemini)
    participant Tools as Tools (createProject, listEmployees)
    participant DB as Firestore (Firebase Admin)

    User->>UI: Мессеж бичих (Жишээ нь: "Ажилчдын нэрс харуул")
    UI->>API: POST хүсэлт (messages: [...түүх, шинэ мессеж])
    
    API->>Genkit: ai.generate(systemPrompt, messages, tools)
    
    rect rgb(230, 240, 250)
        Note over Genkit, Tools: AI-ийн шийдвэр гаргах үйл явц
        Genkit-->>Genkit: Мессежийг шинжилж аль<br/>tool дуудахыг шийднэ.
        
        alt Tools ашиглах шаардлагатай бол (Ж: listEmployees)
            Genkit->>Tools: Call 'listEmployees' tool
            Tools->>DB: Fetch 'employees', 'positions', 'departments'
            DB-->>Tools: Өгөгдөл буцаах
            Tools-->>Genkit: JSON Response (Ажилчдын жагсаалт)
            Genkit-->>Genkit: Өгөгдлийг уншиж,<br/>хүнд ойлгомжтойгоор текст болгоно
        else Мэдээлэл дутуу эсвэл энгийн асуулт бол
            Genkit-->>Genkit: Мэдээлэл нэмж асуух эсвэл<br/>шууд хариулах текст бэлдэнэ
        end
    end
    
    Genkit-->>API: Эцсийн хариу текст (text)
    API-->>UI: Response { text: "..." }
    UI->>User: Дэлгэцэнд харуулах
```

## Логикийн тайлбар

1. **Frontend (Floating Chat UI):** Хэрэглэгчтэй шууд харилцаж, мессежийн түүхийг хадгалж API руу илгээнэ.
2. **API Route (`/api/assistant/chat`):** Мессежийн түүхийг хүлээн авч `Genkit`-д дамжуулна. Энд бид AI-д `maxTurns: 5` гэж зааж өгсөн тул AI өөрөө цаанаа tool дуудаад, хариуг нь аваад дахин боловсруулж эцсийн хариугаа гаргах боломжтой.
3. **Genkit AI (Gemini 2.5 Flash):** Системийн промпт уншиж, хэрэглэгчийн асуултад дүн шинжилгээ хийнэ. Хэрэв шууд хариулах боломжгүй (жишээ нь: мэдээлэл дутуу) бол нэмж асууна. Харин үйлдэл хийх шаардлагатай бол зохих хэрэгслийг (tool) дуудна.
4. **Tools (`listEmployees`, `createProject`):** AI-ийн зүгээс дуудагдах бөгөөд сервер талдаа Firebase Admin SDK ашиглан Firestore мэдээллийн сантай шууд харилцаж, аюулгүй байдлаар унших/бичих үйлдлүүдийг гүйцэтгэнэ.
5. **Үр дүн буцаах:** AI-аас гарсан эцсийн хариуг буцааж хэрэглэгчийн дэлгэцэнд хэвлэнэ.