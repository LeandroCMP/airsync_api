import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from './user.schema';
import { UserPayroll, UserPayrollSchema } from './user-payroll.schema';
import { FinanceModule } from '../finance/finance.module';
import { FilesModule } from '../../core/files/files.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UserPayroll.name, schema: UserPayrollSchema }
    ]),
    FinanceModule,
    FilesModule
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService]
})
export class UsersModule {}
