// app/estimates/page.tsx

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  LinearProgress,
  Chip,
  Stack,
  IconButton,
  Collapse,
} from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useUser } from '@clerk/nextjs';
import { useDropzone, FileRejection } from 'react-dropzone';
import { Task, PriorityLevel, WorkItem } from '@/app/types/taskTypes';
import Autocomplete from '@mui/material/Autocomplete';
import {
  KeyboardDoubleArrowUp as KeyboardDoubleArrowUpIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  DragHandle as DragHandleIcon,
  Remove as RemoveIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { UI_RADIUS } from '@/config/uiTokens';
import { withBasePath } from '@/utils/basePath';

interface ExcelData {
  [sheetName: string]: Array<Record<string, unknown>>;
}

interface ParsedValues {
  total: number | null;
  bsNumber: string | null;
  bsAddress: string | null;
  fot: number | null;
}

interface User {
  _id: string;
  clerkUserId: string;
  name: string;
  email: string;
  role: string;
}

const generatetaskId = (): string => {
  const randomPart = Math.random().toString(36).substr(2, 5).toUpperCase();
  return `${randomPart}`;
};

const EstimateUploadPage: React.FC = () => {
  const router = useRouter();
  const { isLoaded, user } = useUser();
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [, setError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ExcelData | null>(null);
  const [values, setValues] = useState<ParsedValues>({
    total: null,
    bsNumber: null,
    bsAddress: null,
    fot: null,
  });
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState<Partial<Task>>({
    taskId: '',
    taskName: '',
    taskDescription: '',
    priority: 'medium',
    dueDate: new Date(),
    authorId: '',
    authorName: '',
    authorEmail: '',
    initiatorName: '',
    initiatorEmail: '',
    executorId: '',
    executorName: '',
    executorEmail: '',
  });
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'error' | 'success' | 'info' | 'warning';
  }>({ open: false, message: '', severity: 'info' });

  const showNotification = (
      message: string,
      severity: 'error' | 'success' | 'info' | 'warning'
  ) => {
    setNotification({ open: true, message, severity });
    setTimeout(() => {
      setNotification((prev) => ({ ...prev, open: false }));
    }, 5000);
  };

  const filterUsers = (options: User[], inputValue: string) => {
    return options.filter(
        (option) =>
            option.name.toLowerCase().includes(inputValue.toLowerCase()) ||
            option.email.toLowerCase().includes(inputValue.toLowerCase())
    );
  };

  const getDisplayName = () => {
    if (user?.fullName) return user.fullName;
    if (user?.firstName && user?.lastName)
      return `${user.firstName} ${user.lastName}`;
    if (user?.username) return user.username;
    return user?.primaryEmailAddress?.emailAddress || 'Unknown User';
  };

  const getDisplayNameWithEmail = () => {
    const displayName = getDisplayName();
    const email = user?.primaryEmailAddress?.emailAddress;
    return email ? `${displayName} (${email})` : displayName;
  };

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoadingUsers(true);
        const response = await fetch(withBasePath('/api/users'));
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          const message =
              typeof data === 'object' && data && 'error' in data
                  ? String((data as { error?: string }).error || 'Error loading users')
                  : 'Error loading users';
          setError(message);
          return;
        }
        setUsers(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error(error);
        setError('Failed to load users');
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, []);

  const findValueByLabel = (
      data: ExcelData,
      label: string
  ): string | number | null => {
    for (const sheet of Object.values(data)) {
      for (const row of sheet) {
        const labelEntry = Object.entries(row).find(
            ([, value]) => value === label
        );

        if (labelEntry) {
          const [labelKey] = labelEntry;
          const keys = Object.keys(row);
          const labelIndex = keys.indexOf(labelKey);

          if (labelIndex !== -1 && labelIndex < keys.length - 1) {
            const valueKey = keys[labelIndex + 1];
            const value = row[valueKey];

            if (typeof value === 'string' || typeof value === 'number') {
              return value;
            }
          }
        }
      }
    }
    return null;
  };

  const parseData = (data: ExcelData): ParsedValues => {
    const total = findValueByLabel(data, 'Итого с учетом Коэф.') as
        | number
        | null;

    return {
      bsNumber: findValueByLabel(data, 'Номер БС:') as string | null,
      bsAddress: findValueByLabel(data, 'Адрес БС:') as string | null,
      total: total,
      fot: total ? total * 0.7 : null,
    };
  };

  const getTableData = () => {
    if (!parsedData) return [];

    const excludedValues = [
      'сайт',
      'комплект',
      'шт.',
      'м.куб.',
      'м.кв.',
      'т.',
      'оттяжка',
      'м.п.',
      'смена',
      'км.',
      'м.п.',
      'талреп',
      'перекрытие',
      'шт',
      'шт. ',
    ];

    return Object.values(parsedData)
        .flat()
        .filter((row) => {
          const quantity = row['__EMPTY_2'];
          const empty1Value = String(row['__EMPTY_1']);

          return (
              row['__EMPTY_1'] &&
              typeof quantity === 'number' &&
              quantity !== 0 &&
              row['__EMPTY_3'] &&
              !excludedValues.includes(empty1Value)
          );
        });
  };

  const onDrop = useCallback(
      (acceptedFiles: File[], fileRejections: FileRejection[]) => {
        setParsedData(null);
        setValues({ total: null, bsNumber: null, bsAddress: null, fot: null });

        if (fileRejections.length > 0) {
          setError('Some files were rejected. Please upload a valid Excel file.');
        }

        if (acceptedFiles.length > 0) {
          setFile(acceptedFiles[0]);
        }
      },
      []
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
        '.xlsx',
      ],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
    multiple: false,
  });

  const onDropAttachments = useCallback((acceptedFiles: File[]) => {
    setAttachmentFiles((prev) => [...prev, ...acceptedFiles]);
  }, []);

  const {
    getRootProps: getAttachmentRootProps,
    getInputProps: getAttachmentInputProps,
    isDragActive: isDragActiveAttachments,
  } = useDropzone({
    onDrop: onDropAttachments,
    multiple: true,
  });

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setNotification((prev) => ({ ...prev, open: false }));

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(withBasePath('/api/estimates'), {
        method: 'POST',
        body: formData,
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
            typeof result === 'object' && result && 'error' in result
                ? String((result as { error?: string }).error || 'File upload error')
                : 'File upload error';
        showNotification(message, 'error');
        return;
      }
      if (!result || typeof result !== 'object' || !('data' in result)) {
        showNotification('File upload error', 'error');
        return;
      }
      setParsedData(result.data);
      const parsedValues = parseData(result.data);
      setValues(parsedValues);
      showNotification('File uploaded and processed successfully!', 'success');
    } catch (err) {
      console.error(err);
      showNotification(
          err instanceof Error
              ? err.message
              : 'Error occurred during file upload',
          'error'
      );
    } finally {
      setUploading(false);
    }
  };

  const prepareTaskData = (): Partial<Task> | null => {
    if (!values || !parsedData) return null;

    const workItems: WorkItem[] = getTableData().map((row) => ({
      workType: String(row['__EMPTY_1']),
      quantity: Number(row['__EMPTY_2']),
      unit: String(row['__EMPTY_3']),
      note: String(row['__EMPTY_17'] || ''),
    }));

    return {
      bsNumber: values.bsNumber || '',
      bsAddress: values.bsAddress || '',
      totalCost: values.total || 0,
      workItems,
      priority: 'medium' as PriorityLevel,
    };
  };

  const handleClear = () => {
    setFile(null);
    setParsedData(null);
    setValues({ total: null, bsNumber: null, bsAddress: null, fot: null });
    setUploadProgress(0);
    setError(null);
  };

  const handleAddTask = () => {
    const taskData = prepareTaskData();
    if (taskData) {
      setFormData({
        ...taskData,
        dueDate: new Date(),
        authorEmail: user?.primaryEmailAddress?.emailAddress || '',
      });
      setOpenDialog(true);
    }
  };

  const handleSubmit = async () => {
    try {
      setNotification((prev) => ({ ...prev, open: false }));

      if (!file || !formData.taskName || !values.bsNumber) {
        showNotification('Please fill in all required fields', 'error');
        return;
      }

      if (!user?.id || !user?.primaryEmailAddress?.emailAddress) {
        showNotification('User data not found!', 'error');
        return;
      }

      const formDataToSend = new FormData();
      const taskId = generatetaskId();

      // Основные данные
      formDataToSend.append('taskId', taskId);
      formDataToSend.append('taskName', formData.taskName);
      formDataToSend.append('bsNumber', values.bsNumber);
      formDataToSend.append('bsAddress', values.bsAddress || '');
      formDataToSend.append('totalCost', String(values.total || 0));
      formDataToSend.append('priority', formData.priority || 'medium');
      formDataToSend.append('dueDate', formData.dueDate?.toISOString() || '');
      formDataToSend.append('taskDescription', formData.taskDescription || '');

      // Данные автора
      formDataToSend.append('authorId', user.id);
      formDataToSend.append('authorName', getDisplayName());
      formDataToSend.append(
          'authorEmail',
          user.primaryEmailAddress.emailAddress
      );

      // Данные исполнителя (если выбран)
      if (formData.executorId) {
        const executorUser = users.find(
            (user) => user.clerkUserId === formData.executorId
        );
        formDataToSend.append('executorId', executorUser?.clerkUserId || '');
        formDataToSend.append('executorName', formData.executorName || '');
        formDataToSend.append('executorEmail', formData.executorEmail || '');
      }

      // Данные инициатора
      formDataToSend.append('initiatorName', formData.initiatorName || '');
      formDataToSend.append('initiatorEmail', formData.initiatorEmail || '');

      // Файлы и workItems (без изменений)
      formDataToSend.append('excelFile', file);
      attachmentFiles.forEach((file, index) => {
        formDataToSend.append(`attachments_${index}`, file);
      });

      const workItems = getTableData().map((row) => ({
        workType: String(row['__EMPTY_1']),
        quantity: Number(row['__EMPTY_2']),
        unit: String(row['__EMPTY_3']),
        note: String(row['__EMPTY_17'] || ''),
      }));
      formDataToSend.append('workItems', JSON.stringify(workItems));
      const response = await fetch(withBasePath('/api/addtasks'), {
        method: 'POST',
        body: formDataToSend,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const message =
            typeof errorData === 'object' && errorData && 'error' in errorData
                ? String((errorData as { error?: string }).error || 'Error creating task')
                : 'Error creating task';
        showNotification(message, 'error');
        return;
      }

      setOpenDialog(false);
      setAttachmentFiles([]);
      handleClear();
      showNotification('Task created successfully!', 'success');
      router.push('/tasks');
    } catch (err) {
      console.error('Error saving task:', err);
      showNotification(
          err instanceof Error ? err.message : 'Error saving task',
          'error'
      );
    } finally {
      setUploadProgress(0);
    }
  };

  const tableData = getTableData();

  if (!isLoaded) {
    return (
        <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100vh',
            }}
        >
          <CircularProgress />
        </Box>
    );
  }

  return (
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              position: 'relative',
            }}
        >
          {/* Уведомления */}
          <Box
              sx={{
                position: 'fixed',
                top: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 9999,
                width: 'auto',
              }}
          >
            <Collapse in={notification.open}>
              <Alert
                  severity={notification.severity}
                  action={
                    <IconButton
                        aria-label='close'
                        color='inherit'
                        size='small'
                        onClick={() => {
                          setNotification((prev) => ({ ...prev, open: false }));
                        }}
                    >
                      <CloseIcon fontSize='inherit' />
                    </IconButton>
                  }
                  sx={{
                    boxShadow: 3,
                    minWidth: 300,
                    '& .MuiAlert-message': { flexGrow: 1 },
                  }}
              >
                {notification.message}
              </Alert>
            </Collapse>
          </Box>

          <Paper
              elevation={3}
              sx={{ padding: 4, maxWidth: 800, width: '100%', textAlign: 'center' }}
          >
            <Typography variant='h5' gutterBottom>
              Upload Estimate in Excel
            </Typography>

            <Box
                {...getRootProps()}
                sx={{
                  border: '2px dashed #1976d2',
                  borderRadius: UI_RADIUS.item,
                  padding: 4,
                  cursor: 'pointer',
                  backgroundColor: isDragActive ? '#e3f2fd' : '#fafafa',
                  transition: 'background-color 0.3s',
                  marginTop: 2,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '100px',
                }}
            >
              <input {...getInputProps()} />
              <Typography>
                {isDragActive
                    ? 'Drop the file to upload'
                    : 'Drag file here or click to select file'}
              </Typography>
            </Box>

            {file && (
                <Box sx={{ marginTop: 2 }}>
                  <Typography variant='subtitle1'>Selected file:</Typography>
                  <Typography variant='body1'>{file.name}</Typography>
                  <Button
                      variant='contained'
                      color='primary'
                      sx={{ mt: 2, mb: 2 }}
                      onClick={parsedData ? handleClear : handleUpload}
                      disabled={uploading}
                      startIcon={uploading && <CircularProgress size={20} />}
                  >
                    {uploading ? 'Uploading...' : parsedData ? 'Clear' : 'Upload'}
                  </Button>
                  {uploading && (
                      <LinearProgress
                          variant='determinate'
                          value={uploadProgress}
                          sx={{ mt: 1 }}
                      />
                  )}
                </Box>
            )}

            {(values.total !== null || values.bsNumber || values.bsAddress) && (
                <Box sx={{ marginTop: 2, textAlign: 'left' }}>
                  {values.bsNumber && (
                      <Typography variant='body1' gutterBottom>
                        <strong>BS Number:</strong> {values.bsNumber}
                      </Typography>
                  )}

                  {values.bsAddress && (
                      <Typography variant='body1' gutterBottom>
                        <strong>BS Address:</strong> {values.bsAddress}
                      </Typography>
                  )}

                  {values.total !== null && (
                      <Typography variant='body1' gutterBottom>
                        <strong>Total:</strong> {values.total.toFixed(2)}
                        {/* {(parseFloat(values.total.toFixed(2)) * 0.7).toFixed(2)} */}
                      </Typography>
                  )}
                </Box>
            )}

            {tableData.length > 0 && (
                <>
                  <Box sx={{ marginTop: 4 }}>
                    <Typography variant='h6' gutterBottom>
                      Work Items
                    </Typography>
                    <TableContainer component={Paper}>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Work Type</TableCell>
                            <TableCell>Qty</TableCell>
                            <TableCell>Unit</TableCell>
                            <TableCell>Note</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {tableData.map((row, index) => (
                              <TableRow key={index}>
                                <TableCell>{row['__EMPTY_1'] ? String(row['__EMPTY_1']) : ''}</TableCell>
                                <TableCell>{row['__EMPTY_2'] ? String(row['__EMPTY_2']) : ''}</TableCell>
                                <TableCell>{row['__EMPTY_3'] ? String(row['__EMPTY_3']) : ''}</TableCell>
                                <TableCell>{row['__EMPTY_17'] ? String(row['__EMPTY_17']) : ''}</TableCell>
                              </TableRow>
                          ))}
                        </TableBody>

                      </Table>
                    </TableContainer>
                  </Box>
                  <Button
                      variant='contained'
                      color='primary'
                      sx={{ mt: 2 }}
                      onClick={handleAddTask}
                  >
                    Add Task
                  </Button>
                </>
            )}

            <Dialog
                open={openDialog}
                onClose={() => setOpenDialog(false)}
                fullWidth
                maxWidth='md'
            >
              <DialogTitle>Create New Task</DialogTitle>
              <DialogContent>
                <Box
                    sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}
                >
                  <TextField
                      label='Task Name'
                      value={formData.taskName || ''}
                      onChange={(e) =>
                          setFormData({ ...formData, taskName: e.target.value })
                      }
                      fullWidth
                      required
                      sx={{ mb: 2 }}
                  />
                  <TextField
                      label='BS Number'
                      value={formData.bsNumber || ''}
                      onChange={(e) =>
                          setFormData({ ...formData, bsNumber: e.target.value })
                      }
                      fullWidth
                      required
                  />

                  <TextField
                      label='BS Address'
                      value={formData.bsAddress || ''}
                      onChange={(e) =>
                          setFormData({ ...formData, bsAddress: e.target.value })
                      }
                      fullWidth
                      required
                      disabled
                  />

                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <FormControl fullWidth>
                      <InputLabel>Priority</InputLabel>
                      <Select
                          value={formData.priority}
                          onChange={(e) =>
                              setFormData({
                                ...formData,
                                priority: e.target.value as PriorityLevel,
                              })
                          }
                          label='Priority'
                      >
                        <MenuItem value='urgent'>
                          <Stack direction='row' alignItems='center' gap={1}>
                            <KeyboardDoubleArrowUpIcon
                                sx={{ color: '#ff0000' }}
                            />
                            <span>Urgent</span>
                          </Stack>
                        </MenuItem>
                        <MenuItem value='high'>
                          <Stack direction='row' alignItems='center' gap={1}>
                            <KeyboardArrowUpIcon sx={{ color: '#ca3131' }} />
                            <span>High</span>
                          </Stack>
                        </MenuItem>
                        <MenuItem value='medium'>
                          <Stack direction='row' alignItems='center' gap={1}>
                            <DragHandleIcon sx={{ color: '#df9b18' }} />
                            <span>Medium</span>
                          </Stack>
                        </MenuItem>
                        <MenuItem value='low'>
                          <Stack direction='row' alignItems='center' gap={1}>
                            <RemoveIcon sx={{ color: '#28a0e9' }} />
                            <span>Low</span>
                          </Stack>
                        </MenuItem>
                      </Select>
                    </FormControl>
                    <DatePicker
                        label='Due Date'
                        value={formData.dueDate}
                        onChange={(newValue) =>
                            setFormData({ ...formData, dueDate: newValue as Date })
                        }
                    />
                  </Box>
                  <TextField
                      label='Task Author'
                      value={getDisplayNameWithEmail()}
                      fullWidth
                      required
                      disabled
                      sx={{
                        '& .MuiInputBase-input': {
                          color: 'rgba(0, 0, 0, 0.6)',
                          pointerEvents: 'none',
                        },
                      }}
                  />
                  <FormControl fullWidth sx={{ mt: 2 }}>
                    <Autocomplete
                        options={users}
                        filterOptions={(options, { inputValue }) =>
                            filterUsers(options, inputValue)
                        }
                        getOptionLabel={(user) => `${user.name} (${user.email})`}
                        value={
                            users.find(
                                (user) => user.clerkUserId === formData.executorId
                            ) || null
                        }
                        onChange={(_, newValue) => {
                          setFormData({
                            ...formData,
                            executorId: newValue?.clerkUserId || '',
                            executorName: newValue?.name || '',
                            executorEmail: newValue?.email || '',
                          });
                        }}
                        isOptionEqualToValue={(option, value) =>
                            option._id === value._id
                        }
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label='Executor'
                                InputProps={{
                                  ...params.InputProps,
                                  type: 'search',
                                }}
                            />
                        )}
                        loading={loadingUsers}
                        loadingText='Loading users...'
                        noOptionsText='No users found'
                    />
                  </FormControl>

                  <FormControl fullWidth sx={{ mt: 2 }}>
                    <Autocomplete
                        options={users}
                        filterOptions={(options, { inputValue }) =>
                            filterUsers(options, inputValue)
                        }
                        getOptionLabel={(user) => `${user.name} (${user.email})`}
                        value={
                            users.find(
                                (user) => user.email === formData.initiatorEmail
                            ) || null
                        }
                        onChange={(_, newValue) => {
                          setFormData({
                            ...formData,
                            initiatorName: newValue?.name || '',
                            initiatorEmail: newValue?.email || '',
                          });
                        }}
                        isOptionEqualToValue={(option, value) =>
                            option._id === value._id
                        }
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label='Task Initiator'
                                InputProps={{
                                  ...params.InputProps,
                                  type: 'search',
                                }}
                                required
                            />
                        )}
                        loading={loadingUsers}
                        loadingText='Loading users...'
                        noOptionsText='No users found'
                    />
                  </FormControl>
                  <TextField
                      label='Task Description'
                      value={formData.taskDescription || ''}
                      onChange={(e) =>
                          setFormData({
                            ...formData,
                            taskDescription: e.target.value,
                          })
                      }
                      multiline
                      minRows={3}
                      maxRows={6}
                      fullWidth
                      required
                  />

                  <Box sx={{ mt: 2 }}>
                    <Typography variant='subtitle1' gutterBottom>
                      Attached Files
                    </Typography>
                    {attachmentFiles.map((file, index) => (
                        <Chip
                            key={index}
                            label={`${file.name} (${(file.size / 1024).toFixed(
                                1
                            )} KB)`}
                            onDelete={() => {
                              setAttachmentFiles((prev) =>
                                  prev.filter((_, i) => i !== index)
                              );
                            }}
                            deleteIcon={<CloseIcon />}
                            variant='outlined'
                            sx={{ m: 0.5 }}
                        />
                    ))}
                    {uploading && (
                        <LinearProgress
                            variant='determinate'
                            value={uploadProgress}
                            sx={{ mt: 1 }}
                        />
                    )}
                    <Box
                        {...getAttachmentRootProps()}
                        sx={{
                          border: '2px dashed #1976d2',
                          borderRadius: UI_RADIUS.item,
                          padding: 4,
                          cursor: 'pointer',
                          backgroundColor: isDragActive ? '#e3f2fd' : '#fafafa',
                          transition: 'background-color 0.3s',
                          marginTop: 2,
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          height: '100px',
                        }}
                    >
                      <input {...getAttachmentInputProps()} />
                      <Typography>
                        {isDragActiveAttachments
                            ? 'Drop files to upload'
                            : 'Drag files here or click to select'}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
                <Button
                    onClick={handleSubmit}
                    variant='contained'
                    color='primary'
                >
                  Save
                </Button>
              </DialogActions>
            </Dialog>
          </Paper>
        </Box>
      </LocalizationProvider>
  );
};

export default EstimateUploadPage;
