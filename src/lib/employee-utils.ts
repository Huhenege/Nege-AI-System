/**
 * employee-utils.ts
 *
 * Super admin тусгаарлалтын нэг төвлөрсөн utility.
 *
 * Дизайн шийдэл:
 *   - `super_admin` нь платформын системийн хэрэглэгч бөгөөд ямар ч
 *     компанийн ажилтан биш. Тэд `/super-admin` portal-аар ажилладаг.
 *   - `company_super_admin` нь компанийн дотор ажилтан мөн — харагдана.
 *   - Энэ файлын функцуудыг employees-г харуулах бүх газраас ашиглана.
 *     Ирээдүйд нэмэлт шүүлт хэрэгтэй болбол нэг газар л өөрчилнэ.
 */

/** super_admin role-тэй employee document-г шүүж хасах */
export function isSystemUser(employee: { role?: string }): boolean {
    return employee.role === 'super_admin';
}

/**
 * Employee жагсаалтаас системийн хэрэглэгчдийг (super_admin) хасна.
 * Ажилтны карт, томилгооны dialog, headcount, attendance зэрэг
 * бүх газраас дуудна.
 */
export function filterSystemUsers<T extends { role?: string }>(employees: T[]): T[] {
    return employees.filter(emp => !isSystemUser(emp));
}
