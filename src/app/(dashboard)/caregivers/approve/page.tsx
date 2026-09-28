import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { redirect } from 'next/navigation'
import { getActiveMembership, requireAuth } from '@/lib/auth/server'
import PageContainer from '@/components/templates/crud-dashboard/components/PageContainer'

export default async function ApprovePatientsPage() {
  await requireAuth()
  const membership = await getActiveMembership()
  if (!membership) redirect('/login')

  return (
    <PageContainer
      title="Approve caregivers"
      breadcrumbs={[
        { title: 'Home', path: '/dashboard' },
        { title: 'Caregivers', path: '/caregivers' },
        { title: 'Approve caregivers' },
      ]}
    >
      <Box sx={{ pt: 1 }}>
        <Typography>
          Approving new caregiver requests is gated by agency administrators, and is still being developed.
        </Typography>
      </Box>
    </PageContainer>
  )
}
