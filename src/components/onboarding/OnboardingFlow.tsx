import React, { useState } from 'react';
import { WelcomeStep } from './WelcomeStep';
import { NameStep } from './NameStep';
import { GenderStep } from './GenderStep';
import { BirthDateStep } from './BirthDateStep';
import { CompletionStep } from './CompletionStep';
import { UserGender, UserProfile } from '../../types';
import { userProfileService } from '../../services/userProfileService';

export type OnboardingStepName = 'welcome' | 'name' | 'gender' | 'birthDate' | 'completion';

interface OnboardingFlowProps {
  initialProfile?: UserProfile | null;
  onComplete: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  initialProfile,
  onComplete,
}) => {
  const [currentStep, setCurrentStep] = useState<OnboardingStepName>('welcome');
  const [firstName, setFirstName] = useState(initialProfile?.firstName || '');
  const [lastName, setLastName] = useState(initialProfile?.lastName || '');
  const [gender, setGender] = useState<UserGender>(initialProfile?.gender || 'male');
  const [birthDate, setBirthDate] = useState(initialProfile?.birthDate || '2000-01-15');

  const handleFinish = async () => {
    try {
      await userProfileService.completeOnboarding({
        firstName,
        lastName,
        gender,
        birthDate,
      });
    } catch (e) {
      console.warn('[OnboardingFlow] error completing onboarding:', e);
    }
    onComplete();
  };

  return (
    <div className="w-full max-w-md min-h-[100dvh] bg-[#090D16] flex flex-col relative overflow-y-auto overflow-x-hidden safe-top safe-bottom">
      {/* Step Transition Wrapper */}
      <div className="w-full flex-1 flex flex-col animate-fade-in transition-all duration-300 min-h-0">
        {currentStep === 'welcome' && (
          <WelcomeStep onNext={() => setCurrentStep('name')} />
        )}

        {currentStep === 'name' && (
          <NameStep
            initialFirstName={firstName}
            initialLastName={lastName}
            onNext={(fName, lName) => {
              setFirstName(fName);
              setLastName(lName);
              setCurrentStep('gender');
            }}
            onBack={() => setCurrentStep('welcome')}
          />
        )}

        {currentStep === 'gender' && (
          <GenderStep
            initialGender={gender}
            onNext={(selectedGender) => {
              setGender(selectedGender);
              setCurrentStep('birthDate');
            }}
            onBack={() => setCurrentStep('name')}
          />
        )}

        {currentStep === 'birthDate' && (
          <BirthDateStep
            initialBirthDate={birthDate}
            onNext={(selectedBirthDate) => {
              setBirthDate(selectedBirthDate);
              setCurrentStep('completion');
            }}
            onBack={() => setCurrentStep('gender')}
          />
        )}

        {currentStep === 'completion' && (
          <CompletionStep firstName={firstName} onFinish={handleFinish} />
        )}
      </div>
    </div>
  );
};
