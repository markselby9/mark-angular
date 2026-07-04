# mark-angular

A from-scratch reimplementation of the AngularJS (1.x) framework, built to
understand how it works internally — following Tero Parviainen's book
[*Build Your Own AngularJS*](http://teropa.info/build-your-own-angular).

> **Note:** This is a learning project from 2016. AngularJS reached
> [end-of-life in January 2022](https://blog.angular.io/discontinued-long-term-support-for-angularjs-cc066b82e65a).
> It's kept here as a reference and a record of the notes below — not for
> production use.

The `NOTEBOOK/` folder contains my detailed study notes (PDF) written while
building each part.

## Study notes

**Part 1 — Scopes** ([PDF](NOTEBOOK/Part%201-%20Scope.pdf))
1. Scopes and digest
2. Scope inheritance
3. Watching collections
4. Scope events

**Part 2 — Expressions and filters**
- [2.1](NOTEBOOK/Part%202-1--Expressions%20And%20Filters.pdf) — literal expressions; lookup and function-call expressions
- [2.2](NOTEBOOK/Part%202-2--Expressions%20And%20Filters.pdf) — operator expressions; filters
- [2.3](NOTEBOOK/Part%202-3--Expressions%20and%20Watches.pdf) — expressions and watches

**Part 3 — Modules and dependency injection** ([PDF](NOTEBOOK/Part%203-%20Modules%20And%20Dependency%20Injection.pdf))
10. Modules and the injector
11. Providers
12. High-level DI features

**Part 4 — Utilities** ([PDF](NOTEBOOK/Part%204-%20Utilities.pdf))
13. Promises
14. `$http`

**Part 5 — Directives**
- [5.1](NOTEBOOK/Part%205-1--Directives.pdf) — DOM compilation and basic directives; directive attributes; directive linking and scopes
- [5.2](NOTEBOOK/Part%205-2--Directives.pdf) — controllers; directive templates; directive transclusion
- [5.3](NOTEBOOK/Part%205-3--%20Directives.pdf) — interpolation; bootstrapping Angular

## Layout

- `src/` — the framework source
- `test/` — unit tests (Karma)
- `sample_application/` — a small app built with mark-angular; open the HTML page in a browser
- `markangular.js` / `markangular.min.js` — prebuilt bundles (Browserify + UglifyJS)

## Build

```sh
npm install
npm test        # run the Karma test suite
```
