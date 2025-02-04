import toast from 'react-hot-toast';

export const toastUtils = {
  success: (message: string) => {
    toast.success(message, {
      duration: 3000,
      position: 'top-right',
    });
  },

  error: (message: string) => {
    toast.error(message, {
      duration: 5000,
      position: 'top-right',
    });
  },

  info: (message: string) => {
    toast(message, {
      duration: 3000,
      position: 'top-right',
    });
  }
};

export default toastUtils;