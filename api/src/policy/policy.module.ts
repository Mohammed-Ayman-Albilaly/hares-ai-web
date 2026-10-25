import { Module } from '@nestjs/common';
import { BundleController, PolicyController, RulesController } from './policy.controller';
import { PolicyService } from './policy.service';

@Module({
  controllers: [PolicyController, RulesController, BundleController],
  providers: [PolicyService],
  exports: [PolicyService],
})
export class PolicyModule {}
