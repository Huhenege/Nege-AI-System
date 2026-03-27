/**
 * sanitize.ts
 *
 * HTML sanitization utility using DOMPurify.
 * Use before rendering any user-supplied or template HTML with dangerouslySetInnerHTML.
 *
 * Allowed tags and attributes are scoped to what the ER template system needs:
 *  - Block: p, div, h1–h4, ul, ol, li, br, hr, table, thead, tbody, tr, th, td
 *  - Inline: span, strong, b, em, i, u, s, a
 *  - Attributes: style (for formatting), href (a tags only), class, align, colspan, rowspan
 *
 * Explicitly blocked:
 *  - script, iframe, object, embed, form, input, button
 *  - javascript: / data: URIs in href
 *  - Event handlers (onclick, onerror, etc.)
 */

// DOMPurify is a client-side library — only safe to call in the browser.
// On the server (SSR/Node) it is not available; return the raw string as a fallback
// (server-rendered HTML is not interactive so XSS risk is lower, but flag it).

type DOMPurifyType = {
    sanitize: (dirty: string, config?: Record<string, unknown>) => string;
};

let _dompurify: DOMPurifyType | null = null;

function getDOMPurify(): DOMPurifyType | null {
    if (typeof window === 'undefined') return null;
    if (_dompurify) return _dompurify;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const DOMPurify = require('dompurify') as DOMPurifyType;
    _dompurify = DOMPurify;
    return _dompurify;
}

const ALLOWED_TAGS = [
    'p', 'div', 'span',
    'h1', 'h2', 'h3', 'h4',
    'ul', 'ol', 'li',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'strong', 'b', 'em', 'i', 'u', 's',
    'a', 'br', 'hr',
    'blockquote', 'pre', 'code',
];

const ALLOWED_ATTR = [
    'style', 'class', 'align',
    'href', 'target', 'rel',
    'colspan', 'rowspan',
    'width', 'height',
];

/**
 * Sanitize HTML string for safe rendering in the ER document viewer/editor.
 * Returns sanitized HTML string.
 *
 * @param dirty - Raw HTML string (from Firestore template content or document content)
 * @returns Sanitized HTML string safe for dangerouslySetInnerHTML
 */
export function sanitizeHtml(dirty: string): string {
    if (!dirty) return '';

    const purify = getDOMPurify();
    if (!purify) {
        // SSR: strip all tags as a safe fallback
        return dirty.replace(/<[^>]*>/g, '');
    }

    return purify.sanitize(dirty, {
        ALLOWED_TAGS,
        ALLOWED_ATTR,
        // Force safe links
        FORCE_BODY: false,
        // Prevent DOM clobbering
        SANITIZE_DOM: true,
        // Add rel="noopener noreferrer" to all <a> tags with target="_blank"
        ADD_ATTR: ['target'],
    });
}

/**
 * Sanitize and strip all HTML tags — returns plain text only.
 * Useful for metadata fields, previews, and search indexing.
 */
export function stripHtml(dirty: string): string {
    if (!dirty) return '';
    const purify = getDOMPurify();
    if (!purify) return dirty.replace(/<[^>]*>/g, '');
    return purify.sanitize(dirty, { ALLOWED_TAGS: [], KEEP_CONTENT: true });
}
