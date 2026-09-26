"use strict";

const cache = new Map();

const CACHE_TIME =
  5 * 60 * 1000;

async function getWeather({
  latitude,
  longitude
}) {
  const lat = Number(latitude);
  const lon = Number(longitude);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon)
  ) {
    throw new Error(
      "Valid latitude and longitude are required."
    );
  }

  if (
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    throw new Error(
      "Invalid latitude or longitude."
    );
  }

  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;

  const cached = cache.get(key);

  if (
    cached &&
    Date.now() - cached.timestamp <
      CACHE_TIME
  ) {
    return {
      ...cached.data,
      cached: true
    };
  }

  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${encodeURIComponent(lat)}` +
    `&longitude=${encodeURIComponent(lon)}` +
    "&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m" +
    "&hourly=temperature_2m,precipitation_probability" +
    "&timezone=auto";

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Weather API error ${response.status}`
    );
  }

  const data = await response.json();

  const result = {
    success: true,
    latitude: data.latitude,
    longitude: data.longitude,
    timezone: data.timezone,
    current: data.current || null,
    hourly: data.hourly || null,
    cached: false
  };

  cache.set(key, {
    timestamp: Date.now(),
    data: result
  });

  return result;
}

module.exports = {
  getWeather
};
