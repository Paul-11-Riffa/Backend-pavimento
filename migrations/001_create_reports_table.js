/**
 * Migración: Crear tabla de reportes con soporte geoespacial.
 *
 * - Habilita la extensión PostGIS
 * - Crea la tabla 'reports' con columna de geometría nativa
 * - Agrega índice espacial GiST para consultas rápidas
 */

exports.up = async function (knex) {
  // Habilitar PostGIS (idempotente)
  await knex.raw('CREATE EXTENSION IF NOT EXISTS postgis');
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  await knex.schema.createTable('reports', (table) => {
    // ID único generado por la base de datos
    table
      .uuid('id')
      .primary()
      .defaultTo(knex.raw('uuid_generate_v4()'));

    // Nombre de la calle reportada
    table.string('street_name', 255).notNullable();

    // Descripción libre del daño
    table.text('description').defaultTo('');

    // Nivel de daño: leve | moderado | severo | critico
    table
      .string('damage_level', 20)
      .notNullable()
      .defaultTo('moderado');

    // Estado del reporte: pendiente | en_revision | en_reparacion | solucionado | rechazado
    table
      .string('status', 20)
      .notNullable()
      .defaultTo('pendiente');

    // Contador de confirmaciones ciudadanas
    table.integer('confirmations').notNullable().defaultTo(1);

    // Timestamps
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // Agregar columna de geometría PostGIS (acepta LineString y Polygon, SRID 4326)
  await knex.raw(`
    ALTER TABLE reports
    ADD COLUMN geom geometry(Geometry, 4326) NOT NULL
  `);

  // Índice espacial GiST para consultas rápidas por área
  await knex.raw(`
    CREATE INDEX reports_geom_gist
    ON reports USING GIST (geom)
  `);

  // Índice para filtrado por estado
  await knex.raw(`
    CREATE INDEX reports_status_idx
    ON reports (status)
  `);
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('reports');
};
