import { OnboardingService } from './onboarding.service.js';
import { Controller } from '@nestjs/common';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}
}
