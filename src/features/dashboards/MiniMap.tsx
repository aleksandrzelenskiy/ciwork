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

interface MiniMapProps {
  role: EffectiveOrgRole | null; // admin | manager | executor | viewer
  clerkUserId: string; // Текущий userId пользователя (из Clerk)
  showOverlay?: boolean;
  showCta?: boolean;
  ctaLabel?: string;
  ctaHref?: string;
  mapHeight?: number;
}

export default function MiniMap({
  role,
  clerkUserId,
  showOverlay = true,
  showCta = true,
  ctaLabel = 'На карте',
  ctaHref = '/tasks/locations',
  mapHeight = 400,
}: MiniMapProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Загружаем все задачи с /api/tasks
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/tasks');
        if (!res.ok) {
          setError('Error fetching tasks');
          return;
        }
        const data = await res.json();
        setTasks(data.tasks);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

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

  // 3. Собираем координаты всех базовых станций (уже отфильтрованных задач)
  const coordinatesList = filteredTasks.flatMap((task) =>
    task.bsLocation.map((loc: BsLocation) => ({
      coordinates: loc.coordinates, // строка "lat lon"
      bsName: loc.name,
      taskName: task.taskName,
    }))
  );

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
              preset: 'islands#invertedBlueClusterIcons',
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
                    preset: 'islands#blueIcon',
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
          <Link href={ctaHref}>
            <Button endIcon={<MapIcon />} variant='contained'>
              {ctaLabel}
            </Button>
          </Link>
        </Box>
      )}
    </Box>
  );
}
