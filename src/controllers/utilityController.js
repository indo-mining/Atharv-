"use strict";

const {
  getWeather
} = require("../services/weatherService");

async function weather(req, res) {
  const {
    lat,
    lon,
    latitude,
    longitude
  } = req.query;

  const result =
    await getWeather({
      latitude:
        latitude ?? lat,

      longitude:
        longitude ?? lon
    });

  return res.json(result);
}

module.exports = {
  weather
};
