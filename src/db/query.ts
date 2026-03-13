import { unionAll } from 'drizzle-orm/pg-core';
import * as sql from 'drizzle-orm/sql';
import type { PunishmentTableOid } from '../bot/lib/context.ts';
import { db } from './postgres.ts';
import * as schema from './schema.ts';

export namespace Query {
    export namespace Context {
        type ContextTable =
            | typeof schema.ban
            | typeof schema.mute
            | typeof schema.track
            | typeof schema.kick
            | typeof schema.liftedBan
            | typeof schema.liftedMute
            | typeof schema.note
            | typeof schema.warn;

        function byUserIdFromTable(table: ContextTable) {
            return db
                .select({
                    id: table.id,
                    timestamp: table.timestamp,
                    tableoid: sql.sql<PunishmentTableOid>`tableoid::regclass`.as('tableoid'),
                })
                .from(table)
                .where(sql.eq(table.userId, sql.sql.placeholder('userId')))
                .orderBy(sql.desc(table.timestamp))
                .limit(1);
        }

        function byUuidFromTable(table: ContextTable) {
            return db
                .select({
                    userId: table.userId,
                    tableoid: sql.sql<PunishmentTableOid>`tableoid::regclass`.as('tableoid'),
                })
                .from(table)
                .where(sql.eq(table.id, sql.sql.placeholder('uuid')));
        }

        const _ALL_BY_USERID = db
            .$with('entries')
            .as(
                unionAll(
                    byUserIdFromTable(schema.ban),
                    byUserIdFromTable(schema.mute),
                    byUserIdFromTable(schema.track),
                    byUserIdFromTable(schema.kick),
                    byUserIdFromTable(schema.liftedBan),
                    byUserIdFromTable(schema.liftedMute),
                    byUserIdFromTable(schema.note),
                    byUserIdFromTable(schema.warn),
                ),
            );

        export const LATEST_BY_USERID = db
            .with(_ALL_BY_USERID)
            .select({
                id: _ALL_BY_USERID.id,
                tableoid: _ALL_BY_USERID.tableoid,
            })
            .from(_ALL_BY_USERID)
            .orderBy(sql.desc(_ALL_BY_USERID.timestamp))
            .limit(1)
            .prepare('context-by-userid');

        export const BY_UUID = unionAll(
            byUuidFromTable(schema.ban),
            byUuidFromTable(schema.mute),
            byUuidFromTable(schema.track),
            byUuidFromTable(schema.kick),
            byUuidFromTable(schema.liftedBan),
            byUuidFromTable(schema.liftedMute),
            byUuidFromTable(schema.note),
            byUuidFromTable(schema.warn),
        ).prepare('context-by-uuid');
    }

    export namespace AutomaticPunishment {
        function excludedTimeFromLiftedTable(table: typeof schema.liftedBan | typeof schema.liftedMute) {
            return db
                .select({
                    time: sql.sum(sql.sql`EXTRACT(EPOCH FROM (${table.liftedTimestamp} - GREATEST(${table.timestamp}, ${sql.sql.placeholder('warningTimestamp')})))`).as('time'),
                })
                .from(table)
                .where(sql.and(sql.gte(table.liftedTimestamp, sql.sql.placeholder('warningTimestamp')), sql.eq(table.userId, sql.sql.placeholder('userId'))));
        }

        function excludedTimeFromActiveTable(table: typeof schema.ban | typeof schema.mute) {
            return db
                .select({ time: sql.sum(sql.sql`EXTRACT(EPOCH FROM (NOW() - GREATEST(${table.timestamp}, ${sql.sql.placeholder('warningTimestamp')})))`).as('time') })
                .from(table)
                .where(sql.eq(table.userId, sql.sql.placeholder('userId')));
        }

        const _INDIVIDUAL_EXCLUDED_TIME = unionAll(
            excludedTimeFromLiftedTable(schema.liftedBan),
            excludedTimeFromLiftedTable(schema.liftedMute),
            excludedTimeFromActiveTable(schema.ban),
            excludedTimeFromActiveTable(schema.mute),
        ).as('individualExcludedTime');

        export const EXCLUDED_TIME = db
            .select({ excludedTime: sql.sum(_INDIVIDUAL_EXCLUDED_TIME.time) })
            .from(_INDIVIDUAL_EXCLUDED_TIME)
            .prepare('automatic-punishment-excluded-time');
    }
}
