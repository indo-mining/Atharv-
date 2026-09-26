"use strict";

const db = require("../config/db");

class Item {
  static getAll() {
    return db
      .prepare(`
        SELECT *
        FROM items
        ORDER BY id DESC
      `)
      .all();
  }

  static getById(id) {
    return db
      .prepare(`
        SELECT *
        FROM items
        WHERE id = ?
      `)
      .get(id);
  }

  static create({ title, description, price, category }) {
    const result = db
      .prepare(`
        INSERT INTO items (
          title,
          description,
          price,
          category
        )
        VALUES (?, ?, ?, ?)
      `)
      .run(
        title,
        description || "",
        price || 0,
        category || ""
      );

    return this.getById(result.lastInsertRowid);
  }

  static update(
    id,
    { title, description, price, category }
  ) {
    const result = db
      .prepare(`
        UPDATE items
        SET
          title = ?,
          description = ?,
          price = ?,
          category = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .run(
        title,
        description || "",
        price || 0,
        category || "",
        id
      );

    if (result.changes === 0) {
      return null;
    }

    return this.getById(id);
  }

  static delete(id) {
    const result = db
      .prepare(`
        DELETE FROM items
        WHERE id = ?
      `)
      .run(id);

    return result.changes > 0;
  }
}

module.exports = Item;
