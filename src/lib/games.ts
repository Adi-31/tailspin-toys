import { eq, asc, and, inArray } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Game } from '../types/game';

/**
 * Optional filters applied when listing games.
 */
export interface GameFilters {
    categories?: string[];
    publishers?: string[];
}

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

/**
 * Convert a raw joined row into the public Game shape used by the site.
 */
function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

/**
 * Build the shared query used for listing games with their category and publisher joins.
 */
function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

/**
 * Compose an optional Drizzle WHERE clause from the selected filters.
 */
function buildGameFilterClause(filters: GameFilters = {}): ReturnType<typeof and> | undefined {
    const clauses = [];

    if (filters.categories && filters.categories.length > 0) {
        clauses.push(inArray(categories.name, filters.categories));
    }

    if (filters.publishers && filters.publishers.length > 0) {
        clauses.push(inArray(publishers.name, filters.publishers));
    }

    if (clauses.length === 0) {
        return undefined;
    }

    return clauses.length === 1 ? clauses[0] : and(...clauses);
}

/**
 * Return every game in alphabetical title order.
 */
export async function getAllGames(db: Database): Promise<Game[]> {
    return getGamesByFilters(db);
}

/**
 * Return games that match the supplied category and publisher filters, ordered by title.
 */
export async function getGamesByFilters(db: Database, filters: GameFilters = {}): Promise<Game[]> {
    const query = baseGamesQuery(db);
    const clause = buildGameFilterClause(filters);
    const rows = clause ? await query.where(clause).orderBy(asc(games.title)) : await query.orderBy(asc(games.title));
    return rows.map(mapGame);
}

/**
 * Return every distinct category name in alphabetical order.
 */
export async function getAllCategories(db: Database): Promise<string[]> {
    const rows = await db.select({ name: categories.name }).from(categories).orderBy(asc(categories.name));
    return rows.map((row) => row.name);
}

/**
 * Return every distinct publisher name in alphabetical order.
 */
export async function getAllPublishers(db: Database): Promise<string[]> {
    const rows = await db.select({ name: publishers.name }).from(publishers).orderBy(asc(publishers.name));
    return rows.map((row) => row.name);
}

/**
 * Return every game id in alphabetical title order.
 */
export async function getAllGameIds(db: Database): Promise<number[]> {
    const rows = await db.select({ id: games.id }).from(games).orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/**
 * Return a single game by id, or null when it does not exist.
 */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}
