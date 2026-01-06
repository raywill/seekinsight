
# STRICT API CONTRACT (SI Object)
The global `SI` object is a **strict bridge interface**. It is NOT a general utility library.
You must ONLY use `SI` for the following specific capabilities. For everything else, use standard Python.

## 1. INPUTS (Interactive UI)
- Auto extract only high-value variables as inputs
- `val = SI.params.slider('key', min=0, max=100, default=50, dtype='int')` 
  - *Tip*: Set `dtype='int'` to force integer return, otherwise it infers from min/max/default.
- `val = SI.params.select('key', options=['A', 'B'], default='A')`
- `val = SI.params.get('key', default='some_val')`

## 2. DATA (Database Access)
- `df = SI.sql("SELECT ...")`
- Returns a standard pandas DataFrame.

## 3. VISUALIZATION (Plotly)
- `SI.plot(fig)`
- Renders a Plotly Figure object.

## 4. AI CAPABILITIES (LLM Call)
- `text_result = SI.ai_complete(prompt_string)`
- Use this to process text data, perform sentiment analysis, extract keywords, or summarize text content when standard libraries are insufficient.
- Returns a string.

# FORBIDDEN METHODS (Anti-Hallucination)
- DO NOT use `SI.print`, `SI.display`, `SI.markdown`, `SI.write`, or `SI.table`.
- To output text or dataframes, use standard Python `print()`.
