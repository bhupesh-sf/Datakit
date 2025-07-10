import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWaitlistTable1752185454246 implements MigrationInterface {
  name = 'CreateWaitlistTable1752185454246';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TYPE "public"."waitlist_status_enum" AS ENUM('pending', 'contacted', 'converted', 'cancelled')
        `);

    await queryRunner.query(`
            CREATE TABLE "waitlist" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "email" character varying NOT NULL,
                "featureName" character varying NOT NULL,
                "userId" uuid,
                "status" "public"."waitlist_status_enum" NOT NULL DEFAULT 'pending',
                "metadata" jsonb,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_waitlist_id" PRIMARY KEY ("id")
            )
        `);

    await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_waitlist_email_featureName" ON "waitlist" ("email", "featureName")
        `);

    await queryRunner.query(`
            ALTER TABLE "waitlist" 
            ADD CONSTRAINT "FK_waitlist_userId" 
            FOREIGN KEY ("userId") 
            REFERENCES "users"("id") 
            ON DELETE SET NULL ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "waitlist" DROP CONSTRAINT "FK_waitlist_userId"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_waitlist_email_featureName"`,
    );
    await queryRunner.query(`DROP TABLE "waitlist"`);
    await queryRunner.query(`DROP TYPE "public"."waitlist_status_enum"`);
  }
}
