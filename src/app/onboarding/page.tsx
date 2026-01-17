'use client';

import { useEffect, useState, useRef, type ReactNode } from 'react';
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
import NextLink from 'next/link';
import { CONSENT_VERSION } from '@/config/legal';
import { ConsentContent, PrivacyContent } from '@/features/legal/LegalText';

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

const ROLE_OPTIONS: Array<{
  type: ProfileType;
  title: string;
  description: string;
  helperText?: string;
  icon: ReactNode;
}> = [
  {
    type: 'employer',
    title: 'ЗАКАЗЧИК',
    description:
        'Создаю задачи и управляю исполнителями внутри собственной организации.',
    helperText:
        '* Можно приглашать коллег, создавать проекты и управлять воронкой задач.',
    icon: <BusinessCenterIcon color='inherit' sx={{ fontSize: 44 }} />,
  },
  {
    type: 'contractor',
    title: 'ИСПОЛНИТЕЛЬ',
    description:
        'Работаю по приглашению или как независимый подрядчик, мне нужен быстрый доступ к задачам.',
    helperText:
        '* Базовые функции бесплатны. Расширенный функционал по подписке.',
    icon: <EngineeringIcon color='inherit' sx={{ fontSize: 44 }} />,
  },
];

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
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingType, setSavingType] = useState<ProfileType | null>(null);
  const [selectedType, setSelectedType] = useState<ProfileType | null>(null);
  const [roleStepVisible, setRoleStepVisible] = useState(false);
  const roleSectionRef = useRef<HTMLDivElement | null>(null);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [legalDialogOpen, setLegalDialogOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<'summary' | 'consent' | 'privacy'>('summary');
  const [formValues, setFormValues] = useState<ProfileFormValues>({
    firstName: '',
    lastName: '',
    phone: '',
    regionCode: '',
  });

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
        const res = await fetch('/api/current-user', { cache: 'no-store' });
        const data: ProfileResponse = await res.json();
        if (!mounted) return;
        if (!res.ok) {
          setError(data.error || 'Не удалось загрузить профиль');
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
                : 'Не удалось загрузить профиль пользователя'
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
  }, [router]);

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
      setError('Пожалуйста, заполните личные данные и выберите регион.');
      return null;
    }

    if (!isPhoneValid(trimmed.phone)) {
      setError('Введите номер телефона в формате +7XXXXXXXXXX.');
      return null;
    }

    return trimmed;
  };

  const handleContinue = () => {
    if (!consentAccepted) {
      setError('Для продолжения примите согласие на обработку персональных данных.');
      return;
    }
    const trimmed = getTrimmedFormValues();
    if (!trimmed) {
      return;
    }
    setError(null);
    setRoleStepVisible(true);
  };

  const handleSelect = async (profileType: ProfileType) => {
    if (!consentAccepted) {
      setError('Для продолжения примите согласие на обработку персональных данных.');
      return;
    }
    const trimmedValues = getTrimmedFormValues();
    if (!trimmedValues) {
      return;
    }

    setSelectedType(profileType);
    setSavingType(profileType);
    setError(null);
    try {
      const res = await fetch('/api/current-user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileType,
          ...trimmedValues,
          consentAccepted,
          consentVersion: CONSENT_VERSION,
          consentAcceptedAt: consentAccepted ? new Date().toISOString() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Не удалось сохранить выбор');
        return;
      }

      const onboardingCompleteRedirect =
          profileType === 'employer' ? '/org/new' : '/';

      router.replace(onboardingCompleteRedirect);
    } catch (err) {
      setError(
          err instanceof Error ? err.message : 'Ошибка при сохранении выбора'
      );
    } finally {
      setSavingType(null);
    }
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
      ? 'Номер должен содержать 11 цифр'
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

  const openLegalDialog = (tab: 'summary' | 'consent' | 'privacy') => {
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
                  label='Шаг 1 из 2'
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
                Настройте ваш профиль
              </Typography>
              <Typography
                  color='text.secondary'
                  sx={{
                    maxWidth: 640,
                    fontSize: { xs: '0.95rem', md: '1.02rem' },
                  }}
              >
                Сконцентрируйтесь на основном: заполните контакты и выберите
                подходящую роль, чтобы мы подготовили среду под ваши задачи.
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
                      Контактные данные
                    </Typography>
                    <Typography color='text.secondary'>
                      Эти данные будут видны только вашей команде.
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
                          label='Имя'
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
                          label='Фамилия'
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
                          label='Телефон'
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
                          placeholder='+7XXXXXXXXXX'
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
                                  label='Регион'
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
                    Мы никому не передаём контакты без вашего согласия и используем
                    их только для уведомлений.
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
                                Я принимаю{' '}
                                <Link component={NextLink} href='#'>
                                  Пользовательское соглашение
                                </Link>{' '}
                                и даю{' '}
                                <Link
                                    component='button'
                                    type='button'
                                    onClick={() => openLegalDialog('consent')}
                                    sx={{ cursor: 'pointer' }}
                                >
                                  согласие
                                </Link>{' '}
                                на обработку персональных данных, ознакомлен(а) с{' '}
                                <Link
                                    component='button'
                                    type='button'
                                    onClick={() => openLegalDialog('privacy')}
                                    sx={{ cursor: 'pointer' }}
                                >
                                  политикой конфиденциальности
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
                        Что это значит?
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
                      Далее
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
                        label='Шаг 2 из 2'
                        color='default'
                        sx={{
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: 1,
                          px: 1.5,
                        }}
                    />
                    <Typography color='text.secondary'>
                      Выберите сценарий, чтобы мы подготовили нужные панели и
                      доступы.
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
                          alignItems='stretch'
                      >
                        {ROLE_OPTIONS.map((option) => (
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
                                          ? 'Сохраняем...'
                                          : 'Выбрать'
                                    }
                                />
                              </Box>
                            </Grid>
                        ))}
                      </Grid>
                    </Box>

                    <Typography variant='body2' color='text.secondary'>
                      Исполнители работают с задачами напрямую, а заказчики
                      управляют командами и бюджетами.
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
                Все настройки можно обновить позже в профиле. После заполнения мы
                мгновенно перенаправим вас в рабочее пространство.
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
          <DialogTitle>Правовая информация</DialogTitle>
          <DialogContent dividers sx={{ p: 0 }}>
            <Tabs
                value={legalTab}
                onChange={(_, value) =>
                    setLegalTab(value as 'summary' | 'consent' | 'privacy')
                }
                variant='fullWidth'
            >
              <Tab label='Коротко' value='summary' />
              <Tab label='Согласие' value='consent' />
              <Tab label='Политика' value='privacy' />
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
                  <Stack component='ul' spacing={1.5} sx={{ pl: 2, m: 0 }}>
                    <Typography component='li' variant='body2'>
                      Данные (ФИО, телефон, email, регион) нужны для регистрации и работы
                      сервиса.
                    </Typography>
                    <Typography component='li' variant='body2'>
                      Контакты могут быть видны другим пользователям только в рамках
                      задач или организации.
                    </Typography>
                    <Typography component='li' variant='body2'>
                      Сообщения и медиа в чате используются только для выполнения задач.
                    </Typography>
                    <Typography component='li' variant='body2'>
                      Документы (сметы/заказы), загружаемые пользователем, могут
                      содержать данные третьих лиц, ответственность за законность
                      загрузки лежит на пользователе.
                    </Typography>
                    <Typography component='li' variant='body2'>
                      Данные хранятся на серверах в РФ.
                    </Typography>
                  </Stack>
              )}
              {legalTab === 'consent' && <ConsentContent />}
              {legalTab === 'privacy' && <PrivacyContent />}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setLegalDialogOpen(false)}>Закрыть</Button>
          </DialogActions>
        </Dialog>
      </Box>
  );
}
