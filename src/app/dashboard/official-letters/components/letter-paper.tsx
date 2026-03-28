'use client';
/**
 * LetterPaper — albanbichgiin paper preview component.
 * OfficialLetterheadGenerator.jsx-aas Next.js/TSX bolgoson.
 * Pagination logic (useLayoutEffect) энд хэрэгжсэн.
 */
import React, { useRef, useLayoutEffect, useState } from 'react';
import { OfficialLetterConfig } from '../types';

const blank = '\u00A0';

function normalizeContentParagraphs(content: string): string[] {
    const lines = String(content || '').replace(/\r/g, '').split('\n');
    const normalized: string[] = [];
    let previousWasEmpty = false;
    lines.forEach((line) => {
        const cleaned = line.replace(/\s+$/g, '');
        const isEmpty = cleaned.trim() === '';
        if (isEmpty) {
            if (!previousWasEmpty && normalized.length > 0) normalized.push('');
            previousWasEmpty = true;
            return;
        }
        normalized.push(cleaned);
        previousWasEmpty = false;
    });
    while (normalized.length > 0 && normalized[normalized.length - 1] === '') normalized.pop();
    return normalized.length > 0 ? normalized : [''];
}

export function getPaperMargins(paperSize: string, orientation: string) {
    if (paperSize === 'A4') {
        if (orientation === 'landscape') return { top: 30, right: 20, bottom: 15, left: 20 };
        return { top: 20, right: 15, bottom: 20, left: 30 };
    }
    return { top: 20, right: 15, bottom: 20, left: 30 };
}

interface LetterPaperProps {
    config: OfficialLetterConfig;
    className?: string;
    /** printing=true үед shadow, gap хасна */
    printing?: boolean;
    wrapperRef?: React.RefObject<HTMLDivElement>;
}

