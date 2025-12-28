// app/components/dashboards/ReportsStatistics.tsx

import React from 'react';
import { Box, Typography } from '@mui/material';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AccordionDetails from '@mui/material/AccordionDetails';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import dbConnect from '@/server/db/mongoose';
import ReportModel from '@/server/models/ReportModel';
import type { EffectiveOrgRole } from '@/app/types/roles';
import { getStatusLabel } from '@/utils/statusLabels';

interface ReportsStatisticsProps {
  role: EffectiveOrgRole | null;
  clerkUserId: string;
}

const ReportsStatistics = async ({
  role,
  clerkUserId,
}: ReportsStatisticsProps) => {
  // 1) Подключаемся к БД перед любыми операциями с моделью
  await dbConnect();

  // 2) Фильтр в зависимости от роли
  const matchCondition: Record<string, string> =
    role === 'executor' ? { createdById: clerkUserId } : {};

  // 3) Агрегация за всё время
  const reportsAggregation = await ReportModel.aggregate([
    { $match: matchCondition },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const reportCounts: { [key: string]: number } = {
    Pending: 0,
    Issues: 0,
    Fixed: 0,
    Agreed: 0,
  };

  reportsAggregation.forEach((item) => {
    if (item._id in reportCounts) {
      reportCounts[item._id] = item.count;
    }
  });

  // 4) Агрегация за предыдущий месяц
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const reportsAggregationLastMonth = await ReportModel.aggregate([
    {
      $match: {
        ...matchCondition,
        createdAt: {
          $gte: startOfLastMonth,
          $lt: startOfThisMonth,
        },
      },
    },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const reportCountsLastMonth: { [key: string]: number } = {
    Pending: 0,
    Issues: 0,
    Fixed: 0,
    Agreed: 0,
  };

  reportsAggregationLastMonth.forEach((item) => {
    if (item._id in reportCountsLastMonth) {
      reportCountsLastMonth[item._id] = item.count;
    }
  });

  // 5) Вспомогательные функции
  function getDifferencePercent(current: number, previous: number) {
    if (previous === 0) {
      if (current > 0) return 999; // условная бесконечность
      return 0;
    }
    return ((current - previous) / previous) * 100;
  }

  function formatDiff(diffValue: number) {
    const rounded = Math.round(Math.abs(diffValue));
    const sign = diffValue > 0 ? '+' : diffValue < 0 ? '-' : '';
    return `${sign}${rounded}% from last month`;
  }

  function getColorAndIcon(diffValue: number) {
    if (diffValue > 0) {
      return {
        color: 'green',
        Icon: <TrendingUpIcon sx={{ color: 'green' }} />,
      };
    } else if (diffValue < 0) {
      return {
        color: 'red',
        Icon: <TrendingDownIcon sx={{ color: 'red' }} />,
      };
    }
    return {
      color: 'inherit',
      Icon: null,
    };
  }

  // 6) Подготовка чисел для каждого статуса
  const diffPending = getDifferencePercent(
    reportCounts.Pending,
    reportCountsLastMonth.Pending
  );
  const diffIssues = getDifferencePercent(
    reportCounts.Issues,
    reportCountsLastMonth.Issues
  );
  const diffFixed = getDifferencePercent(
    reportCounts.Fixed,
    reportCountsLastMonth.Fixed
  );
  const diffAgreed = getDifferencePercent(
    reportCounts.Agreed,
    reportCountsLastMonth.Agreed
  );

  // 7) Отрисовка
  return (
    <Box sx={{ width: '100%', mb: 4 }}>
      <Accordion defaultExpanded={false}>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls='panel1-content'
          id='panel1-header'
        >
          <Typography variant='h5' align='center'>
            Your Reports
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography>Reports statistic</Typography>
          <Box sx={{ width: '100%', mt: 2 }}>
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 2,
                justifyContent: 'center',
              }}
            >
              {/* Pending */}
              <Box
                sx={{
                  width: { xs: '100%', sm: '45%', md: '22%' },
                  textAlign: 'center',
                  p: 2,
                }}
              >
                {(() => {
                  const { color, Icon } = getColorAndIcon(diffPending);
                  return (
                    <>
                      <Typography variant='h6'>{getStatusLabel('Pending')}</Typography>
                      <Typography variant='h3'>
                        {reportCounts.Pending}
                      </Typography>
                      <Typography variant='body2' sx={{ color }}>
                        {Icon} {formatDiff(diffPending)}
                      </Typography>
                    </>
                  );
                })()}
              </Box>

              {/* Issues */}
              <Box
                sx={{
                  width: { xs: '100%', sm: '45%', md: '22%' },
                  textAlign: 'center',
                  p: 2,
                }}
              >
                {(() => {
                  const { color, Icon } = getColorAndIcon(diffIssues);
                  return (
                    <>
                      <Typography variant='h6'>{getStatusLabel('Issues')}</Typography>
                      <Typography variant='h3'>
                        {reportCounts.Issues}
                      </Typography>
                      <Typography variant='body2' sx={{ color }}>
                        {Icon} {formatDiff(diffIssues)}
                      </Typography>
                    </>
                  );
                })()}
              </Box>

              {/* Fixed */}
              <Box
                sx={{
                  width: { xs: '100%', sm: '45%', md: '22%' },
                  textAlign: 'center',
                  p: 2,
                }}
              >
                {(() => {
                  const { color, Icon } = getColorAndIcon(diffFixed);
                  return (
                    <>
                      <Typography variant='h6'>{getStatusLabel('Fixed')}</Typography>
                      <Typography variant='h3'>{reportCounts.Fixed}</Typography>
                      <Typography variant='body2' sx={{ color }}>
                        {Icon} {formatDiff(diffFixed)}
                      </Typography>
                    </>
                  );
                })()}
              </Box>

              {/* Agreed */}
              <Box
                sx={{
                  width: { xs: '100%', sm: '45%', md: '22%' },
                  textAlign: 'center',
                  p: 2,
                }}
              >
                {(() => {
                  const { color, Icon } = getColorAndIcon(diffAgreed);
                  return (
                    <>
                      <Typography variant='h6'>{getStatusLabel('Agreed')}</Typography>
                      <Typography variant='h3'>
                        {reportCounts.Agreed}
                      </Typography>
                      <Typography variant='body2' sx={{ color }}>
                        {Icon} {formatDiff(diffAgreed)}
                      </Typography>
                    </>
                  );
                })()}
              </Box>
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

export default ReportsStatistics;
