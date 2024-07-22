# Koja

A simple online Python playground.

## Developing

Simply running `npm install` and then `npm start` will **NOT** work.
You need to first install Pyodide.

### Installing Pyodide

You will need to install Pyodide.
While I'd ideally like to include it in this Git repository, some of the files are too large.
So, you will need to manually install it by:

1. Downloading the [compressed archive of Pyodide 0.26.1](https://github.com/pyodide/pyodide/releases/download/0.26.1/pyodide-0.26.1.tar.bz2).
2. Decompress the archive.
3. Rename the decompressed directory `pyodide_0.26.1`.
4. Move that directory to this repository's `public` directory.

Now, you should have a directory `public/pyodide_0.26.1` that has a ton of files.
