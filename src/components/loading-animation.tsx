import { CircularProgress } from '@mui/material';

export function LoadingAnimation() {
  return (
    <div className="flex justify-center items-center h-screen">
      <CircularProgress />
    </div>
  );
}