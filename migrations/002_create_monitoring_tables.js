/**
 * Migración: Crear tablas del Sistema de Monitoreo de Áreas Restringidas.
 *
 * Tablas:
 *  1. restricted_zones — Polígonos de cárceles/áreas restringidas
 *  2. inmates          — Reos registrados con zona asignada
 *  3. gps_positions    — Historial de posiciones GPS
 *  4. alerts           — Alertas de violación de zona
 */

exports.up = async function (knex) {
  // Asegurar extensiones PostGIS
  await knex.raw('CREATE EXTENSION IF NOT EXISTS postgis');
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  // ─── 1. Zonas Restringidas ──────────────────────────────────────────────────

  await knex.schema.createTable('restricted_zones', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('name', 255).notNullable();
    table.text('description').defaultTo('');
    table.string('status', 20).notNullable().defaultTo('activa'); // activa | inactiva
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // Columna de geometría PostGIS (solo Polygon, SRID 4326)
  await knex.raw(`
    ALTER TABLE restricted_zones
    ADD COLUMN geom geometry(Polygon, 4326) NOT NULL
  `);

  // Índice espacial GiST
  await knex.raw(`
    CREATE INDEX restricted_zones_geom_gist
    ON restricted_zones USING GIST (geom)
  `);

  // Índice por status
  await knex.raw(`
    CREATE INDEX restricted_zones_status_idx
    ON restricted_zones (status)
  `);

  // ─── 2. Reos ────────────────────────────────────────────────────────────────

  await knex.schema.createTable('inmates', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('name', 255).notNullable();
    table.string('identification', 100).notNullable().unique(); // CI o código interno
    table
      .uuid('zone_id')
      .references('id')
      .inTable('restricted_zones')
      .onDelete('SET NULL');
    table.string('device_id', 255).defaultTo(null); // identificador del teléfono/GPS
    table.string('status', 20).notNullable().defaultTo('activo'); // activo | inactivo | fugado
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.raw(`
    CREATE INDEX inmates_zone_id_idx ON inmates (zone_id)
  `);

  await knex.raw(`
    CREATE INDEX inmates_status_idx ON inmates (status)
  `);

  // ─── 3. Posiciones GPS ──────────────────────────────────────────────────────

  await knex.schema.createTable('gps_positions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table
      .uuid('inmate_id')
      .notNullable()
      .references('id')
      .inTable('inmates')
      .onDelete('CASCADE');
    table.float('accuracy').defaultTo(null); // precisión GPS en metros
    table.boolean('is_inside_zone').defaultTo(true);
    table.timestamp('recorded_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // Columna de geometría PostGIS (Point, SRID 4326)
  await knex.raw(`
    ALTER TABLE gps_positions
    ADD COLUMN point geometry(Point, 4326) NOT NULL
  `);

  // Índice espacial GiST
  await knex.raw(`
    CREATE INDEX gps_positions_point_gist
    ON gps_positions USING GIST (point)
  `);

  // Índice para consultas por reo + tiempo
  await knex.raw(`
    CREATE INDEX gps_positions_inmate_time_idx
    ON gps_positions (inmate_id, recorded_at DESC)
  `);

  // ─── 4. Alertas de Violación ────────────────────────────────────────────────

  await knex.schema.createTable('alerts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table
      .uuid('inmate_id')
      .notNullable()
      .references('id')
      .inTable('inmates')
      .onDelete('CASCADE');
    table
      .uuid('zone_id')
      .notNullable()
      .references('id')
      .inTable('restricted_zones')
      .onDelete('CASCADE');
    table.float('distance_meters').defaultTo(0); // distancia fuera de la zona
    table.string('status', 20).notNullable().defaultTo('activa'); // activa | reconocida | resuelta
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('resolved_at', { useTz: true }).defaultTo(null);
  });

  // Columna de geometría PostGIS (Point donde se detectó la violación)
  await knex.raw(`
    ALTER TABLE alerts
    ADD COLUMN position geometry(Point, 4326) NOT NULL
  `);

  // Índice espacial
  await knex.raw(`
    CREATE INDEX alerts_position_gist
    ON alerts USING GIST (position)
  `);

  // Índice por status para consultas rápidas de alertas activas
  await knex.raw(`
    CREATE INDEX alerts_status_idx ON alerts (status)
  `);

  // Índice por reo
  await knex.raw(`
    CREATE INDEX alerts_inmate_id_idx ON alerts (inmate_id)
  `);
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('alerts');
  await knex.schema.dropTableIfExists('gps_positions');
  await knex.schema.dropTableIfExists('inmates');
  await knex.schema.dropTableIfExists('restricted_zones');
};
