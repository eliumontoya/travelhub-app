# Operator UI primitives

Use the semantic `--operator-*` tokens from `src/app/globals.css` for authenticated dashboard surfaces. Do not introduce raw corporate color values in dashboard UI.

- `OperatorSurface` is for repeated card, panel, and subtle content containers.
- `OperatorButton` is for repeated primary, gold, and secondary button actions.
- Use a native element or `Link` for navigation; these primitives do not replace route semantics.
- Add variants only when the same intent occurs on at least three operator surfaces.
