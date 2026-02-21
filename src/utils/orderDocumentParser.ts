type ParsedOrderDocument = {
    orderNumber: string | null;
    orderDate: string | null; // dd.mm.yyyy
    orderSignDate: string | null; // dd.mm.yyyy
};

const RU_MONTHS: Record<string, string> = {
    '\u044f\u043d\u0432\u0430\u0440\u044f': '01',
    '\u0444\u0435\u0432\u0440\u0430\u043b\u044f': '02',
    '\u043c\u0430\u0440\u0442\u0430': '03',
    '\u0430\u043f\u0440\u0435\u043b\u044f': '04',
    '\u043c\u0430\u044f': '05',
    '\u0438\u044e\u043d\u044f': '06',
    '\u0438\u044e\u043b\u044f': '07',
    '\u0430\u0432\u0433\u0443\u0441\u0442\u0430': '08',
    '\u0441\u0435\u043d\u0442\u044f\u0431\u0440\u044f': '09',
    '\u043e\u043a\u0442\u044f\u0431\u0440\u044f': '10',
    '\u043d\u043e\u044f\u0431\u0440\u044f': '11',
    '\u0434\u0435\u043a\u0430\u0431\u0440\u044f': '12',
};

const DATE_DOT_RE = /\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/;

function pad2(value: string): string {
    return value.padStart(2, '0');
}

function normalizeYear(value: string): string {
    if (value.length === 4) return value;
    const year = Number(value);
    if (!Number.isFinite(year)) return value;
    return year >= 70 ? `19${pad2(value)}` : `20${pad2(value)}`;
}

function normalizeDateToDots(raw?: string | null): string | null {
    const value = (raw || '').trim().replace(/\s+/g, ' ');
    if (!value) return null;

    const dots = value.match(DATE_DOT_RE);
    if (dots) {
        return `${pad2(dots[1])}.${pad2(dots[2])}.${normalizeYear(dots[3])}`;
    }

    const ru = value.match(/\b(\d{1,2})\s+([\u0430-\u044f\u0451]+)\s+(\d{4})\b/iu);
    if (!ru) return null;

    const month = RU_MONTHS[ru[2].toLowerCase()];
    if (!month) return null;
    return `${pad2(ru[1])}.${month}.${ru[3]}`;
}

function normalizeText(text: string): string {
    return text
        .replace(/\u00A0/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
}

function normalizeOrderNumber(raw: string): string {
    return raw
        .replace(/[«»"]/g, '')
        .replace(/\s*-\s*/g, '-')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function parseOrderNumberFromText(text: string): string | null {
    const match = text.match(
        /\u0417\u0430\u043a\u0430\u0437\u0443?\s*(?:\u2116|No)\s*([A-Z\u0410-\u042f\u04010-9][A-Z\u0410-\u042f\u04010-9\s\-\/]{3,}?)(?=\s+(\u043e\u0442|\u043a|\u043d\u0430)\b|\n|$)/iu
    );
    if (!match?.[1]) return null;
    const normalized = normalizeOrderNumber(match[1]);
    return normalized || null;
}

function parseOrderDateFromText(text: string): string | null {
    const nearOrder = text.match(
        /\u0417\u0430\u043a\u0430\u0437\u0443?\s*(?:\u2116|No)\s*[A-Z\u0410-\u042f\u04010-9\-\/]{3,}(?:\s+[A-Z\u0410-\u042f\u0401]{2,8})?\s+\u043e\u0442\s+([0-3]?\d\s+[\u0430-\u044f\u0451]+\s+\d{4}|[0-3]?\d\.[01]?\d\.\d{2,4})/iu
    );
    if (nearOrder?.[1]) {
        return normalizeDateToDots(nearOrder[1]);
    }

    const fallback = text.match(/\b\u043e\u0442\s+([0-3]?\d\s+[\u0430-\u044f\u0451]+\s+\d{4})\s*\u0433?\.?/iu);
    if (fallback?.[1]) {
        return normalizeDateToDots(fallback[1]);
    }
    return null;
}

function parseOrderSignDateFromText(text: string): string | null {
    const senderMatch = text.match(
        /\u041f\u043e\u0434\u043f\u0438\u0441\u0438\s*\u043e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u0435\u043b\u044f\s*:\s*(\d{1,2}\.\d{1,2}\.\d{2,4})/iu
    );
    if (senderMatch?.[1]) {
        return normalizeDateToDots(senderMatch[1]);
    }

    const receiverMatch = text.match(
        /\u041f\u043e\u0434\u043f\u0438\u0441\u0438\s*\u043f\u043e\u043b\u0443\u0447\u0430\u0442\u0435\u043b\u044f\s*:\s*(\d{1,2}\.\d{1,2}\.\d{2,4})/iu
    );
    if (receiverMatch?.[1]) {
        return normalizeDateToDots(receiverMatch[1]);
    }

    const receiverMarker = text
        .toLowerCase()
        .indexOf('\u043f\u043e\u0434\u043f\u0438\u0441\u0438 \u043f\u043e\u043b\u0443\u0447\u0430\u0442\u0435\u043b\u044f');
    if (receiverMarker > 0) {
        const window = text.slice(Math.max(0, receiverMarker - 500), receiverMarker);
        const candidates = [...window.matchAll(/\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/g)];
        if (candidates.length > 0) {
            return normalizeDateToDots(candidates[candidates.length - 1][0]);
        }
    }

    return null;
}

function parseFromFilename(filename?: string): Partial<ParsedOrderDocument> {
    const cleanName = (filename || '').replace(/\.[^.]+$/, '');
    if (!cleanName) return {};

    const data: Partial<ParsedOrderDocument> = {};
    const numberMatch = cleanName.match(/(?:\u2116|No)\s*([^]+?)\s+\u043e\u0442\s+\d{1,2}\.\d{1,2}\.\d{2,4}/iu);
    if (numberMatch?.[1]) {
        data.orderNumber = normalizeOrderNumber(numberMatch[1]);
    }

    const dateMatch = cleanName.match(/\u043e\u0442\s+(\d{1,2}\.\d{1,2}\.\d{2,4})/iu);
    if (dateMatch?.[1]) {
        data.orderDate = normalizeDateToDots(dateMatch[1]);
    }
    return data;
}

export function parseOrderDocumentData(text: string, filename?: string): ParsedOrderDocument {
    const normalizedText = normalizeText(text);
    const fromText: ParsedOrderDocument = {
        orderNumber: parseOrderNumberFromText(normalizedText),
        orderDate: parseOrderDateFromText(normalizedText),
        orderSignDate: parseOrderSignDateFromText(normalizedText),
    };

    const fromFilename = parseFromFilename(filename);
    return {
        orderNumber: fromText.orderNumber || fromFilename.orderNumber || null,
        orderDate: fromText.orderDate || fromFilename.orderDate || null,
        orderSignDate: fromText.orderSignDate || null,
    };
}

export function dotsDateToInputDate(value?: string | null): string | null {
    if (!value) return null;
    const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!match) return null;
    return `${match[3]}-${match[2]}-${match[1]}`;
}
