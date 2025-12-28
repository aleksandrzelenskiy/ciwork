// app/api/reports/route.ts

import { jsonData, jsonError } from '@/server/http/response';
import dbConnect from '@/server/db/mongoose';
import { listReportsForRequest } from '@/server/reports/service';

export async function GET(request: Request) {
  try {
    await dbConnect();
    console.log('Connected to MongoDB');
  } catch (error: unknown) {
    console.error('Failed to connect to MongoDB:', error);
    return jsonError('Failed to connect to database', 500);
  }

  const url = new URL(request.url);
  const token = url.searchParams.get('token')?.trim() || '';
  const result = await listReportsForRequest({ token });
  if (!result.ok) {
    return jsonError(result.error, result.status);
  }

  return jsonData({
    reports: result.reports,
    userRole: result.userRole,
    isSuperAdmin: result.isSuperAdmin,
  });
}
