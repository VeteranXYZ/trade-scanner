import { migrateJsonlResearchToSqlite } from "../src/lib/storage/sqlite/migrateJsonlToSqlite";

const stats = await migrateJsonlResearchToSqlite();
console.log(JSON.stringify(stats, null, 2));
