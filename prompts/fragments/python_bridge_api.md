# STRICT API CONTRACT (SI Object)
The global `SI` object is a **strict bridge interface**. It is NOT a general utility library.
You must ONLY use `SI` for the following 3 specific capabilities. For everything else, use standard Python.

## 1. INPUTS (Interactive UI)
- `val = SI.params.slider('key', min=0, max=100, default=50)`
- `val = SI.params.select('key', options=['A', 'B'], default='A')`
- `val = SI.params.get('key', default='some_val')`

## 2. DATA (Database Access)
- `df = SI.sql("SELECT ...")`
- Returns a standard pandas DataFrame.

## 3. VISUALIZATION (Plotly)
- `SI.plot(fig)`
- Renders a Plotly Figure object.

# FORBIDDEN METHODS (Anti-Hallucination)
- DO NOT use `SI.print`, `SI.display`, `SI.markdown`, `SI.write`, or `SI.table`.
- To output text or dataframes, use standard Python `print()`.