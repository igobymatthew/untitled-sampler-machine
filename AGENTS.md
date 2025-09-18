# Agent Guidelines

## Required checks
- Run `npm run build` from the `frontend` directory before finishing any task.
- Run `npm run test` from the `frontend` directory when frontend code is touched.

## Code style notes
- Keep scheduler-related logic aware of the full pattern length (bars × steps).
- Prefer sharing decoded audio data through the buffer store instead of globals.
- Use the shared TypeScript types from `shared/` when exchanging data between layers.

## Ideas to explore later
- Persist decoded buffers alongside project data so sessions reload faster.
- Add buffer registration to the sample recorder so recorded clips can play immediately.
- Investigate swing and per-step velocity support in the scheduler.
