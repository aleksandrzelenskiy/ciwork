# RRL Profile Service

Внутренний сервис проверки профиля радиорелейного пролёта.

## Route

- Services hub: `/services`
- UI: `/services/rrl-profile`
- API: `POST /api/rrl-profile/calculate`

## Environment

```bash
ELEVATION_PROVIDER=opentopodata
OPENTOPODATA_BASE_URL=https://api.opentopodata.org/v1
OPENTOPODATA_DATASET=aster30m
OPEN_METEO_BASE_URL=https://api.open-meteo.com/v1/elevation
```

По умолчанию (если env отсутствуют):
- основной провайдер: OpenTopoData (публичный endpoint)
- fallback: Open-Meteo Elevation

## Start

```bash
npm run dev
```

Откройте `/services/rrl-profile`.

## Engineering Notes

- Вся физика считается только на backend (`src/lib/rrl/*`).
- UI выполняет только форму/валидацию/визуализацию.
- Источник DEM инкапсулирован через `ElevationProvider` для будущего self-hosted провайдера.
- Запросы высот батчатся и выполняются с таймаутом.

## TODO Next Phase

- Подключить self-hosted DEM сервис (Copernicus/SRTM локально).
- Сохранение расчётов в БД и история проектов.
- Экспорт PDF-отчёта с профилем, summary и техническими параметрами.
- Добавить дифракционные модели (например ITU-R P.526).
