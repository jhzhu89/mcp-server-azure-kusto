Execute KQL queries against the database. Always add limits and filters for performance.

Essential patterns:
- Exploration: "TableName | take 10"
- Analysis: "TableName | where TimeGenerated > ago(1h) | summarize count() by column"
- Avoid: "TableName" without limits (may return 100K+ rows)

Performance guidelines:
- DEFAULT: Always limit time window to 1 day or less (ago(1d)) unless user specifies otherwise
- Use time filters early: "where TimeGenerated > ago(1h)" 