const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const trimmedBasePath = rawBasePath.replace(/\/+$/, '');

export const BASE_PATH = trimmedBasePath
    ? trimmedBasePath.startsWith('/')
        ? trimmedBasePath
        : `/${trimmedBasePath}`
    : '';

export const withBasePath = (path: string): string => {
    if (!path) {
        return BASE_PATH || '/';
    }
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    if (!BASE_PATH) {
        return normalizedPath;
    }
    if (normalizedPath === BASE_PATH || normalizedPath.startsWith(`${BASE_PATH}/`)) {
        return normalizedPath;
    }
    return `${BASE_PATH}${normalizedPath}`;
};
