// app/reports/[taskId]/[baseId]/page.tsx

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  CircularProgress,
  Typography,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  LinearProgress,
  Chip,
  Tooltip,
  Snackbar,
  Alert,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import { ZoomIn, ZoomOut, RotateRight } from '@mui/icons-material';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckIcon from '@mui/icons-material/Check';
import { useParams } from 'next/navigation';
import { useDropzone, Accept } from 'react-dropzone';
import { PhotoProvider, PhotoView } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';
import Link from 'next/link';
import { getStatusColor } from '@/utils/statusColors';

// Interfaces
interface UploadedFile {
  id: string;
  file: File;
  preview: string;
  progress: number;
}

interface IStatusChangedDetails {
  oldStatus: string;
  newStatus: string;
}

interface IEvent {
  action: string;
  author: string;
  date: string;
  details?: IStatusChangedDetails;
}

// Constants
const ACTIONS = {
  REPORT_CREATED: 'REPORT_CREATED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  ISSUES_CREATED: 'ISSUES_CREATED',
  ISSUES_UPDATED: 'ISSUES_UPDATED',
  FIXED_PHOTOS: 'FIXED_PHOTOS',
};

export default function PhotoReportPage() {
  const { taskId, baseId } = useParams() as { taskId: string; baseId: string };

  // ======================
  // Role state
  // ======================
  const [role, setRole] = useState<string>(''); // "author", "initiator", etc.

  // Basic states
  const [reportId, setReportId] = useState<string>('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [fixedPhotos, setFixedPhotos] = useState<string[]>([]);
  const [issues, setIssues] = useState<{ text: string; checked: boolean }[]>(
    []
  );
  const [newIssues, setNewIssues] = useState<string[]>(['']);
  const [showIssuesFields, setShowIssuesFields] = useState(false);
  const [buttonText, setButtonText] = useState('Add Issues');
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(
    null
  );
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isFixedReady, setIsFixedReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // State for events
  const [events, setEvents] = useState<IEvent[]>([]);

  // States for createdAt and executorName
  const [createdAt, setCreatedAt] = useState<string>('N/A');
  const [executorName, setExecutorName] = useState<string>('Unknown');

  // New state to track if all issues are fixed
  const [issuesFixed, setIssuesFixed] = useState(false);

  // Agreement confirmation dialog
  const [openAgreeDialog, setOpenAgreeDialog] = useState(false);

  // Current status
  const [status, setStatus] = useState<string>('');

  // Notification (Snackbar)
  const [alertState, setAlertState] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({ open: false, message: '', severity: 'success' });

  const showAlert = (
    message: string,
    severity: 'success' | 'error' | 'info' | 'warning'
  ) => {
    setAlertState({ open: true, message, severity });
  };
  const handleCloseAlert = (
    event?: React.SyntheticEvent | Event,
    reason?: string
  ) => {
    if (reason === 'clickaway') return;
    setAlertState((prev) => ({ ...prev, open: false }));
  };

  // Helper: latest event
  const getLatestEvent = useCallback(
    (action: string, filter?: (event: IEvent) => boolean): IEvent | null => {
      let related = events.filter((evt) => evt.action === action);
      if (filter) related = related.filter(filter);
      if (related.length === 0) return null;
      return related.reduce((latest, evt) =>
        new Date(evt.date) > new Date(latest.date) ? evt : latest
      );
    },
    [events]
  );

  const photoReportEvent = getLatestEvent(ACTIONS.REPORT_CREATED);
  const issuesCreatedEvent = getLatestEvent(ACTIONS.ISSUES_CREATED);
  const issuesUpdatedEvent = getLatestEvent(ACTIONS.ISSUES_UPDATED);
  const fixedPhotosEvent = getLatestEvent(ACTIONS.FIXED_PHOTOS);
  const reportStatusEvent = getLatestEvent(ACTIONS.STATUS_CHANGED, (evt) =>
    evt.details ? evt.details.newStatus === 'Agreed' : false
  );

  // ======================
  // Fetch report (GET /api/reports/[taskId]/[baseId])
  // ======================
  const fetchReport = useCallback(async () => {
    try {
      const response = await fetch(`/api/reports/${taskId}/${baseId}`);
      if (!response.ok) {
        setError(`Failed to fetch report. Status: ${response.status}`);
        return;
      }

      const data = await response.json();

      // Set role:
      setRole(data.role || '');

      setPhotos(data.files || []);
      setFixedPhotos(data.fixedFiles || []);

      const isFixedOrAgreed =
        data.status === 'Fixed' || data.status === 'Agreed';
      setIssues(
        (data.issues || []).map((issue: string) => ({
          text: issue,
          checked: isFixedOrAgreed,
        }))
      );

      setCreatedAt(new Date(data.createdAt).toLocaleDateString() || 'N/A');
      setExecutorName(data.executorName || 'Unknown');
      setEvents(data.events || []);
      setIssuesFixed((data.fixedFiles || []).length > 0);
      setStatus(data.status || 'Pending');
      setReportId(data.taskId || data.reportId || '');
    } catch (err: unknown) {
      console.error('Error fetching report:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load report. Please try again later.'
      );
    } finally {
      setLoading(false);
    }
  }, [taskId, baseId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // ======================
  // Issues logic
  // ======================
  const handleAddIssueField = () => {
    setNewIssues((prev) => [...prev, '']);
  };
  const handleIssueChange = (index: number, value: string) => {
    const updated = [...newIssues];
    updated[index] = value;
    setNewIssues(updated);
  };
  const handleCloseIssuesFields = () => {
    setShowIssuesFields(false);
    setNewIssues(['']);
  };
  const confirmRemoveIssue = (index: number) => {
    setConfirmDeleteIndex(index);
  };
  const handleDeleteIssueField = async () => {
    if (confirmDeleteIndex === null) return;

    const issueToDelete = newIssues[confirmDeleteIndex];
    if (!issueToDelete) {
      setConfirmDeleteIndex(null);
      return;
    }

    try {
      const response = await fetch(`/api/reports/${taskId}/${baseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deleteIssueIndex: confirmDeleteIndex,
        }),
      });

      if (!response.ok) {
        showAlert('Failed to delete issue. Please try again.', 'error');
        return;
      }

      // Обновляем локальное состояние issues
      const updatedIssues = issues.filter(
        (_, idx) => idx !== confirmDeleteIndex
      );
      setIssues(updatedIssues);

      // Обновляем локальное состояние newIssues
      const updatedNewIssues = newIssues.filter(
        (_, idx) => idx !== confirmDeleteIndex
      );
      setNewIssues(updatedNewIssues);

      // Если замечаний больше нет, обновляем статус на Pending
      if (updatedIssues.length === 0) {
        const updateStatusResponse = await fetch(
          `/api/reports/${taskId}/${baseId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: 'Pending',
            }),
          }
        );

        if (!updateStatusResponse.ok) {
          showAlert('Failed to update status. Please try again.', 'error');
          return;
        }

        setStatus('Pending');
        showAlert(
          'All issues have been removed. Status updated to Pending.',
          'info'
        );
      }

      setConfirmDeleteIndex(null);
    } catch (error) {
      console.error('Error deleting issue:', error);
      showAlert('Failed to delete issue. Please try again.', 'error');
    }
  };
  const handleIssuesClick = () => {
    const currentIssueTexts = issues.map((iss) => iss.text);
    setNewIssues(currentIssueTexts.length > 0 ? currentIssueTexts : ['']);
    setShowIssuesFields(true);
    setButtonText(issues.length > 0 ? 'Update' : 'Add Issues');
  };
  const handleAddIssuesClick = async () => {
    const currentIssueTexts = issues.map((iss) => iss.text);
    const filteredNew = newIssues.filter((i) => i.trim() !== '');

    const addedIssues = filteredNew.filter(
      (i) => !currentIssueTexts.includes(i)
    );
    const updatedIssues = filteredNew.filter(
      (i, idx) => currentIssueTexts[idx] !== i
    );
    const deletedIssues = currentIssueTexts.filter(
      (i) => !filteredNew.includes(i)
    );

    if (
      addedIssues.length === 0 &&
      updatedIssues.length === 0 &&
      deletedIssues.length === 0
    ) {
      setShowIssuesFields(false);
      return;
    }

    try {
      const response = await fetch(`/api/reports/${taskId}/${baseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issues: filteredNew,
          status: filteredNew.length > 0 ? 'Issues' : 'Pending', // Обновляем статус в зависимости от наличия замечаний
        }),
      });

      if (!response.ok) {
        showAlert('Failed to update issues. Please try again.', 'error');
        return;
      }

      setStatus(filteredNew.length > 0 ? 'Issues' : 'Pending'); // Обновляем локальный статус

      const newEvent: IEvent = {
        action:
          addedIssues.length > 0
            ? ACTIONS.ISSUES_CREATED
            : ACTIONS.ISSUES_UPDATED,
        author: '', // или currentUser
        date: new Date().toISOString(),
      };
      setEvents((prev) => [...prev, newEvent]);

      setIssues(filteredNew.map((iss) => ({ text: iss, checked: false })));
      setShowIssuesFields(false);
      setNewIssues(['']);
      setIssuesFixed(false);

      if (filteredNew.length === 0) {
        showAlert(
          'All issues have been removed. Status updated to Pending.',
          'info'
        );
      }
    } catch (error) {
      console.error('Error updating issues:', error);
      showAlert('Failed to update issues. Please try again.', 'error');
    }
  };
  const handleCheckboxChange = (index: number) => {
    const updated = [...issues];
    updated[index].checked = !updated[index].checked;
    setIssues(updated);

    const allFixed = updated.every((iss) => iss.checked);
    setIsFixedReady(allFixed);
    setIssuesFixed(allFixed);

    if (allFixed) {
      setStatus('Fixed');
    }
  };

  // ======================
  // Agree logic
  // ======================
  const handleAgreeClick = () => {
    setOpenAgreeDialog(true);
  };
  const handleConfirmAgree = async () => {
    setOpenAgreeDialog(false);
    try {
      const response = await fetch(`/api/reports/${taskId}/${baseId}`);
      if (!response.ok) {
        showAlert('Failed to fetch current status.', 'error');
        return;
      }
      const data = await response.json();

      if (data.status === 'Agreed') {
        showAlert(
          `Photo report ${decodeURIComponent(
          taskId
          )} | Base: ${decodeURIComponent(baseId)} has already been agreed.`,
          'info'
        );
        return;
      }

      const updateResponse = await fetch(`/api/reports/${taskId}/${baseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Agreed' }),
      });

      if (!updateResponse.ok) {
        showAlert('Failed to update status. Please try again.', 'error');
        return;
      }

      showAlert('Status has been updated to Agreed.', 'success');
      setStatus('Agreed');

      const newEvent: IEvent = {
        action: ACTIONS.STATUS_CHANGED,
        author: 'Ivan Petrov', // or currentUser
        date: new Date().toISOString(),
        details: {
          oldStatus: data.status,
          newStatus: 'Agreed',
        },
      };
      setEvents((prev) => [...prev, newEvent]);
    } catch (error) {
      console.error('Error updating status:', error);
      showAlert('Error updating status. Please try again.', 'error');
    }
  };
  const handleCancelAgree = () => {
    setOpenAgreeDialog(false);
  };

  // ======================
  // Upload logic
  // ======================
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((file) => ({
      id: `${Date.now()}-${file.name}`,
      file,
      preview: URL.createObjectURL(file),
      progress: 0,
    }));
    setUploadedFiles((prev) => [...prev, ...newFiles]);
  }, []);
  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: { 'image/*': [] } as Accept,
    maxSize: 5 * 1024 * 1024,
    onDropRejected: (rejections) => {
      rejections.forEach((rej) => {
        rej.errors.forEach((error) => {
          showAlert(`Error: ${error.message}`, 'error');
        });
      });
    },
  });

  const handleRemoveFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  };
  const [fileToDelete, setFileToDelete] = useState<UploadedFile | null>(null);
  const handleDeleteFile = () => {
    if (fileToDelete) {
      handleRemoveFile(fileToDelete.id);
    }
    setFileToDelete(null);
  };
  const handleDeleteConfirmed = () => {
    if (fileToDelete) {
      handleDeleteFile();
    }
    setFileToDelete(null);
  };
  const handleUploadClick = async () => {
    if (uploadedFiles.length === 0) {
      showAlert('Please select images to upload.', 'warning');
      return;
    }
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('baseId', baseId);
      formData.append('task', taskId);

      for (const uf of uploadedFiles) {
        formData.append('image[]', uf.file);
      }

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload/fixed', true);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const totalProgress = (event.loaded / event.total) * 100;
          setUploadedFiles((prevFiles) =>
            prevFiles.map((f) => ({ ...f, progress: totalProgress }))
          );
        }
      };

      xhr.onload = async () => {
        if (xhr.status === 200) {
          showAlert('Fixed photos uploaded successfully.', 'success');
          setUploadedFiles([]);
          setIsFixedReady(false);
          setIssuesFixed(true);
          setStatus('Fixed');

          const newEvent: IEvent = {
            action: ACTIONS.FIXED_PHOTOS,
            author: 'Ivan Petrov', // or currentUser
            date: new Date().toISOString(),
          };
          setEvents((prev) => [...prev, newEvent]);

          await fetchReport();
        } else {
          showAlert('Failed to upload image(s).', 'error');
        }
        setUploading(false);
      };

      xhr.onerror = () => {
        showAlert('An error occurred during the upload.', 'error');
        setUploading(false);
      };

      xhr.send(formData);
    } catch (error) {
      console.error('Error uploading files:', error);
      showAlert('Error uploading files.', 'error');
      setUploading(false);
    }
  };

  // ======================
  // Download
  // ======================
  const handleDownloadReport = async () => {
    setDownloading(true);
    try {
      const response = await fetch(`/api/reports/${taskId}/${baseId}/download`);
      if (!response.ok) {
        showAlert(
          `Failed to download report. Status: ${response.status}`,
          'error'
        );
        return;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;

      const contentDisposition = response.headers.get('content-disposition');
      let fileName = 'report.zip';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match && match[1]) fileName = match[1];
      }

      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      showAlert('Report downloaded successfully.', 'success');
    } catch (error) {
      console.error('Error downloading report:', error);
      showAlert('Failed to download report. Please try again.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'Pending':
        return photoReportEvent
          ? `Photo report sent for review by ${
              photoReportEvent.author
            } on ${new Date(photoReportEvent.date).toLocaleDateString()}.`
          : 'Pending';
      case 'Issues':
        return issuesUpdatedEvent
          ? `Issues have been updated to the photo report by ${
              issuesUpdatedEvent.author
            } on ${new Date(issuesUpdatedEvent.date).toLocaleDateString()}.`
          : issuesCreatedEvent
          ? `Issues have been added to the photo report by ${
              issuesCreatedEvent.author
            } on ${new Date(issuesCreatedEvent.date).toLocaleDateString()}.`
          : 'Issues';
      case 'Fixed':
        return fixedPhotosEvent
          ? `Issues with the photo report have been Fixed. Photos were uploaded by ${
              fixedPhotosEvent.author
            } on ${new Date(fixedPhotosEvent.date).toLocaleDateString()}.`
          : 'Fixed';
      case 'Agreed':
        return reportStatusEvent
          ? `Photo report has been approved by ${
              reportStatusEvent.author
            } on ${new Date(reportStatusEvent.date).toLocaleDateString()}.`
          : 'Agreed';
      default:
        return '';
    }
  };

  const generateAgreeMessage = () => {
    if (status === 'Agreed' && reportStatusEvent) {
      return `Photo report ${decodeURIComponent(
        taskId
      )} | Base ID: ${decodeURIComponent(baseId)} has been agreed by user ${
        reportStatusEvent.author
      } on ${new Date(reportStatusEvent.date).toLocaleDateString()}.`;
    }
    return null;
  };
  const agreeMessage = generateAgreeMessage();

  // ======================
  // RENDER
  // ======================
  if (loading) {
    return (
      <Box display='flex' justifyContent='center' mt={4}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) {
    return (
      <Box display='flex' justifyContent='center' mt={4}>
        <Typography color='error'>{error}</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Snackbar */}
      <Snackbar
        open={alertState.open}
        autoHideDuration={3000}
        onClose={handleCloseAlert}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseAlert}
          severity={alertState.severity}
          sx={{ width: '100%' }}
        >
          {alertState.message}
        </Alert>
      </Snackbar>

      {/* Link to the reports list page */}
      <Box mb={2}>
        <Button
          component={Link}
          href='/reports'
          variant='text'
          startIcon={<ArrowBackIcon />}
          sx={{ textTransform: 'uppercase' }}
        >
          To Reports List
        </Button>
      </Box>

      {/* Main title */}
      <Typography variant='h5' gutterBottom sx={{ textTransform: 'none' }}>
        <Link
          href={`/tasks/${reportId.toLowerCase()}`}
          style={{ textDecoration: 'none' }}
        >
          <Chip label={reportId} sx={{ mb: 1, mr: 1 }} />
        </Link>
        {decodeURIComponent(taskId)} | BS Number: {decodeURIComponent(baseId)}
        <Chip
          label={status}
          sx={{
            backgroundColor: getStatusColor(status),
            color: '#fff',
            mb: 1,
            ml: 1,
          }}
        />
      </Typography>
      <Typography variant='body2' gutterBottom>
        Photo report created by {executorName} on {createdAt}
      </Typography>
      <Typography variant='body2' gutterBottom>
        {getStatusMessage()}
      </Typography>

      {/* Photo Report Section */}
      <Typography
        variant='h6'
        gutterBottom
        sx={{ textTransform: 'uppercase', mt: 4 }}
      >
        Photo Report
      </Typography>
      {photoReportEvent && (
        <Typography variant='body2' gutterBottom>
          Created by {photoReportEvent.author} |{' '}
          {new Date(photoReportEvent.date).toLocaleDateString()}
        </Typography>
      )}
      <PhotoProvider
        toolbarRender={({ onScale, scale, onRotate, rotate }) => (
          <Box
            display='flex'
            justifyContent='center'
            alignItems='center'
            gap={1.5}
            p={1}
          >
            <ZoomIn
              style={{ cursor: 'pointer', color: 'rgba(255, 255, 255, 0.75)' }}
              fontSize='medium'
              onClick={() => onScale(scale + 1)}
            />
            <ZoomOut
              style={{ cursor: 'pointer', color: 'rgba(255, 255, 255, 0.75)' }}
              fontSize='medium'
              onClick={() => onScale(scale - 1)}
            />
            <RotateRight
              style={{ cursor: 'pointer', color: 'white' }}
              fontSize='medium'
              onClick={() => onRotate(rotate + 90)}
            />
          </Box>
        )}
      >
        <Grid container spacing={1}>
          {photos.map((photo) => (
            <Grid xs={6} sm={4} md={2} key={photo}>
              <PhotoView src={photo}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo}
                  alt='Uploaded photo'
                  style={{
                    width: '100%',
                    aspectRatio: '1 / 1',
                    objectFit: 'cover',
                    borderRadius: '4px',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                    cursor: 'pointer',
                  }}
                />
              </PhotoView>
            </Grid>
          ))}
        </Grid>
      </PhotoProvider>

      {/* Buttons: Agree and Issues
          Скрываем, если role === 'author'
      */}
      {status !== 'Agreed' && role !== 'executor' && (
        <Box
          display='flex'
          justifyContent='center'
          alignItems='center'
          sx={{ mt: '20px', mb: '20px', gap: '10px' }}
        >
          <Button
            variant='contained'
            color='success'
            onClick={handleAgreeClick}
            disabled={status === 'Issues' && !issuesFixed}
          >
            Agree
          </Button>
          <Button variant='contained' color='error' onClick={handleIssuesClick}>
            Issues
          </Button>
        </Box>
      )}

      {/* Agreement confirmation dialog */}
      <Dialog open={openAgreeDialog} onClose={handleCancelAgree}>
        <DialogTitle>Confirm Agreement</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to agree to the photo report{' '}
            {decodeURIComponent(taskId)} | Base ID: {decodeURIComponent(baseId)}?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelAgree} color='primary'>
            Cancel
          </Button>
          <Button onClick={handleConfirmAgree} color='primary' autoFocus>
            Agree
          </Button>
        </DialogActions>
      </Dialog>

      {/* Issues Section */}
      {showIssuesFields && (
        <Box mt={4}>
          {newIssues.map((issue, idx) => (
            <Box key={idx} display='flex' alignItems='center' mb={2}>
              <TextField
                label={`Issue ${idx + 1}`}
                value={issue}
                onChange={(e) => handleIssueChange(idx, e.target.value)}
                fullWidth
                margin='normal'
              />
              <Tooltip title='Delete'>
                <IconButton
                  onClick={() => confirmRemoveIssue(idx)}
                  sx={{ ml: 1 }}
                >
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            </Box>
          ))}
          <Box display='flex' justifyContent='space-between' mt={2}>
            <Button
              startIcon={<AddIcon />}
              onClick={handleAddIssueField}
              color='primary'
            >
              Add
            </Button>
            <Box>
              <Button
                variant='contained'
                color='error'
                onClick={handleAddIssuesClick}
                sx={{ mr: 1 }}
              >
                {buttonText}
              </Button>
              <Button
                variant='contained'
                color='primary'
                onClick={handleCloseIssuesFields}
                startIcon={<CloseIcon />}
              >
                Close
              </Button>
            </Box>
          </Box>
        </Box>
      )}

      {!showIssuesFields && issues.length > 0 && (
        <Box>
          <Typography
            variant='h6'
            gutterBottom
            sx={{ textTransform: 'uppercase', mt: 4 }}
          >
            Issues
          </Typography>
          {/* Displaying events for Issues */}
          {issuesUpdatedEvent ? (
            <Typography variant='body2' gutterBottom>
              Edited by {issuesUpdatedEvent.author} |{' '}
              {new Date(issuesUpdatedEvent.date).toLocaleDateString()}
            </Typography>
          ) : (
            issuesCreatedEvent && (
              <Typography variant='body2' gutterBottom>
                Created by {issuesCreatedEvent.author} |{' '}
                {new Date(issuesCreatedEvent.date).toLocaleDateString()}
              </Typography>
            )
          )}
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Issue</TableCell>
                  <TableCell align='center'>Fixed</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {issues.map((issue, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{`${idx + 1}. ${issue.text}`}</TableCell>
                    <TableCell align='center'>
                      {status === 'Issues' ? (
                        <Checkbox
                          checked={issue.checked}
                          onChange={() => handleCheckboxChange(idx)}
                        />
                      ) : issue.checked ? (
                        <CheckIcon color='success' />
                      ) : (
                        <Typography variant='body2' color='textSecondary'>
                          Not Fixed
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {isFixedReady && (
            <Box mt={4}>
              <Typography
                variant='h6'
                gutterBottom
                sx={{ textTransform: 'uppercase' }}
              >
                Upload Fixed Photos
              </Typography>

              {uploadedFiles.length > 0 && (
                <Box mt={2}>
                  <Grid container spacing={2}>
                    {uploadedFiles.map((uf) => (
                      <Grid xs={6} sm={4} md={3} key={uf.id}>
                        <Box
                          sx={{
                            position: 'relative',
                            textAlign: 'center',
                            border: '1px solid #ccc',
                            borderRadius: '8px',
                            padding: 1,
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={uf.preview}
                            alt={uf.file.name}
                            style={{
                              width: '100%',
                              height: 'auto',
                              borderRadius: '8px',
                            }}
                          />
                          <IconButton
                            onClick={() => setFileToDelete(uf)}
                            sx={{
                              position: 'absolute',
                              top: 8,
                              right: 8,
                              background: 'rgba(255, 255, 255, 0.8)',
                              '&:hover': {
                                background: 'rgba(255, 255, 255, 1)',
                              },
                            }}
                          >
                            <DeleteIcon />
                          </IconButton>
                          <Typography variant='body2' noWrap>
                            {uf.file.name}
                          </Typography>
                          {uploading && (
                            <LinearProgress
                              variant='determinate'
                              value={uf.progress}
                              sx={{ mt: 1 }}
                            />
                          )}
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}

              <Box
                {...getRootProps()}
                sx={{
                  border: '2px dashed #ccc',
                  borderRadius: '8px',
                  p: 2,
                  textAlign: 'center',
                  mt: 2,
                  mb: 2,
                }}
              >
                <input {...getInputProps()} />
                <Typography variant='body1'>
                  Drag & drop images here, or click to select
                </Typography>
              </Box>

              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  mt: 2,
                }}
              >
                <Button
                  variant='contained'
                  startIcon={<CloudUploadIcon />}
                  color='primary'
                  onClick={handleUploadClick}
                  disabled={uploadedFiles.length === 0 || uploading}
                >
                  Upload Photo
                </Button>
              </Box>
            </Box>
          )}

          {fixedPhotos.length > 0 && (
            <Box mt={4}>
              <Typography
                variant='h6'
                gutterBottom
                sx={{ textTransform: 'uppercase' }}
              >
                Issues Fixed
              </Typography>
              {fixedPhotosEvent ? (
                <Typography variant='body2' gutterBottom>
                  Created by {fixedPhotosEvent.author} |{' '}
                  {new Date(fixedPhotosEvent.date).toLocaleDateString()}
                </Typography>
              ) : (
                <Typography variant='body2' gutterBottom color='textSecondary'>
                  No information available.
                </Typography>
              )}
              <PhotoProvider
                toolbarRender={({ onScale, scale, onRotate, rotate }) => (
                  <Box
                    display='flex'
                    justifyContent='center'
                    alignItems='center'
                    gap={1.5}
                    p={1}
                  >
                    <ZoomIn
                      style={{
                        cursor: 'pointer',
                        color: 'rgba(255, 255, 255, 0.75)',
                      }}
                      fontSize='medium'
                      onClick={() => onScale(scale + 1)}
                    />
                    <ZoomOut
                      style={{
                        cursor: 'pointer',
                        color: 'rgba(255, 255, 255, 0.75)',
                      }}
                      fontSize='medium'
                      onClick={() => onScale(scale - 1)}
                    />
                    <RotateRight
                      style={{ cursor: 'pointer', color: 'white' }}
                      fontSize='medium'
                      onClick={() => onRotate(rotate + 90)}
                    />
                  </Box>
                )}
              >
                <Grid container spacing={1}>
                  {fixedPhotos.map((photo, idx) => (
                    <Grid xs={6} sm={4} md={2} key={`fixed-${idx}`}>
                      <PhotoView src={photo}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo}
                          alt={`Fixed Photo ${idx + 1}`}
                          style={{
                            width: '100%',
                            aspectRatio: '1 / 1',
                            objectFit: 'cover',
                            borderRadius: '4px',
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                            cursor: 'pointer',
                          }}
                        />
                      </PhotoView>
                    </Grid>
                  ))}
                </Grid>
              </PhotoProvider>
            </Box>
          )}

          {/* Displaying agreement message */}
          {agreeMessage && (
            <Box mt={4}>
              <Typography variant='body1' color='success.main'>
                {agreeMessage}
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {status === 'Agreed' && (
        <Box mt={4} display='flex' justifyContent='center'>
          <Button
            variant='contained'
            color='primary'
            startIcon={<CloudDownloadIcon />}
            onClick={handleDownloadReport}
            disabled={downloading}
          >
            {downloading ? 'Downloading...' : 'Download Report'}
          </Button>
        </Box>
      )}

      {/* Confirmation dialog for deleting an issue */}
      <Dialog
        open={confirmDeleteIndex !== null}
        onClose={() => setConfirmDeleteIndex(null)}
      >
        <DialogTitle>Confirmation</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this issue?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteIndex(null)} color='primary'>
            Cancel
          </Button>
          <Button onClick={handleDeleteIssueField} color='error'>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation dialog for deleting a file */}
      <Dialog open={!!fileToDelete} onClose={() => setFileToDelete(null)}>
        <DialogTitle>Confirmation</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this image?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFileToDelete(null)} color='primary'>
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirmed} color='error'>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