export function LetterPaper({ config, printing = false, wrapperRef }: LetterPaperProps) {
    const measureRef = useRef<HTMLDivElement>(null);
    const measureHeaderRef = useRef<HTMLDivElement>(null);
    const measureAddresseeRef = useRef<HTMLDivElement>(null);
    const measureSubjectRef = useRef<HTMLDivElement>(null);
    const measureContentRef = useRef<HTMLDivElement>(null);
    const measureSignatureRef = useRef<HTMLDivElement>(null);
    const [pages, setPages] = useState<string[][]>([normalizeContentParagraphs(config.content)]);

    const isA5 = config.paperSize === 'A5';
    const margins = getPaperMargins(config.paperSize, config.orientation);
    const fontFamily = config.fontFamily === 'Arial' ? 'Arial, sans-serif' : '"Times New Roman", serif';
    const bodyFontSize = config.fontFamily === 'Arial' ? '11pt' : '12pt';
    const lineHeight = config.paperSize === 'A5' ? 1.0 : 1.3;
    const formattedDate = config.docDate ? config.docDate.replace(/-/g, '.') : '';

    const paperStyle: React.CSSProperties = {
        width: config.paperSize === 'A4'
            ? (config.orientation === 'portrait' ? '210mm' : '297mm')
            : (config.orientation === 'portrait' ? '148mm' : '210mm'),
        height: config.paperSize === 'A4'
            ? (config.orientation === 'portrait' ? '297mm' : '210mm')
            : (config.orientation === 'portrait' ? '210mm' : '148mm'),
        paddingTop: `${margins.top}mm`,
        paddingRight: `${margins.right}mm`,
        paddingBottom: `${margins.bottom}mm`,
        paddingLeft: `${margins.left}mm`,
        '--ob-font-family': fontFamily,
        '--ob-body-size': bodyFontSize,
        '--ob-line-height': lineHeight,
    } as React.CSSProperties;

    useLayoutEffect(() => {
        const measureEl = measureRef.current;
        const headerEl = measureHeaderRef.current;
        const subjectEl = measureSubjectRef.current;
        const contentEl = measureContentRef.current;
        const signatureEl = measureSignatureRef.current;
        if (!measureEl || !headerEl || !subjectEl || !contentEl || !signatureEl) {
            setPages([normalizeContentParagraphs(config.content)]);
            return;
        }
        const paragraphs = normalizeContentParagraphs(config.content);
        const pageHeightMm = config.paperSize === 'A4'
            ? (config.orientation === 'portrait' ? 297 : 210)
            : (config.orientation === 'portrait' ? 210 : 148);
        const cs = window.getComputedStyle(measureEl);
        const paddingTop = parseFloat(cs.paddingTop) || 0;
        const paddingBottom = parseFloat(cs.paddingBottom) || 0;
        const pageInnerHeight = Math.max(0, measureEl.clientHeight - paddingTop - paddingBottom);
        const pxPerMm = measureEl.clientHeight / pageHeightMm;
        const pageNumberReserve = 6 * pxPerMm;
        const getOuterHeight = (el: HTMLElement) => {
            const s = window.getComputedStyle(el);
            return el.offsetHeight + parseFloat(s.marginTop) + parseFloat(s.marginBottom);
        };
        const headerHeight = getOuterHeight(headerEl);
        const addresseeHeight = isA5 && measureAddresseeRef.current ? getOuterHeight(measureAddresseeRef.current) : 0;
        const subjectHeight = getOuterHeight(subjectEl);
        const signatureHeight = getOuterHeight(signatureEl);
        const firstAvailable = Math.max(0, pageInnerHeight - headerHeight - addresseeHeight - subjectHeight - pageNumberReserve);
        const middleAvailable = Math.max(0, pageInnerHeight - pageNumberReserve);
        const firstAvailableWithSignature = Math.max(0, firstAvailable - signatureHeight);
        const middleAvailableWithSignature = Math.max(0, middleAvailable - signatureHeight);

        const measureContentHeight = (paras: string[]) => {
            contentEl.innerHTML = '';
            paras.forEach((para) => {
                const p = document.createElement('p');
                p.textContent = para || '\u00A0';
                contentEl.appendChild(p);
            });
            return contentEl.offsetHeight;
        };
        const fitFromStart = (paras: string[], available: number): number => {
            if (!paras.length) return 0;
            let count = 0;
            const chunk: string[] = [];
            for (let i = 0; i < paras.length; i++) {
                chunk.push(paras[i]);
                if (measureContentHeight(chunk) > available) return count === 0 ? 1 : count;
                count++;
            }
            return count;
        };
        const splitTailToFit = (paras: string[], available: number): { head: string[]; tail: string[] } => {
            const tail: string[] = [];
            for (let i = paras.length - 1; i >= 0; i--) {
                tail.unshift(paras[i]);
                if (measureContentHeight(tail) > available) { tail.shift(); return { head: paras.slice(0, i + 1), tail }; }
            }
            return { head: [], tail };
        };

        const newPages: string[][] = [];
        let startIndex = 0;
        let available = firstAvailable;
        while (startIndex < paragraphs.length) {
            const count = fitFromStart(paragraphs.slice(startIndex), available);
            newPages.push(paragraphs.slice(startIndex, startIndex + count));
            startIndex += count;
            available = middleAvailable;
        }
        if (newPages.length) {
            const lastIndex = newPages.length - 1;
            const lastParas = newPages[lastIndex];
            const lastLimit = newPages.length === 1 ? firstAvailableWithSignature : middleAvailableWithSignature;
            if (measureContentHeight(lastParas) > lastLimit) {
                let { head, tail } = splitTailToFit(lastParas, lastLimit);
                if (!tail.length && head.length > 0) { tail = [head[head.length - 1]]; head = head.slice(0, -1); }
                newPages.splice(lastIndex, 1);
                if (head.length) newPages.push(head);
                if (tail.length) newPages.push(tail);
            }
        }
        const compactPages = newPages.filter((pp, idx) => idx === 0 || pp.some(p => String(p || '').trim().length > 0));
        setPages(compactPages.length ? compactPages : [['']]);
    }, [config, isA5]);

    return (
        <>
            {/* Visible pages */}
            <div
                ref={wrapperRef}
                className={printing ? 'ob-printing' : ''}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: printing ? 0 : '2.5rem' }}
            >
                {pages.map((pageParagraphs, pageIndex) => {
                    const isFirst = pageIndex === 0;
                    const isLast = pageIndex === pages.length - 1;
                    return (
                        <div
                            key={`page-${pageIndex}`}
                            className={`ob-paper${isA5 ? ' ob-paper--a5' : ''}${config.orientation === 'landscape' ? ' landscape' : ''}`}
                            style={paperStyle}
                        >
                            {isFirst && (
                                <div className="ob-doc-header">
                                    <div className="ob-header-row">
                                        <div className="ob-header-left">
                                            <span className="ob-corner ob-corner--tl" />
                                            {config.orgLogo && <img src={config.orgLogo} alt="Logo" className="ob-doc-logo" loading="eager" />}
                                            <div className="ob-doc-org-name">{config.orgName}</div>
                                            <div className="ob-header-tagline">{config.orgTagline}</div>
                                            <div className="ob-header-contacts">
                                                <div>{config.address}</div>
                                                <div>Утас: {config.phone}</div>
                                                <div>И-мэйл: {config.email}</div>
                                                {config.web && <div>Вэб: {config.web}</div>}
                                            </div>
                                        </div>
                                        {!isA5 && (
                                            <div className="ob-header-right">
                                                <span className="ob-corner ob-corner--tl" />
                                                <span className="ob-corner ob-corner--tr" />
                                                <div className="ob-header-recipient">{config.addresseeOrg}</div>
                                                <div className="ob-header-recipient-name">{config.addresseeName}</div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="ob-meta-block">
                                        <div className="ob-meta-row">
                                            <span className="ob-meta-label">огноо:</span>
                                            <span className="ob-meta-fill ob-meta-fill--date">{formattedDate || blank}</span>
                                            <span className="ob-meta-label">№</span>
                                            <span className="ob-meta-fill">{config.docIndex || blank}</span>
                                        </div>
                                        <div className="ob-meta-row">
                                            <span className="ob-meta-label">танай</span>
                                            <span className="ob-meta-fill ob-meta-fill--wide">{config.tanaiRef || blank}</span>
                                            <span className="ob-meta-label">№</span>
                                            <span className="ob-meta-fill ob-meta-fill--wide">{config.tanaiNo || blank}</span>
                                            <span className="ob-meta-label">т</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {isFirst && isA5 && (
                                <div className="ob-doc-addressee">
                                    <p>{config.addresseeOrg}</p>
                                    <p>{config.addresseeName}</p>
                                </div>
                            )}
                            {isFirst && (
                                <div className="ob-doc-subject">
                                    <span className="ob-subject-corner ob-subject-corner--left" />
                                    <span className="ob-subject-corner ob-subject-corner--right" />
                                    <span className="ob-doc-subject-text">{config.subject}</span>
                                </div>
                            )}
                            <div className="ob-doc-content">
                                {pageParagraphs.map((para, i) => (
                                    <p key={`${pageIndex}-${i}`}>{para || blank}</p>
                                ))}
                            </div>
                            {isLast && (
                                <div className="ob-doc-signature">
                                    <div className="ob-sig-row">
                                        <span>{config.signPosition}</span>
                                        <div className="ob-sig-line-wrap">
                                            <div className="ob-sig-line" />
                                            <div className="ob-sig-label">гарын үсэг</div>
                                        </div>
                                        <span>{config.signName}</span>
                                    </div>
                                </div>
                            )}
                            <div className="ob-page-number">{pageIndex + 1}/{pages.length}</div>
                        </div>
                    );
                })}
            </div>

            {/* Hidden measure paper */}
            <div className="ob-paper ob-paper--measure" style={{ ...paperStyle, position: 'absolute', left: -10000, top: 0, visibility: 'hidden', pointerEvents: 'none' }} aria-hidden ref={measureRef}>
                <div className="ob-doc-header" ref={measureHeaderRef}>
                    <div className="ob-header-row">
                        <div className="ob-header-left">
                            {config.orgLogo && <img src={config.orgLogo} alt="" className="ob-doc-logo" />}
                            <div className="ob-doc-org-name">{config.orgName}</div>
                            <div className="ob-header-tagline">{config.orgTagline}</div>
                            <div className="ob-header-contacts"><div>{config.address}</div><div>Утас: {config.phone}</div><div>И-мэйл: {config.email}</div></div>
                        </div>
                        {!isA5 && <div className="ob-header-right"><div className="ob-header-recipient">{config.addresseeOrg}</div><div className="ob-header-recipient-name">{config.addresseeName}</div></div>}
                    </div>
                    <div className="ob-meta-block">
                        <div className="ob-meta-row"><span className="ob-meta-label">огноо:</span><span className="ob-meta-fill ob-meta-fill--date">{formattedDate || blank}</span><span className="ob-meta-label">№</span><span className="ob-meta-fill">{config.docIndex || blank}</span></div>
                        <div className="ob-meta-row"><span className="ob-meta-label">танай</span><span className="ob-meta-fill ob-meta-fill--wide">{config.tanaiRef || blank}</span><span className="ob-meta-label">№</span><span className="ob-meta-fill ob-meta-fill--wide">{config.tanaiNo || blank}</span><span className="ob-meta-label">т</span></div>
                    </div>
                </div>
                {isA5 && <div className="ob-doc-addressee" ref={measureAddresseeRef}><p>{config.addresseeOrg}</p><p>{config.addresseeName}</p></div>}
                <div className="ob-doc-subject" ref={measureSubjectRef}><span className="ob-doc-subject-text">{config.subject}</span></div>
                <div className="ob-doc-content" ref={measureContentRef} />
                <div className="ob-doc-signature" ref={measureSignatureRef}><div className="ob-sig-row"><span>{config.signPosition}</span><div className="ob-sig-line-wrap"><div className="ob-sig-line" /><div className="ob-sig-label">гарын үсэг</div></div><span>{config.signName}</span></div></div>
            </div>
        </>
    );
}
