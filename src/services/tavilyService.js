"use strict";

const config = require("../config");

const cache = new Map();

const CACHE_TIME =
  5 * 60 * 1000;

async function searchTavily(query, options = {}) {
  if (!config.tavilyApiKey) {
    return {
      success: false,
      configured: false,
      results: []
    };
  }

  const cleanQuery = String(query || "")
    .trim()
    .slice(0, 500);

  if (!cleanQuery) {
    return {
      success: false,
      configured: true,
      results: []
    };
  }

  const cacheKey = cleanQuery.toLowerCase();

  const cached = cache.get(cacheKey);

  if (
    cached &&
    Date.now() - cached.timestamp <
      CACHE_TIME
  ) {
    return {
      success: true,
      configured: true,
      cached: true,
      results: cached.results
    };
  }

  const response = await fetch(
    "https://api.tavily.com/search",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        api_key: config.tavilyApiKey,

        query: cleanQuery,

        search_depth:
          options.searchDepth || "advanced",

        topic:
          options.topic || "general",

        max_results:
          options.maxResults || 5,

        include_answer: true,

        include_raw_content: false
      })
    }
  );

  if (!response.ok) {
    const errorText =
      await response.text();

    throw new Error(
      `Tavily API error ${response.status}: ${errorText.slice(0, 500)}`
    );
  }

  const data = await response.json();

  const results = Array.isArray(data.results)
    ? data.results
    : [];

  cache.set(cacheKey, {
    timestamp: Date.now(),
    results
  });

  return {
    success: true,
    configured: true,
    cached: false,
    answer: data.answer || "",
    results
  };
}

module.exports = {
  searchTavily
};
