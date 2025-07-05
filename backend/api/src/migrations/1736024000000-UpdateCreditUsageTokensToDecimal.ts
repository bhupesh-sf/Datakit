import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateCreditUsageTokensToDecimal1736024000000 implements MigrationInterface {
    name = 'UpdateCreditUsageTokensToDecimal1736024000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Update inputTokens column to DECIMAL(10,2)
        await queryRunner.query(`ALTER TABLE "credit_usage" ALTER COLUMN "inputTokens" TYPE DECIMAL(10,2)`);
        
        // Update outputTokens column to DECIMAL(10,2)
        await queryRunner.query(`ALTER TABLE "credit_usage" ALTER COLUMN "outputTokens" TYPE DECIMAL(10,2)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert inputTokens column to INTEGER
        await queryRunner.query(`ALTER TABLE "credit_usage" ALTER COLUMN "inputTokens" TYPE INTEGER`);
        
        // Revert outputTokens column to INTEGER
        await queryRunner.query(`ALTER TABLE "credit_usage" ALTER COLUMN "outputTokens" TYPE INTEGER`);
    }
}