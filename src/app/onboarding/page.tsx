'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Container,
  TextField,
  Paper,
  Stack,
  Chip,
  Button,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import Autocomplete from '@mui/material/Autocomplete';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import EngineeringIcon from '@mui/icons-material/Engineering';
import RoleCard from '@/features/onboarding/RoleCard';
import type { ProfileType } from '@/server/models/UserModel';
import {
  RUSSIAN_REGIONS,
  type RegionOption,
} from '@/app/utils/regions';
import type { Theme } from '@mui/material/styles';
import { UI_RADIUS } from '@/config/uiTokens';
import { CONSENT_VERSION } from '@/config/legal';
import { ConsentContent, PrivacyContent, UserAgreementContent } from '@/features/legal/LegalText';
import { withBasePath } from '@/utils/basePath';
import { useI18n } from '@/i18n/I18nProvider';
import type { ContractorSpecialization } from '@/app/types/specializations';

type ProfileResponse = {
  profileType?: ProfileType;
  profileSetupCompleted?: boolean;
  name?: string;
  phone?: string;
  regionCode?: string;
  user?: {
    name?: string;
    phone?: string;
    regionCode?: string;
  };
  error?: string;
};

type ProfileFormValues = {
  firstName: string;
  lastName: string;
  phone: string;
  regionCode: string;
};

const parseNameParts = (rawName?: string) => {
  if (!rawName) {
    return { firstName: '', lastName: '' };
  }
  const trimmed = rawName.trim();
  if (!trimmed || trimmed.includes('@')) {
    return { firstName: '', lastName: '' };
  }
  const parts = trimmed.split(/\s+/);
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ');
  return { firstName, lastName };
};

const normalizePhoneInput = (input: string) => {
  const digitsOnly = input.replace(/\D/g, '');
  if (!digitsOnly) {
    return '';
  }

  let normalized = digitsOnly;
  if (normalized.startsWith('8')) {
    normalized = `7${normalized.slice(1)}`;
  } else if (normalized.startsWith('9')) {
    normalized = `7${normalized}`;
  } else if (!normalized.startsWith('7')) {
    normalized = `7${normalized}`;
  }

  normalized = normalized.slice(0, 11);
  return `+${normalized}`;
};

const isPhoneValid = (value: string) => /^\+7\d{10}$/.test(value);

// ----- layout constants -----
const LAYOUT_MAX_WIDTH = 1080;
const FIELD_MAX_WIDTH = 520;
const PAGE_PADDING_X = { xs: 2, sm: 3, md: 4 };

