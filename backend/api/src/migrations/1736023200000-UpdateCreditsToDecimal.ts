import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateCreditsToDecimal1736023200000 implements MigrationInterface {
    name = 'UpdateCreditsToDecimal1736023200000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Update creditsRemaining column to DECIMAL(10,4)
        await queryRunner.query(`ALTER TABLE "subscriptions" ALTER COLUMN "creditsRemaining" TYPE DECIMAL(10,4)`);
        
        // Update monthlyCredits column to DECIMAL(10,4)
        await queryRunner.query(`ALTER TABLE "subscriptions" ALTER COLUMN "monthlyCredits" TYPE DECIMAL(10,4)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert creditsRemaining column to INTEGER
        await queryRunner.query(`ALTER TABLE "subscriptions" ALTER COLUMN "creditsRemaining" TYPE INTEGER`);
        
        // Revert monthlyCredits column to INTEGER
        await queryRunner.query(`ALTER TABLE "subscriptions" ALTER COLUMN "monthlyCredits" TYPE INTEGER`);
    }
}