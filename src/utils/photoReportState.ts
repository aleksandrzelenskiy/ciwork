export type PhotoReportRole = 'admin' | 'manager' | 'viewer' | 'executor' | null;

export type PhotoReportPermissions = {
    canApprove: boolean;
    canUploadFix: boolean;
    canEdit: boolean;
    canDownload: boolean;
};

const EDIT_BLOCKED_STATUSES = new Set(['Agreed']);
const APPROVE_BLOCKED_STATUSES = new Set(['Agreed', 'Draft']);
const FIX_UPLOAD_STATUSES = new Set(['Issues', 'Fixed']);

export const getPhotoReportPermissions = (params: {
    role: PhotoReportRole;
    status: string;
}): PhotoReportPermissions => {
    const { role, status } = params;
    const canApprove =
        (role === 'admin' || role === 'manager' || role === 'viewer') &&
        !APPROVE_BLOCKED_STATUSES.has(status);
    const canUploadFix = role === 'executor' && FIX_UPLOAD_STATUSES.has(status);
    const canEdit = role === 'executor' && !EDIT_BLOCKED_STATUSES.has(status);
    const canDownload = status === 'Agreed';

    return { canApprove, canUploadFix, canEdit, canDownload };
};
