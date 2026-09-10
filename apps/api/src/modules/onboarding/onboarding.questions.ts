export interface OnboardingQuestionOption {
  value: string;
  label: string;
}

export interface OnboardingQuestion {
  key: string;
  question: string;
  options: OnboardingQuestionOption[];
}

export const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  {
    key: 'friday_night',
    question: 'Your ideal Friday night?',
    options: [
      { value: 'friends', label: 'Out with friends' },
      { value: 'home', label: 'Chilling at home' },
      { value: 'explore', label: 'Exploring somewhere new' },
      { value: 'create', label: 'Making/building something' },
    ],
  },
  {
    key: 'learn_or_make',
    question: 'What sounds more like you?',
    options: [
      { value: 'learn', label: 'Learning something new' },
      { value: 'make', label: 'Making something myself' },
      { value: 'both', label: 'A bit of both' },
    ],
  },
  {
    key: 'plan_or_improvise',
    question: 'How do you usually approach things?',
    options: [
      { value: 'plan', label: 'Plan everything' },
      { value: 'improvise', label: 'Go with the flow' },
      { value: 'mix', label: 'Depends on the situation' },
    ],
  },
  {
    key: 'natural_activity',
    question: 'Which activity feels most natural to you?',
    options: [
      { value: 'building', label: 'Building / creating' },
      { value: 'music', label: 'Music / art' },
      { value: 'people', label: 'Meeting people' },
      { value: 'exploring', label: 'Exploring / discovering' },
    ],
  },
];
