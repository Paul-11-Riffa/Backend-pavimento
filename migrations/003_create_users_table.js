const bcrypt = require('bcryptjs');

/**
 * Migración: Crear tabla de usuarios para el sistema de policías.
 */

exports.up = async function (knex) {
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('username', 100).notNullable().unique();
    table.string('password_hash', 255).notNullable();
    table.string('role', 50).notNullable().defaultTo('police');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // Insertar usuario administrador / policía inicial
  const passwordHash = await bcrypt.hash('admin123', 10);
  await knex('users').insert([
    {
      username: 'admin',
      password_hash: passwordHash,
      role: 'admin'
    },
    {
      username: 'policia1',
      password_hash: await bcrypt.hash('policia123', 10),
      role: 'police'
    }
  ]);
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('users');
};
