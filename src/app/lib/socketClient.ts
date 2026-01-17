'use client';

import { NOTIFICATIONS_SOCKET_PATH } from '@/config/socket';
import { withBasePath } from '@/utils/basePath';
import { io, type Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;
let socketPromise: Promise<Socket> | null = null;

export const fetchSocketToken = async (): Promise<string | null> => {
    try {
        const res = await fetch(withBasePath('/api/notifications/socket-auth'), {
            cache: 'no-store',
            credentials: 'include',
        });
        const payload = (await res.json().catch(() => ({}))) as {
            ok?: boolean;
            token?: string;
        };
        if (!res.ok || payload.ok !== true || !payload.token) {
            return null;
        }
        return payload.token;
    } catch (error) {
        console.error('socketClient: failed to fetch token', error);
        return null;
    }
};

const createSocketClient = async (): Promise<Socket> => {
    try {
        await fetch(withBasePath('/api/socket'), { cache: 'no-store', credentials: 'include' });
    } catch (error) {
        console.error('socketClient: failed to warm up socket API', error);
    }
    const token = await fetchSocketToken();
    if (!token) {
        throw new Error('socketClient: socket token is missing');
    }

    const socket = io({
        path: NOTIFICATIONS_SOCKET_PATH,
        transports: ['websocket', 'polling'],
        withCredentials: true,
        auth: { token },
    });

    socketInstance = socket;

    socket.on('disconnect', (reason) => {
        if (reason === 'io server disconnect') {
            socketInstance = null;
        }
    });
    let refreshing = false;
    socket.on('connect_error', async (error: { message?: string }) => {
        socketInstance = null;
        const message = error?.message?.toUpperCase?.() ?? '';
        if (refreshing || (!message.includes('UNAUTHORIZED') && !message.includes('AUTH_FAILED'))) {
            return;
        }
        refreshing = true;
        const freshToken = await fetchSocketToken();
        if (freshToken) {
            socket.auth = { token: freshToken };
            socket.connect();
        }
        refreshing = false;
    });

    return socket;
};

export const getSocketClient = async (): Promise<Socket> => {
    if (socketInstance) {
        return socketInstance;
    }
    if (!socketPromise) {
        socketPromise = createSocketClient().catch((error) => {
            socketPromise = null;
            throw error;
        });
    }
    return socketPromise;
};

export default getSocketClient;
