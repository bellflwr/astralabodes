const SpecType = {
    Unassigned: 0,
    Sleeping: 1,
    Medical: 2,
    Eating: 3,
    Exercise: 4,
    Recreation: 5,
    Logistics: 6,
    Maintenance: 7,
    Planning: 8,
    Computing: 9,
    Waste: 10
} as const;

type SpecType = (typeof SpecType)[keyof typeof SpecType];

export { SpecType as SpecType};
