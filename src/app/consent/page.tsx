import { Container, Paper, Stack, Typography } from '@mui/material';

export default function ConsentPage() {
    return (
        <Container maxWidth='md' sx={{ py: { xs: 4, md: 6 } }}>
            <Paper elevation={0} sx={{ p: { xs: 3, md: 5 }, borderRadius: 3 }}>
                <Stack spacing={3}>
                    <Stack spacing={1}>
                        <Typography variant='h4' component='h1' fontWeight={700}>
                            Согласие на обработку персональных данных
                        </Typography>
                        <Typography variant='body2' color='text.secondary'>
                            Дата публикации: [дата]
                        </Typography>
                    </Stack>

                    <Stack spacing={1.5}>
                        <Typography>
                            Я, действуя свободно, своей волей и в своем интересе, даю согласие ИП [ФИО,
                            ИНН] (далее — Оператор) на обработку моих персональных данных в рамках сервиса
                            CI Work.
                        </Typography>
                    </Stack>

                    <Stack spacing={1.5}>
                        <Typography variant='h6' component='h2' fontWeight={700}>
                            1. Перечень данных
                        </Typography>
                        <Typography>
                            Фамилия, имя, email, телефон, регион, содержание сообщений, изображения/видео,
                            данные в загружаемых документах.
                        </Typography>
                    </Stack>

                    <Stack spacing={1.5}>
                        <Typography variant='h6' component='h2' fontWeight={700}>
                            2. Цели обработки
                        </Typography>
                        <Typography>
                            Регистрация в сервисе, работа таск-менеджера, координация работ, взаимодействие
                            заказчиков и исполнителей, обмен сообщениями в рабочих процессах, поддержка
                            пользователей и обеспечение безопасности.
                        </Typography>
                    </Stack>

                    <Stack spacing={1.5}>
                        <Typography variant='h6' component='h2' fontWeight={700}>
                            3. Передача данных другим пользователям
                        </Typography>
                        <Typography>
                            Контактные данные могут быть предоставлены другим пользователям только в рамках
                            задач/организации, связанных со мной в сервисе.
                        </Typography>
                    </Stack>

                    <Stack spacing={1.5}>
                        <Typography variant='h6' component='h2' fontWeight={700}>
                            4. Срок действия согласия
                        </Typography>
                        <Typography>
                            Согласие действует до момента его отзыва. Отзыв согласия осуществляется путем
                            направления обращения на email [email].
                        </Typography>
                    </Stack>
                </Stack>
            </Paper>
        </Container>
    );
}
