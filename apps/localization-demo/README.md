# Localization demo

A small public Capillary UI component gallery showing how an application can connect
its existing localization catalog to Capillary UI's static runtime localization seam.
Use the language toggle to switch among English, Danish, and German.

The demo deliberately shows both ownership layers:

- application headings, descriptions, field labels, and dialog content come
  from the app-local catalog in `src/locales.ts`;
- Capillary UI placeholders, empty states, generated accessibility labels, the dialog
  close action, and calendar display values come from `CapillaryUiMessageOverrides`
  plus the selected locale.

Change 023 makes localization immutable for the lifetime of one runtime. The
demo therefore destroys and remounts its component tree with a new runtime
when the user selects a language. This illustrates language switching without
implying that an existing runtime can be mutated. The controller also updates
the document `lang` and title because those remain application policy.

## Commands

```bash
pnpm --filter @sylwellsoftware/localization-demo dev        # http://127.0.0.1:3003
pnpm --filter @sylwellsoftware/localization-demo typecheck
pnpm --filter @sylwellsoftware/localization-demo test
pnpm --filter @sylwellsoftware/localization-demo build
pnpm --filter @sylwellsoftware/localization-demo preview    # http://127.0.0.1:4175
```

The app is included in the framework root `typecheck`, `test`, and `build`
scripts, so `pnpm verify` covers it.
