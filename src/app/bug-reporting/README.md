# Bug Reporting Prototype

This folder is a drop-in Angular bug-reporting prototype. It captures safe diagnostic metadata only and is designed to be copied into another Angular app with minimal setup.

## What it does

The system keeps an in-memory diagnostic timeline and can record:

- safe click actions from elements marked with `data-bug-action`
- Angular Router navigation events
- Angular `HttpClient` request metadata
- uncaught Angular/UI errors
- a manual bug report payload built from the current timeline

It does not intentionally capture:

- form field values
- DOM text content
- request bodies
- response bodies
- authorization headers
- cookies
- query parameter values
- customer/user names
- raw IDs from URLs

## Folder layout

The code is grouped by concern:

- `models/` - shared TypeScript contracts and enums
- `services/` - diagnostic timeline, confidence scoring, click tracking, and optional POST submission
- `network/` - endpoint normalization and the HTTP interceptor
- `providers/` - app bootstrap setup, config token, and NgModule wrapper
- `bug-report-demo/` - demo page for testing the flow
- `bug-report-form/` - reactive bug report form

## How the system works

### 1. Click tracking

`BugActivityTrackerService` listens for document-level click events after the system is enabled.

Only elements with a safe attribute like this are recorded:

```html
<button data-bug-action="OPEN_USER">Open User</button>
```

If a clicked element or one of its parents does not contain a safe `data-bug-action`, the click is ignored.

### 2. Navigation tracking

The bootstrap provider listens to Angular Router navigation changes and records normalized route changes as diagnostic events.

### 3. HTTP tracking

`BugNetworkDiagnosticInterceptor` records metadata from Angular `HttpClient` requests only.

It tracks:

- HTTP method
- normalized endpoint
- start time
- duration
- status code
- success or failure

It does not record request or response bodies.

### 4. Confidence scoring

`BugConfidenceService` analyzes the current timeline and returns a deterministic score, level, and reasons.

It looks for signals such as:

- 5xx responses
- network failures
- UI errors
- 404, 400, 409, 401, 403 responses
- slow requests
- repeated endpoint failures
- repeated semantic click actions

### 5. Bug report submission

`BugReportFormComponent` builds a payload that includes:

- the bug report fields
- the environment snapshot
- the diagnostic timeline snapshot
- the computed confidence result

By default the form can log locally to the console in JSON or table format. If configured for POST mode, it can send the payload to a real endpoint.

## Copying into another Angular app

If you copy this folder into another Angular project, the usual setup is:

1. Copy the entire `bug-reporting/` folder into the target app under `src/app/bug-reporting/`.
2. Register the bug-reporting provider in the target app bootstrap.
3. If the target app uses NgModules instead of standalone bootstrap, use the module wrapper instead.
4. Set the `submitUrl` if you want the bug report form to POST to a real backend.

## Standalone app hookup

In `app.config.ts`:

```ts
import { provideBugReporting } from './bug-reporting/providers/bug-reporting.bootstrap';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBugReporting({
      enabled: true,
      submissionMode: 'post',
      submitUrl: '/api/bug-reports',
      appVersion: 'my-app'
    })
  ]
};
```

That single provider call turns on:

- click tracking
- router tracking
- Angular `HttpClient` tracking
- uncaught error capture

## NgModule hookup

If the target app uses modules:

```ts
import { BugReportingModule } from './bug-reporting/providers/bug-reporting.module';

@NgModule({
  imports: [
    BugReportingModule.forRoot({
      enabled: true,
      submissionMode: 'post',
      submitUrl: '/api/bug-reports',
      appVersion: 'my-app'
    })
  ]
})
export class AppModule {}
```

## Do I need to change existing API code?

Usually, no.

If the app already uses Angular `HttpClient` for `GET`, `POST`, `PUT`, `PATCH`, and `DELETE`, the interceptor will see those requests automatically.

You only need API changes if the app uses another transport, such as:

- `fetch`
- `axios`
- a custom client that bypasses Angular interceptors

If that happens, either move those calls to `HttpClient` or add a small adapter so the requests flow through Angular's interceptor chain.

## Form and Angular forms setup

If the target app already uses Angular reactive forms, no special changes are needed.

The bug report form is standalone and already imports its own Angular Material and form dependencies.

## Optional configuration

The main configuration is defined in `providers/bug-reporting.config.ts`.

Important options include:

- `enabled` - master on/off switch
- `trackClicks` - document click tracking
- `trackHttp` - `HttpClient` tracking
- `trackNavigation` - Router tracking
- `trackErrors` - uncaught error capture
- `defaultOutputFormat` - console output style for the form
- `submissionMode` - `console` or `post`
- `submitUrl` - optional POST endpoint
- `appVersion` - version label stored in the payload

## Demo page

The demo page lives at `/bug-report-demo` and is useful for verifying that:

- click tracking works
- fake API events show up in the timeline
- confidence scoring updates as expected
- the report form logs or submits the final payload

## Typical integration checklist

1. Copy the folder.
2. Register `provideBugReporting(...)` or `BugReportingModule.forRoot(...)`.
3. Set `submitUrl` if you want real POST submission.
4. Add a route for `/bug-report-demo` if you want the demo page.
5. Add `data-bug-action` to any button or clickable element you want tracked.

## Example safe actions

Use safe semantic action names such as:

- `OPEN_CALENDAR`
- `OPEN_USER`
- `OPEN_MODAL`
- `CLOSE_MODAL`
- `SAVE_ADDRESS`
- `SEARCH`
- `NEXT_PAGE`
- `PREVIOUS_PAGE`
- `SUBMIT_FORM`

## Notes

- The timeline is kept in memory only.
- The confidence scorer is deterministic and rule-based.
- The demo and form are intentionally isolated so you can test the system before wiring it into the rest of an app.