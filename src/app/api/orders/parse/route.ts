import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import pdfParse from 'pdf-parse';
import { parseOrderDocumentData } from '@/utils/orderDocumentParser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const user = await currentUser();
        if (!user) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file');
        if (!(file instanceof File)) {
            return NextResponse.json({ error: 'File is required' }, { status: 400 });
        }

        const filename = file.name || '';
        const mime = file.type || '';
        const isPdf = mime === 'application/pdf' || filename.toLowerCase().endsWith('.pdf');

        let text = '';
        if (isPdf) {
            const buffer = Buffer.from(await file.arrayBuffer());
            const parsed = await pdfParse(buffer);
            text = parsed.text || '';
        }

        const parsed = parseOrderDocumentData(text, filename);
        return NextResponse.json(parsed);
    } catch (error) {
        console.error('Order parse failed', error);
        return NextResponse.json(
            {
                orderNumber: null,
                orderDate: null,
                orderSignDate: null,
            },
            { status: 200 }
        );
    }
}

