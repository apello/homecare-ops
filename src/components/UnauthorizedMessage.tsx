// src/components/UnauthorizedMessage.tsx

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export default function UnauthorizedMessage() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="body1">
        You are not authorized to view this page.
      </Typography>
    </Box>
  );
}