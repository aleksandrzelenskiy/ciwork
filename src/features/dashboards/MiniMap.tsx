// app/components/dashboards/MiniMap.tsx

'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { YMaps, Map, Placemark, Clusterer } from '@pbe/react-yandex-maps';
import { Box, CircularProgress, Typography, Button } from '@mui/material';
import Link from 'next/link';
import MapIcon from '@mui/icons-material/Map';

import { Task, BsLocation } from '@/app/types/taskTypes';
import type { EffectiveOrgRole } from '@/app/types/roles';
import { isAdminRole } from '@/app/utils/roleGuards';
import {
  OPERATOR_CLUSTER_PRESETS,
  OPERATOR_COLORS,
  normalizeOperator,
} from '@/utils/operatorColors';
import { withBasePath } from '@/utils/basePath';
import { useI18n } from '@/i18n/I18nProvider';

interface MiniMapProps {
  role: EffectiveOrgRole | null; // admin | manager | executor | viewer
  clerkUserId: string; // Текущий userId пользователя (из Clerk)
  showOverlay?: boolean;
  showCta?: boolean;
  ctaLabel?: string;
  ctaHref?: string;
  mapHeight?: number;
}

interface OrgSummary {
  _id: string;
  orgSlug: string;
}

type OrgResponse = { orgs: OrgSummary[] } | { error: string };

export default function MiniMap({
  role,
  clerkUserId,
  showOverlay = true,
  showCta = true,
  ctaLabel,
  ctaHref = '/tasks/locations',
  mapHeight = 400,
}: MiniMapProps) {
  const { t } = useI18n();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgSlugById, setOrgSlugById] = useState<Record<string, string>>({});
  const isPlatformAdmin = role === 'super_admin';
  const shouldUseOrgRoutes = role !== null && role !== 'executor' && !isPlatformAdmin;

  // 1. Загружаем все задачи с /api/tasks
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(withBasePath('/api/tasks'));
        if (!res.ok) {
          setError(t('tasks.error.load', 'Не удалось загрузить задачи'));
          return;
        }
        const data = await res.json();
        setTasks(data.tasks);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : t('common.error.unknown', 'Неизвестная ошибка'));
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [t]);

  useEffect(() => {
    if (!shouldUseOrgRoutes) return;
    const controller = new AbortController();

    const fetchOrgs = async () => {
      try {
        const res = await fetch(withBasePath('/api/org'), { signal: controller.signal });
        if (!res.ok) return;
        const data = (await res.json()) as OrgResponse;
        if (!('orgs' in data) || !Array.isArray(data.orgs)) return;

        const map = data.orgs.reduce<Record<string, string>>((acc, org) => {
          acc[org._id] = org.orgSlug;
          return acc;
        }, {});
        setOrgSlugById(map);
      } catch (err: unknown) {
        if ((err as DOMException)?.name !== 'AbortError') {
          setOrgSlugById({});
        }
      }
    };

    void fetchOrgs();
    return () => controller.abort();
  }, [shouldUseOrgRoutes]);

  // 2. Фильтруем задачи на клиенте
  const filteredTasks = useMemo(() => {
    if (!role) return tasks;
    if (isAdminRole(role) || role === 'manager' || role === 'viewer') {
      return tasks;
    }
    if (role === 'executor') {
      return tasks.filter((t) => t.executorId === clerkUserId);
    }
    return tasks;
  }, [role, clerkUserId, tasks]);

  const resolvedCtaHref = useMemo(() => {
    if (isPlatformAdmin) return ctaHref ?? '/admin/tasks/locations';
    if (!shouldUseOrgRoutes) return ctaHref;
    const taskWithProject = filteredTasks.find(
      (task) => task.orgId && (task.projectKey || task.projectId)
    );
    if (!taskWithProject) return null;
    const orgId = taskWithProject.orgId as string;
    const orgRef = orgSlugById[orgId] ?? orgId;
    const projectRef = taskWithProject.projectKey || taskWithProject.projectId;
    if (!orgRef || !projectRef) return null;
    return `/org/${encodeURIComponent(orgRef)}/projects/${encodeURIComponent(
      projectRef
    )}/tasks/locations`;
  }, [ctaHref, filteredTasks, isPlatformAdmin, orgSlugById, shouldUseOrgRoutes]);
  const resolvedCtaLabel = ctaLabel ?? t('dashboard.map.cta', 'На карте');

  // 3. Собираем координаты всех базовых станций (уже отфильтрованных задач)
  const coordinatesList = filteredTasks.flatMap((task) =>
    task.bsLocation.map((loc: BsLocation) => ({
      coordinates: loc.coordinates, // строка "lat lon"
      bsName: loc.name,
      taskName: task.taskName,
      operator: normalizeOperator(task.projectOperator),
    }))
  );
  const clusterPreset = useMemo(() => {
    const unique = new Set(coordinatesList.map((item) => item.operator));
    if (unique.size === 1) {
      const [only] = Array.from(unique.values());
      return OPERATOR_CLUSTER_PRESETS[only];
    }
    return 'islands#grayClusterIcons';
  }, [coordinatesList]);

  if (loading) {
    return (
      <Box
        display='flex'
        justifyContent='center'
        alignItems='center'
        height='300px'
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Typography color='error' textAlign='center' mt={4}>
        {error}
      </Typography>
    );
  }

  return (
    <Box sx={{ position: 'relative', width: '100%', height: mapHeight }}>
      <YMaps query={{ apikey: process.env.NEXT_PUBLIC_YANDEX_MAPS_APIKEY }}>
        <Map
          defaultState={{
            center: [54.51086463889672, 102.94017700007622],
            zoom: 6,
          }}
          width='100%'
          height='100%'
        >
          <Clusterer
            options={{
              preset: clusterPreset,
              groupByCoordinates: false,
              clusterDisableClickZoom: true,
              clusterOpenBalloonOnClick: true,
            }}
          >
            {coordinatesList.map((item, idx) => {
              const [lat, lon] = item.coordinates.split(' ').map(Number);
              return (
                <Placemark
                  key={idx}
                  geometry={[lat, lon]}
                  properties={{
                    hintContent: item.bsName,
                    balloonContent: `${item.taskName} - ${item.bsName}`,
                  }}
                  options={{
                    preset: 'islands#circleIcon',
                    iconColor: OPERATOR_COLORS[item.operator],
                  }}
                />
              );
            })}
          </Clusterer>
        </Map>
      </YMaps>

      {showOverlay && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            pointerEvents: 'none',
          }}
        />
      )}

      {showCta && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 10,
            pointerEvents: 'auto',
          }}
        >
          {resolvedCtaHref && (
            <Link href={resolvedCtaHref}>
              <Button endIcon={<MapIcon />} variant='contained'>
                {resolvedCtaLabel}
              </Button>
            </Link>
          )}
        </Box>
      )}
    </Box>
  );
}
