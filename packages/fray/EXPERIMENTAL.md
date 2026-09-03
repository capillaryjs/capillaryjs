# Fray data APIs and experimental compatibility path

The data APIs described here are now exported from `@sylwellsoftware/fray`.
`@sylwellsoftware/fray/experimental` temporarily re-exports the stable root so
0.2.x import paths continue to resolve. New code should use the package root.

`TreeView` is a controlled, single-select ARIA tree. Stable node keys reconcile
selection and expansion across data replacement. Arrow keys navigate and
expand/collapse, Home/End jump, Enter/Space select, and printable keys perform
type-ahead. `TreeItem` supplies an optional declarative node form. The initial
contract does not include virtualization, multi-selection, editing, or drag
reordering.

`Dialog` wraps the native modal element with a controlled boolean emitter,
label/description relationships, cancel handling, initial focus, focus
restoration, and deterministic cleanup. Applications provide actions and own
all async work; the dialog does not infer promise or confirmation policy.

## Current behavior

`ListView` and `DataTable` use stable item/row keys. Single selection exposes a
writable item-or-null emitter. Explicit multi-selection exposes an item array.
Multi-selection supports Control/Command toggles, Shift ranges, primary-button
drag ranges, arrow/Home/End focus movement, and Space/Enter selection. A data
refresh reconciles selected keys to the new row objects.

`DataTable` accepts one explicit input boundary:

- `data` accepts an array or emitter and applies sorting/filtering locally;
- `dataSource` accepts a caller-owned `TableDataSource`;
- `rest` is a concise configuration whose adapter is owned by the table.

Named factories package local data, caller queries, application handlers, and
REST endpoints. A supplied source is never disposed by the table.

Filter state lives in the table's `filtersEmitter`, so opening a panel,
changing a filter, rerendering, and refreshing data do not reset it. Remote
tables distinguish these states:

- initial/loading with no rows: status plus placeholder rows;
- loading with retained rows: busy status plus the partial/previous rows;
- ready with no rows: the configured empty message;
- error with retained rows: an alert plus those rows;
- error with no rows: an alert without a misleading empty message;
- retryable query: a native Retry button that calls `query.retry()`.

Pagination is not built in. A remote query may implement pagination arguments,
but Fray does not currently supply pagination controls or a page model.

## Measured alpha boundary

The alpha regression boundary is **1,000 rows with four to six simple columns
on a modern desktop browser**. Larger datasets, expensive custom cell
renderers, and mobile devices are not covered; paginate or filter them before
rendering.

The browser fixture measures a 1,000-row/four-column local table using stable
keys. It times initial DOM creation, a full data refresh, numeric sorting, a
filter that retains 500 rows, and one selection update. On the 2026-09-03 local
arm64 macOS verification host with Playwright 1.62.1, the results were:

| Engine | Initial | Rerender | Sort | Filter | Selection |
| --- | ---: | ---: | ---: | ---: | ---: |
| Chromium | 18.5 ms | 10.7 ms | 9.1 ms | 7.0 ms | 16.5 ms |
| Firefox | 26.0 ms | 18.0 ms | 18.0 ms | 13.0 ms | 23.0 ms |
| WebKit | 22.0 ms | 13.0 ms | 15.0 ms | 8.0 ms | 4.0 ms |

These are synchronous headless-browser regression measurements, not a promise
of end-to-end frame or device performance. The automated budget allows two
seconds for initial creation and one second for each subsequent operation to
remain robust on slower verification hosts while still catching a material
regression.

Virtualization is deliberately deferred: the measured boundary does not
justify its lifecycle, focus, and accessibility complexity. Revisit it only
with a demonstrated consumer above 1,000 rows and browser measurements showing
that server-side pagination/filtering is insufficient.

## Migrating from 0.2.x

This is a stable-root breaking change and therefore ships only in a Fray minor
release.

- Import data components and helpers from `@sylwellsoftware/fray`. The
  `/experimental` path remains a temporary compatibility re-export.
- Replace single-selection `selectedItemsEmitter: Emitter<T[]>` with
  `selectedItemEmitter: Emitter<T | null>`. Add `multiSelect: true` only where
  array selection is intentional.
- Remove `DataTable.mode`. Keep direct local input as `data`; wrap an existing
  query with `createQueryTableDataSource`; wrap a handler with
  `createHandlerTableDataSource`; or use `rest={{url, ...}}` /
  `createRestTableDataSource`.
- Migrate persisted `FilterMode` tokens explicitly: `☐` to `neutral`, the
  empty string to `prefer`, `_` to `require`, and `!` to `deny`. The parser
  rejects symbolic data so corrupted or ambiguous persistence is not silently
  accepted.
- Endpoint encoding is separate. `serializeTableQuery` still emits the prior
  compact REST tokens by default, while custom endpoints may inject another
  serializer.
