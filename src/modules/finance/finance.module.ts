import { Module } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { FinanceTransaction, FinanceTransactionSchema } from './finance-transaction.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: FinanceTransaction.name, schema: FinanceTransactionSchema }])],
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService]
})
export class FinanceModule {}
