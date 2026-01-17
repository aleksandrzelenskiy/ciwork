import { Container, Paper } from '@mui/material';
import { ConsentContent } from '@/features/legal/LegalText';

export default function ConsentPage() {
    return (
        <Container maxWidth='md' sx={{ py: { xs: 4, md: 6 } }}>
            <Paper elevation={0} sx={{ p: { xs: 3, md: 5 }, borderRadius: 3 }}>
                <ConsentContent />
            </Paper>
        </Container>
    );
}
