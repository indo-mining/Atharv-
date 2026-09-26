"use strict";

const Item = require("../models/Item");

function validateItem(body) {
  const title =
    typeof body.title === "string"
      ? body.title.trim()
      : "";

  const description =
    typeof body.description === "string"
      ? body.description.trim()
      : "";

  const category =
    typeof body.category === "string"
      ? body.category.trim()
      : "";

  const price =
    body.price === undefined ||
    body.price === null ||
    body.price === ""
      ? 0
      : Number(body.price);

  if (!title) {
    return {
      valid: false,
      message: "Title is required."
    };
  }

  if (!Number.isFinite(price) || price < 0) {
    return {
      valid: false,
      message: "Price must be a valid positive number."
    };
  }

  return {
    valid: true,
    data: {
      title,
      description,
      price,
      category
    }
  };
}

exports.getItems = (req, res, next) => {
  try {
    const items = Item.getAll();

    res.json({
      success: true,
      count: items.length,
      items
    });
  } catch (error) {
    next(error);
  }
};

exports.getItem = (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid item ID."
      });
    }

    const item = Item.getById(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found."
      });
    }

    res.json({
      success: true,
      item
    });
  } catch (error) {
    next(error);
  }
};

exports.createItem = (req, res, next) => {
  try {
    const validation = validateItem(req.body);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message
      });
    }

    const item = Item.create(validation.data);

    res.status(201).json({
      success: true,
      message: "Item created successfully.",
      item
    });
  } catch (error) {
    next(error);
  }
};

exports.updateItem = (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid item ID."
      });
    }

    const validation = validateItem(req.body);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message
      });
    }

    const item = Item.update(
      id,
      validation.data
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found."
      });
    }

    res.json({
      success: true,
      message: "Item updated successfully.",
      item
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteItem = (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid item ID."
      });
    }

    const deleted = Item.delete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Item not found."
      });
    }

    res.json({
      success: true,
      message: "Item deleted successfully."
    });
  } catch (error) {
    next(error);
  }
};
