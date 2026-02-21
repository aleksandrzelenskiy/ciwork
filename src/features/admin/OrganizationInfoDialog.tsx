'use client';

import * as React from 'react';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Button,
    Stack,
    Typography,
    Tooltip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { UI_RADIUS } from '@/config/uiTokens';

type Plan = 'basic' | 'pro' | 'business' | 'enterprise';
type LegalForm = 'ООО' | 'ИП' | 'АО' | 'ЗАО';

export type OrganizationProfileData = {
    plan?: Plan;
    legalForm?: LegalForm;
    organizationName?: string;
    legalAddress?: string;
    inn?: string;
    kpp?: string;
    ogrn?: string;
    okpo?: string;
    bik?: string;
    bankName?: string;
    correspondentAccount?: string;
    settlementAccount?: string;
    directorTitle?: string;
    directorName?: string;
    directorBasis?: string;
    contacts?: string;
};

type OrganizationInfoData = {
    name: string;
    orgSlug: string;
    ownerName?: string;
    ownerEmail?: string;
    ownerPhone?: string;
    profile?: OrganizationProfileData;
};

type OrganizationInfoDialogProps = {
    open: boolean;
    organization: OrganizationInfoData | null;
    onCloseAction: () => void;
};

export default function OrganizationInfoDialog({
    open,
    organization,
    onCloseAction,
}: OrganizationInfoDialogProps) {
    const profile = organization?.profile;
    const legalForm = profile?.legalForm;
    const isIndividualEntrepreneur = legalForm === 'ИП';
    const requisitesTitle =
        profile?.organizationName?.trim() || organization?.name || 'организации';

    return (
        <Dialog open={open} onClose={onCloseAction} maxWidth="md" fullWidth>
            <DialogTitle>Информация об организации</DialogTitle>
            <DialogContent dividers>
                {organization ? (
                    <Stack spacing={2}>
                        <Box>
                            <Typography variant="subtitle1" fontWeight={700}>
                                {organization.name || '—'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {organization.orgSlug}
                            </Typography>
                        </Box>
                        <Typography variant="body2">
                            <strong>Владелец:</strong>{' '}
                            <Tooltip
                                title={
                                    <Stack spacing={0.25} sx={{ py: 0.5 }}>
                                        <Typography variant="caption">
                                            Email: {organization.ownerEmail || '—'}
                                        </Typography>
                                        <Typography variant="caption">
                                            Телефон: {organization.ownerPhone || '—'}
                                        </Typography>
                                    </Stack>
                                }
                                arrow
                                placement="top"
                            >
                                <Typography
                                    component="span"
                                    variant="body2"
                                    sx={{
                                        cursor: 'help',
                                        borderBottom: '1px dashed',
                                        borderColor: 'divider',
                                    }}
                                >
                                    {organization.ownerName || '—'}
                                </Typography>
                            </Tooltip>
                        </Typography>

                        <Accordion
                            disableGutters
                            defaultExpanded
                            sx={{
                                borderRadius: UI_RADIUS.item,
                                '&::before': { display: 'none' },
                            }}
                        >
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography variant="subtitle1">
                                    Реквизиты {requisitesTitle}
                                </Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                {profile ? (
                                    <Stack spacing={1.5}>
                                        <Typography variant="body2">
                                            <strong>Тариф:</strong> {profile.plan?.toUpperCase() || '—'}
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>Форма:</strong> {profile.legalForm || '—'}
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>Наименование:</strong> {profile.organizationName || '—'}
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>Юр. адрес:</strong> {profile.legalAddress || '—'}
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>ИНН / КПП:</strong> {profile.inn || '—'} / {profile.kpp || '—'}
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>ОГРН / ОГРНИП:</strong> {profile.ogrn || '—'}
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>ОКПО:</strong> {profile.okpo || '—'}
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>Банк:</strong> {profile.bankName || '—'}
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>БИК:</strong> {profile.bik || '—'}
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>К/с:</strong> {profile.correspondentAccount || '—'}
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>Р/с:</strong> {profile.settlementAccount || '—'}
                                        </Typography>
                                        {!isIndividualEntrepreneur && (
                                            <>
                                                <Typography variant="body2">
                                                    <strong>Руководитель:</strong> {profile.directorTitle || '—'} — {profile.directorName || '—'}
                                                </Typography>
                                                <Typography variant="body2">
                                                    <strong>Основание:</strong> {profile.directorBasis || '—'}
                                                </Typography>
                                            </>
                                        )}
                                        <Typography variant="body2">
                                            <strong>Контакты:</strong> {profile.contacts || '—'}
                                        </Typography>
                                    </Stack>
                                ) : (
                                    <Typography color="text.secondary">
                                        Реквизиты ещё не заполнены.
                                    </Typography>
                                )}
                            </AccordionDetails>
                        </Accordion>
                    </Stack>
                ) : null}
            </DialogContent>
            <DialogActions>
                <Button onClick={onCloseAction}>Закрыть</Button>
            </DialogActions>
        </Dialog>
    );
}
