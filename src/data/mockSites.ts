export interface Site {
    id: string;
    name: string;
    lat: number;
    lng: number;
    radius: number; // in meters
}

export const MOCK_SITES: Site[] = [
    {
        id: 'hq',
        name: 'Headquarters (Bangkok)',
        lat: 13.7563,
        lng: 100.5018,
        radius: 500 // 500 meters allowed
    },
    {
        id: 'cm',
        name: 'Chiang Mai Branch',
        lat: 18.7883,
        lng: 98.9853,
        radius: 200
    },
    {
        id: 'phuket',
        name: 'Phuket Branch',
        lat: 7.8804,
        lng: 98.3923,
        radius: 300
    }
];
