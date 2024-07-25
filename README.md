# Koja

A simple online Python playground. [Try it now!](https://onlinepython.github.io/)

## Developing

### Pyodide caveat

The Pyodide release at `public/pyodide_0.26.1` exactly matches the [official 0.261.1 release](https://github.com/pyodide/pyodide/releases/download/0.26.1/pyodide-0.26.1.tar.bz2) except for the following:

1. `python_flint-0.6.0-cp312-cp312-pyodide_2024_0_wasm32.whl.metadata` is missing
2. `python_flint-0.6.0-cp312-cp312-pyodide_2024_0_wasm32.whl` is missing

I removed the Python FLINT `.whl` file because it exceeded GitHub's file size limits.
Then, I removed the `.whl.metadata` file, since it didn't make sense to keep it without the accompanying `.whl` file.

This shouldn't affect you, unless for some reason you are expecting the Pyodide release to exactly match the official release.

## Attribution

[Settings](https://icons8.com/icon/2969/settings) icon by [Icons8](https://icons8.com).
