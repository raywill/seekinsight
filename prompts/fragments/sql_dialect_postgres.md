
# SQL DIALECT RULES (PostgreSQL)
- Always use **double quotes** `"` for table and column names (e.g., `SELECT "col" FROM "table"`).
- Use **single quotes** `'` for string literals (e.g., `WHERE "name" = 'Alice'`).
- Use `TEXT` type for long strings.
- Use `SERIAL` for auto-incrementing primary keys.
- Date format is ISO 8601 ('YYYY-MM-DD').
- `LIMIT` comes at the end.
- Use `ILIKE` for case-insensitive matching.
