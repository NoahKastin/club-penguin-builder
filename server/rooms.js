export const ROOMS = {
  patio: {
    id: 'patio',
    name: 'Patio',
    bgColor: '#8B6914',
    spawn: true,
    exits: [
      {
        targetRoom: 'veranda',
        label: 'Veranda →',
        x: 710,
        y: 200,
        width: 80,
        height: 120,
      },
    ],
  },
  veranda: {
    id: 'veranda',
    name: 'Veranda',
    bgColor: '#2E7D32',
    spawn: false,
    exits: [
      {
        targetRoom: 'patio',
        label: '← Patio',
        x: 10,
        y: 200,
        width: 80,
        height: 120,
      },
    ],
  },
};

export const SPAWN_ROOM = 'patio';
