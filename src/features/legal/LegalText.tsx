import { Stack, Typography } from '@mui/material';

export function PrivacyContent() {
    return (
        <Stack spacing={3}>
            <Stack spacing={1}>
                <Typography variant='h4' component='h1' fontWeight={700}>
                    Политика конфиденциальности (обработки персональных данных)
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                    Дата публикации: [дата]
                </Typography>
            </Stack>

            <Stack spacing={1.5}>
                <Typography variant='h6' component='h2' fontWeight={700}>
                    1. Общие положения
                </Typography>
                <Typography>
                    Настоящая Политика определяет порядок обработки персональных данных и меры по
                    обеспечению их безопасности в сервисе CI Work.
                </Typography>
                <Typography>
                    Оператор: ИП [ФИО], ИНН [ИНН], ОГРНИП [ОГРНИП], email [email].
                </Typography>
            </Stack>

            <Stack spacing={1.5}>
                <Typography variant='h6' component='h2' fontWeight={700}>
                    2. Перечень обрабатываемых данных
                </Typography>
                <Typography>
                    Оператор обрабатывает следующие персональные данные: фамилия, имя, email,
                    телефон, регион, данные учетной записи, содержание сообщений, изображения/видео,
                    данные в загружаемых документах (сметы, заказы и иные файлы).
                </Typography>
            </Stack>

            <Stack spacing={1.5}>
                <Typography variant='h6' component='h2' fontWeight={700}>
                    3. Цели обработки
                </Typography>
                <Typography>
                    Цели обработки включают регистрацию в сервисе, работу таск-менеджера,
                    координацию работ, взаимодействие заказчиков и исполнителей, обмен сообщениями
                    в рабочих процессах, поддержку пользователей и обеспечение безопасности.
                </Typography>
            </Stack>

            <Stack spacing={1.5}>
                <Typography variant='h6' component='h2' fontWeight={700}>
                    4. Правовые основания
                </Typography>
                <Typography>
                    Обработка данных осуществляется на основании согласия субъекта персональных
                    данных, а также для исполнения пользовательского соглашения и предоставления
                    функционала сервиса.
                </Typography>
            </Stack>

            <Stack spacing={1.5}>
                <Typography variant='h6' component='h2' fontWeight={700}>
                    5. Передача данных другим пользователям
                </Typography>
                <Typography>
                    Контактные данные могут быть доступны другим пользователям только участникам
                    одной организации или пользователям, связанным общей задачей/договором.
                </Typography>
            </Stack>

            <Stack spacing={1.5}>
                <Typography variant='h6' component='h2' fontWeight={700}>
                    6. Загружаемые документы
                </Typography>
                <Typography>
                    Пользователь гарантирует законность загрузки документов, содержащих данные
                    третьих лиц, и наличие необходимых оснований/согласий. Оператор обрабатывает
                    такие документы по поручению пользователя исключительно для работы сервиса.
                </Typography>
            </Stack>

            <Stack spacing={1.5}>
                <Typography variant='h6' component='h2' fontWeight={700}>
                    7. Сторонняя аутентификация
                </Typography>
                <Typography>
                    Для входа используется внешний сервис авторизации, куда передается email.
                    Иные персональные данные хранятся и обрабатываются на серверах, размещенных
                    в Российской Федерации.
                </Typography>
            </Stack>

            <Stack spacing={1.5}>
                <Typography variant='h6' component='h2' fontWeight={700}>
                    8. Сроки хранения
                </Typography>
                <Typography>
                    Персональные данные хранятся в течение срока использования сервиса и до
                    достижения целей обработки либо до отзыва согласия, если иное не требуется
                    законодательством РФ.
                </Typography>
            </Stack>

            <Stack spacing={1.5}>
                <Typography variant='h6' component='h2' fontWeight={700}>
                    9. Права субъекта персональных данных
                </Typography>
                <Typography>
                    Субъект имеет право на получение сведений об обработке, уточнение, блокирование
                    или удаление персональных данных, а также отзыв согласия путем обращения по
                    адресу [email].
                </Typography>
            </Stack>

            <Stack spacing={1.5}>
                <Typography variant='h6' component='h2' fontWeight={700}>
                    10. Меры защиты и контакты
                </Typography>
                <Typography>
                    Оператор принимает необходимые организационные и технические меры защиты данных
                    от неправомерного доступа, изменения, раскрытия или уничтожения. Вопросы,
                    связанные с обработкой персональных данных, направляйте на [email].
                </Typography>
            </Stack>
        </Stack>
    );
}

export function ConsentContent() {
    return (
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
    );
}
