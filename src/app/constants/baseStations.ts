export type BaseStationCollection = {
    region: string;
    operator: string;
    collection: string;
};

export const BASE_STATION_COLLECTIONS: readonly BaseStationCollection[] = [
    {
        region: '38',
        operator: '250020',
        collection: '38-250020-bs-coords',
    },
    // Добавляйте другие соответствия «регион + оператор → коллекция» по мере готовности данных
];
