// utils/statusColors.ts

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'To do':
      return '#9a9a9a';
    case 'Draft':
      return '#94a3b8';
    case 'Assigned':
      return '#3498db'; // Синий
    case 'At work':
      return '#e67e22'; // Оранжевый
    case 'Done':
      return '#2ecc71'; // Зеленый светлый
    case 'Pending':
      return '#f1c40f'; // Желтый
    case 'Issues':
      return '#e74c3c'; // Красный
    case 'Fixed':
      return '#9b59b6'; // Фиолетовый
    case 'Agreed':
      return '#4f8122'; // Зеленый темный
    default:
      return 'default';
  }
};
