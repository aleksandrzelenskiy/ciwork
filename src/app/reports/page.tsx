import { Box, Paper } from '@mui/material';
import ReportListPage from '../components/ReportListPage';

const TasksPage = () => {
  return (
    <Box
      sx={{
        minHeight: '100%',
        py: { xs: 3, md: 5 },
        px: { xs: 1.5, md: 4 },
        background:
          'radial-gradient(circle at top, rgba(255,255,255,0.9), rgba(236,242,250,0.75) 45%, rgba(218,228,242,0.6))',
      }}
    >
      <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 1.5, md: 3 },
            borderRadius: 4,
            border: '1px solid rgba(15,23,42,0.08)',
            background: 'rgba(255,255,255,0.78)',
            backdropFilter: 'blur(18px)',
            boxShadow: '0 30px 80px rgba(15,23,42,0.08)',
          }}
        >
          <ReportListPage />
        </Paper>
      </Box>
    </Box>
  );
};

export default TasksPage;
