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
    Waste: 10,
} as const;

interface SpecMeta {
    description: string;
    min_space: number;
    color: string;
}

type SpecType = (typeof SpecType)[keyof typeof SpecType];

const specMeta: Map<SpecType, SpecMeta> = new Map([
    [
        SpecType.Unassigned,
        {
            description: "This module isn't used for anything.",
            min_space: 0,
            color: "#cacacaff",
        },
    ],
    [
        SpecType.Sleeping,
        {
            description: "Used for sleeping",
            min_space: 123456789,
            color: "#7ca9ceff",
        },
    ],
    [
        SpecType.Medical,
        {
            description: "Yeowch",
            min_space: 123456789,
            color: "#ce7cafff",
        },
    ],
]);

export { SpecType as SpecType, specMeta };
export type { SpecMeta as SpecData };
