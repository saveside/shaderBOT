import { defineRelations } from 'drizzle-orm';
import * as schema from './schema.ts';

export const relations = defineRelations(schema, (r) => ({
    project: {
        projectMutes: r.many.projectMute({
            from: r.project.id,
            to: r.projectMute.projectId,
        }),
    },
}));
