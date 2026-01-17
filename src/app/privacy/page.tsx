import { Container, Paper } from '@mui/material';
import { PrivacyContent } from '@/features/legal/LegalText';

export default function PrivacyPage() {
    return (
        <Container maxWidth='md' sx={{ py: { xs: 4, md: 6 } }}>
            <Paper elevation={0} sx={{ p: { xs: 3, md: 5 }, borderRadius: 3 }}>
                <PrivacyContent />
            </Paper>
        </Container>
    );
}
