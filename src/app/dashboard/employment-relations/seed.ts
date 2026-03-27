import { collection, query, where, getDocs, Timestamp, addDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { ERWorkflow, ERDocumentType, ERTemplate } from './types';
import { addDocumentNonBlocking, updateDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { tenantDoc, tenantCollection } from '@/firebase/tenant-helpers';
import { initializeFirebase } from '@/firebase';


// ─── System templates definition ─────────────────────────────────────────────
// These are the built-in templates required for the employee lifecycle flows.

interface SystemTemplateEntry {
    actionId: string;
    templateName: string;
    docTypeName: string;
    docTypeCode: string;
    docTypePrefix: string;
    templateContent: string;
    customInputs?: {
        key: string;
        label: string;
        description?: string;
        required: boolean;
        type: 'text' | 'number' | 'date' | 'boolean';
        order: number;
    }[];
}

const SYSTEM_TEMPLATES: SystemTemplateEntry[] = [
    {
        actionId: 'appointment_probation',
        templateName: 'Туршилтын хугацаатай томилох тушаал',
        docTypeName: 'Томилох тушаал',
        docTypeCode: 'APPOINTMENT',
        docTypePrefix: 'ТШЛ',
        templateContent: '<p>{{employee.lastName}} {{employee.firstName}}-г {{position.title}} албан тушаалд туршилтын хугацаатай томилсугай.</p>',
        customInputs: [
            { key: 'startDate', label: 'Эхлэх огноо', required: true, type: 'date', order: 1 },
            { key: 'probationMonths', label: 'Туршилтын хугацаа (сар)', required: true, type: 'number', order: 2 },
        ],
    },
    {
        actionId: 'appointment_permanent',
        templateName: 'Үндсэн ажилтнаар томилох тушаал',
        docTypeName: 'Томилох тушаал',
        docTypeCode: 'APPOINTMENT',
        docTypePrefix: 'ТШЛ',
        templateContent: '<p>{{employee.lastName}} {{employee.firstName}}-г {{position.title}} албан тушаалд үндсэн ажилтнаар томилсугай.</p>',
        customInputs: [
            { key: 'startDate', label: 'Эхлэх огноо', required: true, type: 'date', order: 1 },
        ],
    },
    {
        actionId: 'appointment_reappoint',
        templateName: 'Эргүүлэн томилох тушаал',
        docTypeName: 'Томилох тушаал',
        docTypeCode: 'APPOINTMENT',
        docTypePrefix: 'ТШЛ',
        templateContent: '<p>{{employee.lastName}} {{employee.firstName}}-г {{position.title}} албан тушаалд эргүүлэн томилсугай.</p>',
        customInputs: [
            { key: 'startDate', label: 'Эхлэх огноо', required: true, type: 'date', order: 1 },
        ],
    },
    {
        actionId: 'release_temporary',
        templateName: 'Ажилтныг түр чөлөөлөх тушаал',
        docTypeName: 'Чөлөөлөх тушаал',
        docTypeCode: 'RELEASE',
        docTypePrefix: 'ЧЛ',
        templateContent: '<p>{{employee.lastName}} {{employee.firstName}}-г {{customInputs.releaseDate}} хүртэл түр чөлөөлсүгэй.</p>',
        customInputs: [
            { key: 'releaseDate', label: 'Чөлөөлөх огноо', required: true, type: 'date', order: 1 },
            { key: 'reason', label: 'Шалтгаан', required: false, type: 'text', order: 2 },
        ],
    },
    {
        actionId: 'release_company',
        templateName: 'Компанийн санаачилгаар чөлөөлөх тушаал',
        docTypeName: 'Чөлөөлөх тушаал',
        docTypeCode: 'RELEASE',
        docTypePrefix: 'ЧЛ',
        templateContent: "<p>{{employee.lastName}} {{employee.firstName}}-г ажлаас чөлөөлсүгэй.</p>",
        customInputs: [
            { key: 'Ажлаас чөлөөлөх огноо', label: 'Ажлаас чөлөөлөх огноо', required: true, type: 'date', order: 1 },
        ],
    },
    {
        actionId: 'release_employee',
        templateName: 'Ажилтны хүсэлтээр чөлөөлөх тушаал',
        docTypeName: 'Чөлөөлөх тушаал',
        docTypeCode: 'RELEASE',
        docTypePrefix: 'ЧЛ',
        templateContent: "<p>{{employee.lastName}} {{employee.firstName}}-г өөрийн хүсэлтээр ажлаас чөлөөлсүгэй.</p>",
        customInputs: [
            { key: 'Ажлаас чөлөөлөх огноо', label: 'Ажлаас чөлөөлөх огноо', required: true, type: 'date', order: 1 },
        ],
    },
];

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
