# Fray experimental data APIs

Everything imported from `@sylwellsoftware/fray/experimental` is outside Fray's stable
alpha compatibility surface. It may change in any `0.x` release without a
deprecation window. The stable package root does not export these symbols.

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

`ListView` and `DataTable` use stable item/row keys and expose their selected
items through writable emitters. Single selection replaces the prior item.
Multi-selection supports Control/Command toggles, Shift ranges, primary-button
drag ranges, arrow/Home/End focus movement, and Space/Enter selection. A data
refresh reconciles selected keys to the new row objects.

`DataTable` requires an explicit `mode`:

- `local` accepts an array or emitter, and performs sorting/filtering in the
  browser;
- `remote` accepts a query emitter/handler or REST configuration, and sends
  sort/filter arguments through the documented table serializer.

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
filter that retains 500 rows, and one selection update. On the 2026-09-01 local
arm64 macOS verification host with Playwright 1.62.1, the results were:

| Engine | Initial | Rerender | Sort | Filter | Selection |
| --- | ---: | ---: | ---: | ---: | ---: |
| Chromium | 19.0 ms | 9.3 ms | 9.2 ms | 6.0 ms | 20.9 ms |
| Firefox | 62.0 ms | 16.0 ms | 14.0 ms | 11.0 ms | 32.0 ms |
| WebKit | 18.0 ms | 12.0 ms | 22.0 ms | 6.0 ms | 4.0 ms |

These are synchronous headless-browser regression measurements, not a promise
of end-to-end frame or device performance. The automated budget allows two
seconds for initial creation and one second for each subsequent operation to
remain robust on slower verification hosts while still catching a material
regression.

Virtualization is deliberately deferred: the measured boundary does not
justify its lifecycle, focus, and accessibility complexity. Revisit it only
with a demonstrated consumer above 1,000 rows and browser measurements showing
that server-side pagination/filtering is insufficient.
