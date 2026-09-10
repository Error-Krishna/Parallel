import { IsIn, IsString } from 'class-validator';
import { ONBOARDING_QUESTIONS } from '../onboarding.questions.js';

const QUESTION_KEYS = ONBOARDING_QUESTIONS.map((question) => question.key);

export class OnboardingAnswerDto {
  @IsString()
  @IsIn(QUESTION_KEYS)
  questionKey!: string;

  @IsString()
  answerValue!: string;
}
