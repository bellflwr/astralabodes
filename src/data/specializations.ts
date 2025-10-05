const SpecType = {
    Unassigned: 0,
    Hygiene: 1,
    Medical: 2,
    Meal: 3,
    Exercise: 4,
    Recreation: 5,
    Logistics: 6,
    Maintenance: 7,
    Planning: 8,
    EVA_Support: 9,
    Waste: 10,
    Airlock_Overlaps: 11,
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
        SpecType.Hygiene,
        {
            description: "Grooming, skin care, cleaning, shaving.",
            min_space: 6.69,
            color: "#7ca9ceff",
        },
    ],
    [
        SpecType.Medical,
        {
            description: "Advanced medical care, dental care.",
            min_space: 10.4,
            color: "#ce7cafff",
        },
    ],
    [
        SpecType.Meal,
        {
            description: "Meal consumption.",
            min_space: 10.09,
            color: "#e66a6aff",
        },
    ],
    [
        SpecType.Exercise,
        {
            description: "Bone loading, sensorinometer conditioning.",
            min_space: 13.42,
            color: "#addb6cff",
        },
    ],
    [
        SpecType.Recreation,
        {
            description: "Tabletop games, video/movie/window viewing.",
            min_space: 28.29,
            color: "#46d7e1ff",
        },
    ],
    [
        SpecType.Logistics,
        {
            description: "Physical worksurface access, temporary stowage.",
            min_space: 10.35,
            color: "#59ffd3ff",
        },
    ],
    [
        SpecType.Maintenance,
        {
            description: "Computer display, soft goods fabrication, equipment diagnostics.",
            min_space: 5.10,
            color: "#e8b460ff",
        },
    ],
    [
        SpecType.Planning,
        {
            description: "Mission training, command and control interface, team meetings.",
            min_space: 31.71,
            color: "#6f99e8ff",
        },
    ],
    [
        SpecType.EVA_Support,
        {
            description: "Suit testing component, video/audio communication.",
            min_space: 5.10,
            color: "#755ae3ff",
        },
    ],
    [
        SpecType.Waste,
        {
            description: "Trash containment.",
            min_space: 3.76,
            color: "#80598fff",
        },
    ],
    [
        SpecType.Airlock_Overlaps,
        {
            description: "Depressurization/repressurization, don/doffing.",
            min_space: 12.87,
            color: "#bed665ff",
        }
    ],
]);

export { SpecType as SpecType, specMeta };
export type { SpecMeta as SpecData };
