import { collection, query, where, getDocs, Timestamp, addDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { ERWorkflow, ERDocumentType, ERTemplate } from './types';
import { addDocumentNonBlocking, updateDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { tenantDoc, tenantCollection } from '@/firebase/tenant-helpers';

// Using the same firebase instance as the app
import { initializeFirebase } from '@/firebase';

export async function seedDemoData(companyPath: string | null = null) {
    const { firestore } = initializeFirebase();
    if (!firestore) throw new Error("Firestore not initialized");

    console.log("Starting seed...");

    // 1. Create Workflow
    const workflowData = {
        name: 'Хөдөлмөрийн гэрээ батлах',
        description: 'Стандарт хөдөлмөрийн гэрээг батлах урсгал',
        steps: [
            {
                id: crypto.randomUUID(),
                name: 'Хүний нөөц хянах',
                approverRole: 'HR_MANAGER',
                actionType: 'REVIEW',
                order: 0
            },
            {
                id: crypto.randomUUID(),
                name: 'Захирал батлах',
                approverRole: 'DIRECTOR',
                actionType: 'APPROVE',
                order: 1
            },
            {
                id: crypto.randomUUID(),
                name: 'Ажилтан гарын үсэг зурах',
                approverRole: 'EMPLOYEE',
                actionType: 'SIGN',
                order: 2
            }
        ],
        isActive: true,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
    };

    // Check if exists
    const wfQuery = query(tenantCollection(firestore, companyPath, 'er_workflows'), where('name', '==', workflowData.name));
    const wfSnap = await getDocs(wfQuery);

    let workflowId = '';
    if (!wfSnap.empty) {
        console.log("Workflow already exists");
        workflowId = wfSnap.docs[0].id;
    } else {
        const docRef = await addDoc(tenantCollection(firestore, companyPath, 'er_workflows'), workflowData);
        workflowId = docRef.id;
        console.log("Workflow created", workflowId);
    }

    // 2. Create Document Type
    const typeData = {
        name: 'Хөдөлмөрийн гэрээ',
        code: 'CONTRACT_EMP_FULL',
        description: 'Хугацаагүй хөдөлмөрийн гэрээ',
        workflowId: workflowId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
    };

    const typeQuery = query(tenantCollection(firestore, companyPath, 'er_process_document_types'), where('code', '==', typeData.code));
    const typeSnap = await getDocs(typeQuery);

    let typeId = '';
    if (!typeSnap.empty) {
        console.log("Document Type already exists");
        typeId = typeSnap.docs[0].id;
        if (typeSnap.docs[0].data().workflowId !== workflowId) {
            await updateDocumentNonBlocking(tenantDoc(firestore, companyPath, 'er_process_document_types', typeId), { workflowId });
        }
    } else {
        const docRef = await addDoc(tenantCollection(firestore, companyPath, 'er_process_document_types'), typeData);
        typeId = docRef.id;
        console.log("Document Type created", typeId);
    }

    // 3. Create Template
    const templateData = {
        name: 'Үндсэн гэрээ 2025',
        documentTypeId: typeId,
        version: 1,
        content: `МОНГОЛ УЛСЫН ХӨДӨЛМӨРИЙН ГЭРЭЭ

Нэг талаас "Компани ХХК" (цаашид "Ажил олгогч" гэх),
Нөгөө талаас {{employee.lastName}} овогтой {{employee.firstName}} (цаашид "Ажилтан" гэх) нар харилцан тохиролцож энэхүү гэрээг байгуулав.

1. Нийтлэг үндэслэл
1.1. Ажилтан нь {{position.title}} албан тушаалд ажиллана.
1.2. Хөдөлмөрийн хөлс: {{salary.total}} төгрөг байна.
1.3. Ажил эхлэх огноо: {{date.today}}.

2. Ажилтны эрх үүрэг...
(Энэ бол жишээ гэрээний загвар юм)

Ажил олгогчийг төлөөлж:                  Ажилтан:
Гүйцэтгэх захирал                        ____________________
____________________                     {{employee.firstName}}
(Гарын үсэг)                             (Гарын үсэг)
`,
        isActive: true,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
    };

    const tmplQuery = query(tenantCollection(firestore, companyPath, 'er_templates'), where('name', '==', templateData.name));
    const tmplSnap = await getDocs(tmplQuery);

    if (tmplSnap.empty) {
        await addDoc(tenantCollection(firestore, companyPath, 'er_templates'), templateData);
        console.log("Template created");
    } else {
        console.log("Template already exists");
    }

    return true;
}


// ─── System Templates (appointment_probation + appointment_permanent) ────────
// These templates are auto-created on first load and cannot be deleted by users.
// Their content IS editable so admins can customise the text.

const SYSTEM_TEMPLATES = [
    {
        code: 'SYS_APPOINTMENT_PROBATION',
        actionId: 'appointment_probation',
        docTypeName: 'Туршилтын хугацаатай томилох тушаал',
        docTypeCode: 'SYS_APPT_PROB',
        docTypePrefix: 'ТТТ',
        templateName: 'Туршилтын хугацаатай ажилд томилох тухай',
        templateContent: `ТУШААЛ

Туршилтын хугацаатай ажилд томилох тухай

{{date.today}}                                                     Дугаар: {{document.number}}

{{employee.lastName}} овогтой {{employee.firstName}}-г {{position.title}} албан тушаалд {{date.probationStart}} өдрөөс {{date.probationEnd}} өдрийг хүртэл туршилтын хугацаагаар томилсугай.

Цалин хөлс: {{salary.total}} төгрөг

Үндэслэл: Хөдөлмөрийн тухай хуулийн 66 дугаар зүйл

Гүйцэтгэх захирал: ____________________
`,
        customInputs: [
            { key: 'probationStartDate', label: 'Туршилтын эхлэх огноо', type: 'date' as const, required: true, order: 0 },
            { key: 'probationEndDate', label: 'Туршилтын дуусах огноо', type: 'date' as const, required: true, order: 1 },
        ],
    },
    {
        code: 'SYS_APPOINTMENT_PERMANENT',
        actionId: 'appointment_permanent',
        docTypeName: 'Үндсэн ажилтнаар томилох тушаал',
        docTypeCode: 'SYS_APPT_PERM',
        docTypePrefix: 'ҮТТ',
        templateName: 'Үндсэн ажилтнаар томилох тухай',
        templateContent: `ТУШААЛ

Үндсэн ажилтнаар томилох тухай

{{date.today}}                                                     Дугаар: {{document.number}}

{{employee.lastName}} овогтой {{employee.firstName}}-г {{position.title}} албан тушаалд {{date.appointmentDate}} өдрөөс эхлэн үндсэн ажилтнаар томилсугай.

Цалин хөлс: {{salary.total}} төгрөг

Үндэслэл: Хөдөлмөрийн тухай хуулийн 65 дугаар зүйл

Гүйцэтгэх захирал: ____________________
`,
        customInputs: [
            { key: 'appointmentDate', label: 'Томилогдсон огноо', type: 'date' as const, required: true, order: 0 },
        ],
    },
    {
        code: 'SYS_APPOINTMENT_REAPPOINT',
        actionId: 'appointment_reappoint',
        docTypeName: 'Эргүүлэн томилох тушаал',
        docTypeCode: 'SYS_APPT_REAPPT',
        docTypePrefix: 'ЭТТ',
        templateName: 'Эргүүлэн томилох тухай',
        templateContent: `ТУШААЛ

Эргүүлэн томилох тухай

{{date.today}}                                                     Дугаар: {{document.number}}

{{employee.lastName}} овогтой {{employee.firstName}}-г {{position.title}} албан тушаалд {{date.reappointmentDate}} өдрөөс эхлэн эргүүлэн томилсугай.

Цалин хөлс: {{salary.total}} төгрөг

Үндэслэл: Хөдөлмөрийн тухай хуулийн 65 дугаар зүйл

Гүйцэтгэх захирал: ____________________
`,
        customInputs: [
            { key: 'reappointmentDate', label: 'Эргүүлэн томилсон огноо', type: 'date' as const, required: true, order: 0 },
        ],
    },
    {
        code: 'SYS_RELEASE_TEMPORARY',
        actionId: 'release_temporary',
        docTypeName: 'Ажилтныг түр чөлөөлөх тушаал',
        docTypeCode: 'SYS_REL_TEMP',
        docTypePrefix: 'ТЧТ',
        templateName: 'Ажилтныг түр чөлөөлөх тухай',
        templateContent: `ТУШААЛ

Ажилтныг түр чөлөөлөх тухай

{{date.today}}                                                     Дугаар: {{document.number}}

{{employee.lastName}} овогтой {{employee.firstName}}-г {{position.title}} албан тушаалаас {{date.releaseDate}} өдрөөс эхлэн түр чөлөөлсүгэй.

Шалтгаан: {{text.reason}}

Үндэслэл: Хөдөлмөрийн тухай хуулийн 78 дугаар зүйл

Гүйцэтгэх захирал: ____________________
`,
        customInputs: [
            { key: 'releaseDate', label: 'Түр чөлөөлөх огноо', type: 'date' as const, required: true, order: 0 },
            { key: 'reason', label: 'Шалтгаан', type: 'text' as const, required: false, order: 1 },
        ],
    },
    {
        code: 'SYS_RELEASE_COMPANY',
        actionId: 'release_company',
        docTypeName: 'Ажил олгогчийн санаачилгаар чөлөөлөх тушаал',
        docTypeCode: 'SYS_REL_COMP',
        docTypePrefix: 'АЧТ',
        templateName: 'Компанийн санаачилгаар ажлаас чөлөөлөх тухай',
        templateContent: `ТУШААЛ

Компанийн санаачилгаар ажлаас чөлөөлөх тухай

{{date.today}}                                                     Дугаар: {{document.number}}

{{employee.lastName}} овогтой {{employee.firstName}}-г {{position.title}} албан тушаалаас {{date.releaseDate}} өдрөөс эхлэн ажил олгогчийн санаачилгаар чөлөөлсүгэй.

Шалтгаан: {{text.reason}}

Үндэслэл: Хөдөлмөрийн тухай хуулийн 80 дугаар зүйл

Гүйцэтгэх захирал: ____________________
`,
        customInputs: [
            { key: 'releaseDate', label: 'Ажлаас чөлөөлөх огноо', type: 'date' as const, required: true, order: 0 },
            { key: 'reason', label: 'Шалтгаан', type: 'text' as const, required: false, order: 1 },
        ],
    },
    {
        code: 'SYS_RELEASE_EMPLOYEE',
        actionId: 'release_employee',
        docTypeName: 'Ажилтны санаачилгаар чөлөөлөх тушаал',
        docTypeCode: 'SYS_REL_EMP',
        docTypePrefix: 'ХЧТ',
        templateName: 'Ажилтны хүсэлтээр ажлаас чөлөөлөх тухай',
        templateContent: `ТУШААЛ

Ажилтны хүсэлтээр ажлаас чөлөөлөх тухай

{{date.today}}                                                     Дугаар: {{document.number}}

{{employee.lastName}} овогтой {{employee.firstName}}-г {{position.title}} албан тушаалаас {{date.releaseDate}} өдрөөс эхлэн ажилтны хүсэлтээр чөлөөлсүгэй.

Шалтгаан: {{text.reason}}

Үндэслэл: Хөдөлмөрийн тухай хуулийн 79 дугаар зүйл

Гүйцэтгэх захирал: ____________________
`,
        customInputs: [
            { key: 'releaseDate', label: 'Ажлаас чөлөөлөх огноо', type: 'date' as const, required: true, order: 0 },
            { key: 'reason', label: 'Шалтгаан', type: 'text' as const, required: false, order: 1 },
        ],
    },
];

/**
 * Ensures the system templates (appointment + release) exist.
 * Safe to call multiple times – only creates if missing.
 * Also links the created templates to organization_actions if not yet configured.
 */
export async function ensureSystemTemplates(companyPath: string | null = null) {
    const { firestore } = initializeFirebase();
    if (!firestore) throw new Error('Firestore not initialized');

    const wfSnap = await getDocs(query(tenantCollection(firestore, companyPath, 'er_workflows'), where('isActive', '==', true)));
    let defaultWorkflowId = '';
    if (!wfSnap.empty) {
        defaultWorkflowId = wfSnap.docs[0].id;
    } else {
        const wfRef = await addDoc(tenantCollection(firestore, companyPath, 'er_workflows'), {
            name: 'Томилгоо батлах',
            description: 'Томилгооны баримт батлах урсгал',
            steps: [
                { id: crypto.randomUUID(), name: 'Хүний нөөц хянах', approverRole: 'HR_MANAGER', actionType: 'REVIEW', order: 0 },
                { id: crypto.randomUUID(), name: 'Захирал батлах', approverRole: 'DIRECTOR', actionType: 'APPROVE', order: 1 },
                { id: crypto.randomUUID(), name: 'Гарын үсэг зурах', approverRole: 'EMPLOYEE', actionType: 'SIGN', order: 2 },
            ],
            isActive: true,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        });
        defaultWorkflowId = wfRef.id;
    }

    for (const sys of SYSTEM_TEMPLATES) {
        // 1. Check if template with this code already exists
        const tmplSnap = await getDocs(
            query(tenantCollection(firestore, companyPath, 'er_templates'), where('isSystem', '==', true), where('name', '==', sys.templateName))
        );
        if (!tmplSnap.empty) {
            console.log(`System template "${sys.templateName}" already exists`);
            await linkOrgAction(firestore, companyPath, sys.actionId, tmplSnap.docs[0].id);
            continue;
        }

        const dtSnap = await getDocs(
            query(tenantCollection(firestore, companyPath, 'er_process_document_types'), where('code', '==', sys.docTypeCode))
        );
        let docTypeId = '';
        if (!dtSnap.empty) {
            docTypeId = dtSnap.docs[0].id;
        } else {
            const dtRef = await addDoc(tenantCollection(firestore, companyPath, 'er_process_document_types'), {
                name: sys.docTypeName,
                code: sys.docTypeCode,
                prefix: sys.docTypePrefix,
                description: sys.docTypeName,
                workflowId: defaultWorkflowId,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            });
            docTypeId = dtRef.id;
        }

        const tmplRef = await addDoc(tenantCollection(firestore, companyPath, 'er_templates'), {
            name: sys.templateName,
            documentTypeId: docTypeId,
            content: sys.templateContent,
            requiredFields: [],
            version: 1,
            isActive: true,
            isDeletable: false,
            isSystem: true,
            customInputs: sys.customInputs,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        });

        console.log(`System template "${sys.templateName}" created (${tmplRef.id})`);

        await linkOrgAction(firestore, companyPath, sys.actionId, tmplRef.id);
    }

    return true;
}

async function linkOrgAction(firestore: any, companyPath: string | null, actionId: string, templateId: string) {
    const ACTION_NAMES: Record<string, string> = {
        'appointment_probation': 'Туршилтын хугацаатай томилох',
        'appointment_permanent': 'Үндсэн ажилтнаар томилох',
        'appointment_reappoint': 'Эргүүлэн томилох',
        'release_temporary': 'Ажилтныг түр чөлөөлөх',
        'release_company': 'Компанийн санаачилгаар чөлөөлөх',
        'release_employee': 'Ажилтны хүсэлтээр чөлөөлөх',
    };
    const actionRef = tenantDoc(firestore, companyPath, 'organization_actions', actionId);
    const actionSnap = await getDoc(actionRef);
    if (!actionSnap.exists() || !actionSnap.data()?.templateId) {
        await setDoc(actionRef, {
            templateId,
            name: ACTION_NAMES[actionId] || actionId,
            updatedAt: Timestamp.now(),
        }, { merge: true });
        console.log(`Linked organization_action "${actionId}" → template ${templateId}`);
    }
}
