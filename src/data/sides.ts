const Side = {
    TOP: 0,
    BOTTOM: 1,
    LEFT: 2,
    RIGHT: 3,
    FRONT: 4,
    BACK: 5
} as const;

type Side = (typeof Side)[keyof typeof Side];

export { Side };
