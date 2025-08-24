import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePostgresConnectionsTable1752185454247 implements MigrationInterface {
  name = 'CreatePostgresConnectionsTable1752185454247';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "postgres_connections" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "host" character varying NOT NULL,
        "port" integer NOT NULL,
        "database" character varying NOT NULL,
        "username" character varying NOT NULL,
        "encryptedPassword" text NOT NULL,
        "schema" character varying,
        "sslEnabled" boolean NOT NULL DEFAULT false,
        "sslConfig" json,
        "connectionTimeout" integer NOT NULL DEFAULT '30',
        "queryTimeout" integer NOT NULL DEFAULT '30000',
        "isActive" boolean NOT NULL DEFAULT true,
        "lastConnectionTest" TIMESTAMP,
        "lastConnectionError" character varying,
        "metadata" json,
        "userId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_postgres_connections" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_postgres_connections_userId" ON "postgres_connections" ("userId")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_postgres_connections_userId_name" 
      ON "postgres_connections" ("userId", "name")
    `);

    await queryRunner.query(`
      ALTER TABLE "postgres_connections" 
      ADD CONSTRAINT "FK_postgres_connections_userId" 
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "postgres_connections" 
      DROP CONSTRAINT "FK_postgres_connections_userId"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_postgres_connections_userId_name"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_postgres_connections_userId"
    `);

    await queryRunner.query(`
      DROP TABLE "postgres_connections"
    `);
  }
}