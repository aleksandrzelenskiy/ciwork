//app/api/tasks/route.ts

import { jsonData, jsonError } from '@/server/http/response';
import dbConnect from '@/server/db/mongoose';
import { listTasksForCurrentUser } from '@/server/tasks/service';

export async function GET() {
  try {
    await dbConnect();
    console.log('Connected to MongoDB');
  } catch (error: unknown) {
    console.error('Failed to connect to MongoDB:', error);
    return jsonError('Failed to connect to database', 500);
  }

  try {
    const result = await listTasksForCurrentUser();
    if (!result.ok) {
      return jsonError(result.error, 500);
    }

    return jsonData({ tasks: result.tasks });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return jsonError('Failed to fetch tasks', 500);
  }
}