export default function OnboardingPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingType, setSavingType] = useState<ProfileType | null>(null);
  const [selectedType, setSelectedType] = useState<ProfileType | null>(null);
  const [roleStepVisible, setRoleStepVisible] = useState(false);
  const roleSectionRef = useRef<HTMLDivElement | null>(null);
  const [specializations, setSpecializations] = useState<ContractorSpecialization[]>([]);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [legalDialogOpen, setLegalDialogOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<'summary' | 'agreement' | 'consent' | 'privacy'>('summary');
  const [formValues, setFormValues] = useState<ProfileFormValues>({
    firstName: '',
    lastName: '',
    phone: '',
    regionCode: '',
  });
  const roleOptions = useMemo(() => ([
    {
      type: 'employer' as const,
      title: t('onboarding.role.employer.title', 'ЗАКАЗЧИК'),
      description: t(
        'onboarding.role.employer.description',
        'Создаю задачи и управляю исполнителями внутри собственной организации.',
      ),
      helperText: t(
        'onboarding.role.employer.helper',
        '* Можно приглашать коллег, создавать проекты и управлять воронкой задач.',
      ),
      icon: <BusinessCenterIcon color='inherit' sx={{ fontSize: 44 }} />,
    },
    {
      type: 'contractor' as const,
      title: t('onboarding.role.contractor.title', 'ИСПОЛНИТЕЛЬ'),
      description: t(
        'onboarding.role.contractor.description',
        'Работаю по приглашению или как независимый подрядчик, мне нужен быстрый доступ к задачам.',
      ),
      helperText: t(
        'onboarding.role.contractor.helper',
        '* Базовые функции бесплатны. Расширенный функционал по подписке.',
      ),
      icon: <EngineeringIcon color='inherit' sx={{ fontSize: 44 }} />,
    },
  ]), [t]);

  useEffect(() => {
    if (roleStepVisible && roleSectionRef.current) {
      roleSectionRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }, [roleStepVisible]);

  useEffect(() => {
    let mounted = true;
    const fetchProfile = async () => {
      try {
        const res = await fetch(withBasePath('/api/current-user'), { cache: 'no-store' });
        const data: ProfileResponse = await res.json();
        if (!mounted) return;
        if (!res.ok) {
          setError(data.error || t('onboarding.error.loadProfile', 'Не удалось загрузить профиль'));
        } else {
          const userPayload = data.user || {};
          const resolvedProfileType: ProfileType | null =
              data.profileType ??
              ((userPayload as { profileType?: ProfileType }).profileType ?? null);
          const onboardingCompleteRedirect =
              resolvedProfileType === 'employer' ? '/org/new' : '/';
          const resolvedName = data.name || userPayload?.name || '';
          const { firstName: derivedFirst, lastName: derivedLast } =
              parseNameParts(resolvedName);
          const resolvedPhone =
              data.phone ||
              (userPayload as { phone?: string } | undefined)?.phone ||
              '';
          const resolvedRegionCode =
              data.regionCode ||
              (userPayload as { regionCode?: string } | undefined)?.regionCode ||
              '';
          setFormValues({
            firstName: derivedFirst,
            lastName: derivedLast,
            phone: normalizePhoneInput(resolvedPhone),
            regionCode: resolvedRegionCode,
          });
          if (data.profileSetupCompleted) {
            router.replace(onboardingCompleteRedirect);
            return;
          }
        }
      } catch (err) {
        if (!mounted) return;
        setError(
            err instanceof Error
                ? err.message
                : t('onboarding.error.loadProfileUser', 'Не удалось загрузить профиль пользователя')
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchProfile();
    return () => {
      mounted = false;
    };
  }, [router, t]);

  const getTrimmedFormValues = () => {
    const trimmed = {
      firstName: formValues.firstName.trim(),
      lastName: formValues.lastName.trim(),
      phone: formValues.phone.trim(),
      regionCode: formValues.regionCode.trim(),
    };

    if (
        !trimmed.firstName ||
        !trimmed.lastName ||
        !trimmed.phone ||
        !trimmed.regionCode
    ) {
      setError(t('onboarding.error.missingFields', 'Пожалуйста, заполните личные данные и выберите регион.'));
      return null;
    }

    if (!isPhoneValid(trimmed.phone)) {
      setError(t('onboarding.error.phoneInvalid', 'Введите номер телефона в формате +7XXXXXXXXXX.'));
      return null;
    }

    return trimmed;
  };

  const handleContinue = () => {
    if (!consentAccepted) {
      setError(t('onboarding.error.consentRequired', 'Для продолжения примите согласие на обработку персональных данных.'));
      return;
    }
    const trimmed = getTrimmedFormValues();
    if (!trimmed) {
      return;
    }
    setError(null);
    setRoleStepVisible(true);
  };

  const submitProfile = async (profileType: ProfileType) => {
    if (!consentAccepted) {
      setError(t('onboarding.error.consentRequired', 'Для продолжения примите согласие на обработку персональных данных.'));
      return;
    }
    const trimmedValues = getTrimmedFormValues();
    if (!trimmedValues) {
      return;
    }

    if (profileType === 'contractor' && specializations.length === 0) {
      setError(
          t(
              'onboarding.specializations.error',
              'Выберите хотя бы одну специализацию исполнителя.'
          )
      );
      return;
    }

    setSelectedType(profileType);
    setSavingType(profileType);
    setError(null);
    try {
      const res = await fetch(withBasePath('/api/current-user/onboarding'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileType,
          specializations: profileType === 'contractor' ? specializations : undefined,
          ...trimmedValues,
          consentAccepted,
          consentVersion: CONSENT_VERSION,
          consentAcceptedAt: consentAccepted ? new Date().toISOString() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || t('onboarding.error.saveFailed', 'Не удалось сохранить выбор'));
        return;
      }

      const onboardingCompleteRedirect =
          profileType === 'employer' ? '/org/new' : '/';

      router.replace(onboardingCompleteRedirect);
    } catch (err) {
      setError(
          err instanceof Error ? err.message : t('onboarding.error.saveFailed', 'Ошибка при сохранении выбора')
      );
    } finally {
      setSavingType(null);
    }
  };

  const handleSelect = async (profileType: ProfileType) => {
    if (profileType === 'contractor') {
      setSelectedType('contractor');
      setError(null);
      return;
    }
    await submitProfile(profileType);
  };

  const handleConfirmContractor = async () => {
    await submitProfile('contractor');
  };

  // ---- layout helpers ----
  const fieldSx = {
    width: '100%',
    backgroundColor: (theme: Theme) =>
        theme.palette.mode === 'dark'
            ? 'rgba(255,255,255,0.02)'
            : 'rgba(255,255,255,0.96)',
  };

  const formItemWrapperSx = {
    display: 'flex',
    justifyContent: 'center',
    width: '100%',
  };

  const phoneDigits = formValues.phone.replace(/\D/g, '');
  const phoneHasValue = Boolean(formValues.phone.trim());
  const showPhoneLengthError =
      Boolean(phoneDigits) && phoneDigits.length > 0 && phoneDigits.length < 11;
  const phoneFormatInvalid = phoneHasValue && !isPhoneValid(formValues.phone);
  const phoneHelperText = showPhoneLengthError
      ? t('onboarding.phone.helper', 'Номер должен содержать 11 цифр')
      : undefined;

  const isFormValid =
      Boolean(formValues.firstName.trim()) &&
      Boolean(formValues.lastName.trim()) &&
      Boolean(formValues.regionCode.trim()) &&
      isPhoneValid(formValues.phone);
  const canContinue = isFormValid && consentAccepted;

  const currentRegion: RegionOption | null =
      RUSSIAN_REGIONS.find((region) => region.code === formValues.regionCode) ??
      null;

  const openLegalDialog = (tab: 'summary' | 'agreement' | 'consent' | 'privacy') => {
      setLegalTab(tab);
      setLegalDialogOpen(true);
  };

  if (loading) {
    return (
        <Box
            sx={{
              minHeight: '100vh',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
        >
          <CircularProgress />
        </Box>
    );
  }

  if (error) {
    return (
        <Box sx={{ maxWidth: FIELD_MAX_WIDTH, mx: 'auto', mt: 8, px: 2 }}>
          <Alert severity='error'>{error}</Alert>
        </Box>
    );
  }

  return (
      <Box
          sx={{
            minHeight: '100vh',
            background: (theme) =>
                theme.palette.mode === 'dark'
                    ? 'radial-gradient(circle at 20% 20%, rgba(71, 118, 230, 0.12), transparent 38%), radial-gradient(circle at 82% 18%, rgba(86, 204, 242, 0.12), transparent 34%), linear-gradient(150deg, #0b0d11 0%, #131722 55%, #0c1017 100%)'
                    : 'radial-gradient(circle at 18% 22%, rgba(71, 118, 230, 0.12), transparent 36%), radial-gradient(circle at 84% 16%, rgba(86, 204, 242, 0.14), transparent 36%), linear-gradient(135deg, #f7f9fd 0%, #e8ecf4 52%, #f5f7fb 100%)',
            pt: { xs: 4, md: 6 },
            pb: { xs: 7, md: 10 },
            display: 'flex',
            alignItems: 'stretch',
          }}
      >
        <Container maxWidth='lg' disableGutters sx={{ position: 'relative' }}>
          <Box
              sx={{
                position: 'absolute',
                top: { xs: -60, md: -100 },
                right: -80,
                width: { xs: 240, md: 320 },
                height: { xs: 240, md: 320 },
                bgcolor: 'primary.main',
                opacity: 0.25,
                filter: 'blur(130px)',
                zIndex: 0,
              }}
          />
          <Box
              sx={{
                position: 'absolute',
                bottom: { xs: -90, md: -120 },
                left: -60,
                width: { xs: 260, md: 340 },
                height: { xs: 260, md: 340 },
                bgcolor: 'secondary.main',
                opacity: 0.2,
                filter: 'blur(140px)',
                zIndex: 0,
              }}
          />

          <Box
              sx={{
                position: 'relative',
                zIndex: 1,
                maxWidth: LAYOUT_MAX_WIDTH,
                mx: 'auto',
                px: PAGE_PADDING_X,
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: { xs: 3.5, md: 4.5 },
              }}
          >
            <Stack spacing={1.5} textAlign='center' alignItems='center'>
              <Chip
                  label={t('onboarding.step1', 'Шаг 1 из 2')}
                  color='default'
                  sx={{
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    px: 1.5,
                  }}
              />
              <Typography
                  variant='h3'
                  fontWeight={700}
                  sx={{
                    fontSize: { xs: '1.75rem', md: '2.75rem' },
                    lineHeight: { xs: 1.25, md: 1.3 },
                  }}
              >
                {t('onboarding.title', 'Настройте ваш профиль')}
              </Typography>
              <Typography
                  color='text.secondary'
                  sx={{
                    maxWidth: 640,
                    fontSize: { xs: '0.95rem', md: '1.02rem' },
                  }}
              >
                {t('onboarding.subtitle', 'Сконцентрируйтесь на основном: заполните контакты и выберите подходящую роль, чтобы мы подготовили среду под ваши задачи.')}
              </Typography>
            </Stack>

            <Stack spacing={{ xs: 3, md: 4 }} sx={{ width: '100%' }}>
              <Paper
                  elevation={0}
                  sx={{
                    borderRadius: UI_RADIUS.surface,
                    border: '1px solid',
                    borderColor: (theme) =>
                        theme.palette.mode === 'dark'
                            ? 'rgba(255,255,255,0.12)'
                            : 'rgba(15,23,42,0.06)',
                    backgroundColor: (theme) =>
                        theme.palette.mode === 'dark'
                            ? 'rgba(11,14,20,0.9)'
                            : 'rgba(255,255,255,0.95)',
                    backdropFilter: 'blur(16px)',
                    p: { xs: 2.5, sm: 3, md: 4 },
                    boxShadow: (theme) =>
                        theme.palette.mode === 'dark'
                            ? '0 20px 70px rgba(0,0,0,0.55)'
                            : '0 22px 70px rgba(15,23,42,0.08)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
              >
                <Box
                    sx={{
                      width: '100%',
                      maxWidth: FIELD_MAX_WIDTH,
                      mx: 'auto',
                      px: { xs: 1, sm: 2, md: 0 },
                      display: 'flex',
                      flexDirection: 'column',
                      gap: { xs: 2.5, md: 3 },
                      alignItems: 'center',
                    }}
                >
                  <Stack
                      spacing={1}
                      alignItems='center'
                      sx={{ width: '100%', textAlign: 'center' }}
                  >
                    <Typography variant='h6' fontWeight={700}>
                      {t('onboarding.contacts.title', 'Контактные данные')}
                    </Typography>
                    <Typography color='text.secondary'>
                      {t('onboarding.contacts.note', 'Эти данные будут видны только вашей команде.')}
                    </Typography>
                  </Stack>

                  <Grid
                      container
                      spacing={2}
                      direction='column'
                      wrap='nowrap'
                      sx={{ width: '100%' }}
                  >
                    <Grid sx={formItemWrapperSx}>
                      <TextField
                          label={t('onboarding.form.firstName', 'Имя')}
                          fullWidth
                          sx={fieldSx}
                          value={formValues.firstName}
                          onChange={(event) =>
                              setFormValues((prev) => ({
                                ...prev,
                                firstName: event.target.value,
                              }))
                          }
                      />
                    </Grid>
                    <Grid sx={formItemWrapperSx}>
                      <TextField
                          label={t('onboarding.form.lastName', 'Фамилия')}
                          fullWidth
                          sx={fieldSx}
                          value={formValues.lastName}
                          onChange={(event) =>
                              setFormValues((prev) => ({
                                ...prev,
                                lastName: event.target.value,
                              }))
                          }
                      />
                    </Grid>
                    <Grid sx={formItemWrapperSx}>
                      <TextField
                          label={t('onboarding.form.phone', 'Телефон')}
                          fullWidth
                          sx={fieldSx}
                          type='tel'
                          value={formValues.phone}
                          onChange={(event) =>
                              setFormValues((prev) => ({
                                ...prev,
                                phone: normalizePhoneInput(event.target.value),
                              }))
                          }
                          error={Boolean(showPhoneLengthError) || phoneFormatInvalid}
                          helperText={phoneHelperText}
                          placeholder={t('onboarding.form.phonePlaceholder', '+7XXXXXXXXXX')}
                          slotProps={{ htmlInput: { inputMode: 'tel' } }}
                      />
                    </Grid>
                    <Grid sx={formItemWrapperSx}>
                      <Autocomplete<RegionOption, false, false, false>
                          value={currentRegion}
                          options={RUSSIAN_REGIONS as RegionOption[]}
                          fullWidth
                          onChange={(_, newValue) =>
                              setFormValues((prev) => ({
                                ...prev,
                                regionCode: newValue?.code ?? '',
                              }))
                          }
                          getOptionLabel={(option) =>
                              `${option.code} - ${option.label}`
                          }
                          renderInput={(params) => (
                              <TextField
                                  {...params}
                                  label={t('onboarding.form.region', 'Регион')}
                                  fullWidth
                                  sx={fieldSx}
                              />
                          )}
                      />
                    </Grid>
                  </Grid>

                  <Typography
                      variant='body2'
                      color='text.secondary'
                      sx={{ textAlign: 'center', maxWidth: 420 }}
                  >
                    {t('onboarding.contacts.privacyNote', 'Мы никому не передаём контакты без вашего согласия и используем их только для уведомлений.')}
                  </Typography>

                  <Stack spacing={1.5} sx={{ width: '100%' }}>
                    <Stack direction='row' spacing={1} alignItems='flex-start'>
                      <FormControlLabel
                          sx={{ alignItems: 'flex-start', m: 0, flex: 1 }}
                          control={(
                              <Checkbox
                                  checked={consentAccepted}
                                  onChange={(event) => {
                                    setConsentAccepted(event.target.checked);
                                    if (event.target.checked) {
                                      setError(null);
                                    }
                                  }}
                              />
                          )}
                          label={(
                              <Typography variant='body2' color='text.secondary'>
                                {t('onboarding.consent.prefix', 'Я принимаю')}{' '}
                                <Link
                                    component='button'
                                    type='button'
                                    onClick={() => openLegalDialog('agreement')}
                                    sx={{ cursor: 'pointer' }}
                                >
                                  {t('onboarding.consent.agreement', 'Пользовательское соглашение')}
                                </Link>{' '}
                                {t('onboarding.consent.and', 'и даю')}{' '}
                                <Link
                                    component='button'
                                    type='button'
                                    onClick={() => openLegalDialog('consent')}
                                    sx={{ cursor: 'pointer' }}
                                >
                                  {t('onboarding.consent.consent', 'согласие')}
                                </Link>{' '}
                                {t('onboarding.consent.processing', 'на обработку персональных данных, ознакомлен(а) с')}{' '}
                                <Link
                                    component='button'
                                    type='button'
                                    onClick={() => openLegalDialog('privacy')}
                                    sx={{ cursor: 'pointer' }}
                                >
                                  {t('onboarding.consent.privacy', 'политикой конфиденциальности')}
                                </Link>
                                .
                              </Typography>
                          )}
                      />
                      <Button
                          size='small'
                          variant='text'
                          onClick={() => openLegalDialog('summary')}
                      >
                        {t('onboarding.consent.more', 'Что это значит?')}
                      </Button>
                    </Stack>
                  </Stack>

                  <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        width: '100%',
                      }}
                  >
                    <Button
                        variant='contained'
                        size='large'
                        onClick={handleContinue}
                        disabled={!canContinue}
                        sx={{ minWidth: 180 }}
                    >
                      {t('onboarding.next', 'Далее')}
                    </Button>
                  </Box>
                </Box>
              </Paper>

              {roleStepVisible && (
                  <Stack
                      spacing={3}
                      textAlign='center'
                      ref={roleSectionRef}
                      sx={{
                        alignItems: 'center',
                        width: '100%',
                      }}
                  >
                    <Chip
                        label={t('onboarding.step2', 'Шаг 2 из 2')}
                        color='default'
                        sx={{
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: 1,
                          px: 1.5,
                        }}
                    />
                    <Typography color='text.secondary'>
                      {t('onboarding.step2.subtitle', 'Выберите сценарий, чтобы мы подготовили нужные панели и доступы.')}
                    </Typography>

                    {/* общий контейнер для двух плиток, строго по центру */}
                    <Box
                        sx={{
                          width: '100%',
                          maxWidth: 2 * FIELD_MAX_WIDTH + 32, // две карты + примерный gap
                          mx: 'auto',
                          px: { xs: 1, sm: 0 },
                        }}
                    >
                      <Grid
                          container
                          spacing={2.5}
                          justifyContent='center'
                          alignItems='flex-start'
                      >
                        {roleOptions.map((option) => {
                            const isContractorOption = option.type === 'contractor';
                            const showSpecializations = isContractorOption && selectedType === 'contractor';
                            const contractorExtraContent = isContractorOption ? (
                                <Stack spacing={2} alignItems="stretch">
                                    <Typography variant="body2" color="text.secondary">
                                        {t(
                                            'onboarding.specializations.helper',
                                            'Выберите направления, по которым готовы выполнять задачи.'
                                        )}
                                    </Typography>
                                    <FormGroup>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={specializations.includes('installation')}
                                                    onChange={() => {
                                                        setSpecializations((prev) =>
                                                            prev.includes('installation')
                                                                ? prev.filter((item) => item !== 'installation')
                                                                : [...prev, 'installation']
                                                        );
                                                    }}
                                                />
                                            }
                                            label={t('onboarding.specializations.installation', 'Монтаж / строительство')}
                                        />
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={specializations.includes('document')}
                                                    onChange={() => {
                                                        setSpecializations((prev) =>
                                                            prev.includes('document')
                                                                ? prev.filter((item) => item !== 'document')
                                                                : [...prev, 'document']
                                                        );
                                                    }}
                                                />
                                            }
                                            label={t('onboarding.specializations.document', 'Проектирование / документация')}
                                        />
                                    </FormGroup>
                                    <Button
                                        variant="contained"
                                        onClick={handleConfirmContractor}
                                        disabled={Boolean(savingType) || specializations.length === 0}
                                        sx={{ borderRadius: UI_RADIUS.button }}
                                    >
                                        {savingType === 'contractor'
                                            ? t('onboarding.role.saving', 'Сохраняем...')
                                            : t('onboarding.specializations.confirm', 'Подтвердить')}
                                    </Button>
                                </Stack>
                            ) : null;

                            return (
                            <Grid
                                size={{ xs: 12, sm: 6 }}
                                key={option.type}
                                sx={{
                                  display: 'flex',
                                  justifyContent: 'center',
                                }}
                            >
                              <Box
                                  sx={{
                                    width: '100%',
                                    maxWidth: FIELD_MAX_WIDTH,
                                  }}
                              >
                                <RoleCard
                                    title={option.title}
                                    description={option.description}
                                    helperText={option.helperText}
                                    onSelect={() => handleSelect(option.type)}
                                    disabled={!canContinue || Boolean(savingType)}
                                    selected={selectedType === option.type}
                                    icon={option.icon}
                                    actionLabel={
                                      savingType === option.type
                                          ? t('onboarding.role.saving', 'Сохраняем...')
                                          : t('onboarding.role.select', 'Выбрать')
                                    }
                                    extraContent={contractorExtraContent}
                                    showExtraContent={showSpecializations}
                                />
                              </Box>
                            </Grid>
                            );
                        })}
                      </Grid>
                    </Box>

                    <Typography variant='body2' color='text.secondary'>
                      {t('onboarding.role.note', 'Исполнители работают с задачами напрямую, а заказчики управляют командами и бюджетами.')}
                    </Typography>
                  </Stack>
              )}
            </Stack>

            {/* Футер-пояснение */}
            <Paper
                variant='outlined'
                sx={{
                  mt: 5,
                  borderRadius: UI_RADIUS.tooltip,
                  p: { xs: 2.5, md: 3 },
                  textAlign: 'center',
                  backgroundColor: (theme) =>
                      theme.palette.mode === 'dark'
                          ? 'rgba(15, 20, 30, 0.6)'
                          : 'rgba(255,255,255,0.85)',
                  borderColor: (theme) =>
                      theme.palette.mode === 'dark'
                          ? 'rgba(255,255,255,0.08)'
                          : 'rgba(15,23,42,0.08)',
                }}
            >
              <Typography variant='body2' color='text.secondary'>
                {t('onboarding.footerNote', 'Все настройки можно обновить позже в профиле. После заполнения мы мгновенно перенаправим вас в рабочее пространство.')}
              </Typography>
            </Paper>
          </Box>
        </Container>

        <Dialog
            open={legalDialogOpen}
            onClose={() => setLegalDialogOpen(false)}
            fullWidth
            maxWidth='md'
        >
          <DialogTitle>{t('onboarding.legal.title', 'Правовая информация')}</DialogTitle>
          <DialogContent dividers sx={{ p: 0 }}>
            <Tabs
                value={legalTab}
                onChange={(_, value) =>
                    setLegalTab(value as 'summary' | 'agreement' | 'consent' | 'privacy')
                }
                variant='fullWidth'
            >
              <Tab label={t('onboarding.legal.tab.summary', 'Коротко')} value='summary' />
              <Tab label={t('onboarding.legal.tab.agreement', 'Соглашение')} value='agreement' />
              <Tab label={t('onboarding.legal.tab.consent', 'Согласие')} value='consent' />
              <Tab label={t('onboarding.legal.tab.privacy', 'Политика')} value='privacy' />
            </Tabs>
            <Box
                sx={{
                  px: { xs: 2.5, sm: 3 },
                  py: { xs: 2.5, sm: 3 },
                  maxHeight: { xs: '60vh', md: '65vh' },
                  overflow: 'auto',
                }}
            >
              {legalTab === 'summary' && (
                  <Stack spacing={2}>
                    <Typography variant='h6' fontWeight={700}>
                      ICIA Workspace
                    </Typography>
                    <Stack component='ul' spacing={1.5} sx={{ pl: 2, m: 0 }}>
                      <Typography component='li' variant='body2'>
                        {t('onboarding.legal.summary.data', 'Данные (ФИО, телефон, email, регион) нужны для регистрации и работы сервиса.')}
                      </Typography>
                    <Typography component='li' variant='body2'>
                      {t('onboarding.legal.summary.contacts', 'Контакты могут быть видны другим пользователям только в рамках задач или организации.')}
                    </Typography>
                    <Typography component='li' variant='body2'>
                      {t('onboarding.legal.summary.chat', 'Сообщения и медиа в чате используются только для выполнения задач.')}
                    </Typography>
                    <Typography component='li' variant='body2'>
                      {t('onboarding.legal.summary.docs', 'Документы (сметы/заказы), загружаемые пользователем, могут содержать данные третьих лиц, ответственность за законность загрузки лежит на пользователе.')}
                    </Typography>
                    <Typography component='li' variant='body2'>
                      {t('onboarding.legal.summary.storage', 'Данные хранятся на серверах в РФ.')}
                    </Typography>
                    </Stack>
                  </Stack>
              )}
              {legalTab === 'agreement' && <UserAgreementContent />}
              {legalTab === 'consent' && <ConsentContent />}
              {legalTab === 'privacy' && <PrivacyContent />}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setLegalDialogOpen(false)}>{t('common.close', 'Закрыть')}</Button>
          </DialogActions>
        </Dialog>
      </Box>
  );
}
