import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../../utils';

const STORAGE_KEY = 'duovet_onboarding_state_v1';
const RUNTIME_KEY = 'duovet_onboarding_runtime_v1';

const DESKTOP_STEPS = [
  {
    id: 'settings',
    target: 'menu-settings-desktop',
    page: 'settings',
    title: 'Perfil profissional',
    description: 'Comece no Perfil para completar seus dados, identidade visual e assinatura digital.',
    placement: 'right'
  },
  {
    id: 'clients',
    target: 'menu-clients-desktop',
    page: 'clients',
    title: 'Cadastro de clientes',
    description: 'Depois, acesse Clientes para cadastrar os proprietários e fazendas atendidas.',
    placement: 'right'
  },
  {
    id: 'animals',
    target: 'menu-animals-desktop',
    page: 'animals',
    title: 'Cadastro de animais',
    description: 'Em seguida, registre os animais vinculados aos seus clientes.',
    placement: 'right'
  },
  {
    id: 'appointments',
    target: 'menu-appointments-desktop',
    page: 'appointments',
    title: 'Fluxo de atendimentos',
    description: 'Use Atendimentos para acompanhar histórico, status e retornos.',
    placement: 'right'
  },
  {
    id: 'new-appointment',
    target: 'dashboard-new-appointment',
    page: 'dashboard',
    title: 'Primeiro atendimento',
    description: 'No Dashboard, use este botão para criar seu primeiro atendimento.',
    placement: 'bottom'
  }
];

const MOBILE_STEPS = [
  {
    id: 'open-menu',
    target: 'mobile-open-menu',
    title: 'Abra o menu',
    description: 'No celular, toque em Menu para acessar todas as guias do sistema.',
    placement: 'top'
  },
  {
    id: 'settings-mobile',
    target: 'menu-settings-mobile',
    page: 'settings',
    title: 'Perfil profissional',
    description: 'Toque em Perfil para completar seus dados e personalizar documentos.',
    placement: 'right',
    keepMenuOpen: true
  },
  {
    id: 'clients-mobile',
    target: 'menu-clients-mobile',
    page: 'clients',
    title: 'Cadastro de clientes',
    description: 'Acesse Clientes para cadastrar proprietários e fazendas.',
    placement: 'right',
    keepMenuOpen: true
  },
  {
    id: 'animals-mobile',
    target: 'menu-animals-mobile',
    page: 'animals',
    title: 'Cadastro de animais',
    description: 'Depois, entre em Animais para registrar os animais dos clientes.',
    placement: 'right',
    keepMenuOpen: true
  },
  {
    id: 'appointments-mobile',
    target: 'menu-appointments-mobile',
    page: 'appointments',
    title: 'Fluxo de atendimentos',
    description: 'Use Atendimentos para controlar evolução, retornos e histórico.',
    placement: 'right',
    keepMenuOpen: true
  },
  {
    id: 'new-appointment-mobile',
    target: 'dashboard-new-appointment',
    page: 'dashboard',
    title: 'Primeiro atendimento',
    description: 'No Dashboard, toque no botão para criar seu primeiro atendimento.',
    placement: 'top'
  }
];

function readState() {
  if (typeof window === 'undefined') {
    return { completed: false, skipped: false };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { completed: false, skipped: false };
    }
    const parsed = JSON.parse(raw);
    return {
      completed: Boolean(parsed?.completed),
      skipped: Boolean(parsed?.skipped)
    };
  } catch {
    return { completed: false, skipped: false };
  }
}

function persistState(nextState) {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}

function readRuntime() {
  if (typeof window === 'undefined') {
    return { isRunning: false, stepIndex: 0 };
  }
  try {
    const raw = localStorage.getItem(RUNTIME_KEY);
    if (!raw) {
      return { isRunning: false, stepIndex: 0 };
    }
    const parsed = JSON.parse(raw);
    const parsedStep = Number(parsed?.stepIndex);
    return {
      isRunning: Boolean(parsed?.isRunning),
      stepIndex: Number.isInteger(parsedStep) && parsedStep >= 0 ? parsedStep : 0
    };
  } catch {
    return { isRunning: false, stepIndex: 0 };
  }
}

function persistRuntime(nextRuntime) {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.setItem(RUNTIME_KEY, JSON.stringify(nextRuntime));
}

function clearRuntime() {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.removeItem(RUNTIME_KEY);
}

function getTooltipPosition(rect, placement) {
  if (!rect) {
    return {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)'
    };
  }

  const gap = 18;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top = rect.top + rect.height / 2;
  let left = rect.left + rect.width / 2;
  let transform = 'translate(-50%, -50%)';

  if (placement === 'right') {
    top = rect.top + rect.height / 2;
    left = rect.right + gap;
    transform = 'translateY(-50%)';
  }

  if (placement === 'left') {
    top = rect.top + rect.height / 2;
    left = rect.left - gap;
    transform = 'translate(-100%, -50%)';
  }

  if (placement === 'top') {
    top = rect.top - gap;
    left = rect.left + rect.width / 2;
    transform = 'translate(-50%, -100%)';
  }

  if (placement === 'bottom') {
    top = rect.bottom + gap;
    left = rect.left + rect.width / 2;
    transform = 'translateX(-50%)';
  }

  const maxLeft = vw - 24;
  const minLeft = 24;
  const maxTop = vh - 24;
  const minTop = 24;

  return {
    top: Math.max(minTop, Math.min(maxTop, top)),
    left: Math.max(minLeft, Math.min(maxLeft, left)),
    transform
  };
}

export default function OnboardingGuide({
  currentPageName,
  isMobileMenuOpen,
  setIsMobileMenuOpen
}) {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [isRunning, setIsRunning] = useState(() => readRuntime().isRunning);
  const [stepIndex, setStepIndex] = useState(() => readRuntime().stepIndex);
  const [targetRect, setTargetRect] = useState(null);
  const [onboardingState, setOnboardingState] = useState(readState);
  const startRequestedRef = useRef(false);

  const steps = useMemo(() => (isMobile ? MOBILE_STEPS : DESKTOP_STEPS), [isMobile]);
  const currentStep = steps[stepIndex];

  useEffect(() => {
    const updateViewport = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useEffect(() => {
    if (isRunning || onboardingState.completed || onboardingState.skipped) {
      return;
    }
    const timer = setTimeout(() => setShowWelcome(true), 450);
    return () => clearTimeout(timer);
  }, [isRunning, onboardingState.completed, onboardingState.skipped]);

  useEffect(() => {
    const handleStart = () => {
      const fresh = { completed: false, skipped: false };
      persistState(fresh);
      clearRuntime();
      setOnboardingState(fresh);
      setStepIndex(0);
      setIsRunning(false);
      setShowWelcome(true);
      setTargetRect(null);
    };
    window.addEventListener('duovet:start-onboarding', handleStart);
    return () => window.removeEventListener('duovet:start-onboarding', handleStart);
  }, []);

  useEffect(() => {
    if (!isRunning) {
      clearRuntime();
      return;
    }
    persistRuntime({ isRunning: true, stepIndex });
  }, [isRunning, stepIndex]);

  useEffect(() => {
    if (stepIndex < steps.length) {
      return;
    }
    setStepIndex(Math.max(0, steps.length - 1));
  }, [stepIndex, steps.length]);

  useEffect(() => {
    if (!isRunning || !currentStep) {
      return;
    }

    if (isMobile && currentStep.keepMenuOpen && !isMobileMenuOpen) {
      setIsMobileMenuOpen(true);
    }

    if (isMobile && !currentStep.keepMenuOpen && currentStep.target !== 'mobile-open-menu' && isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
    }
  }, [currentStep, isMobile, isMobileMenuOpen, isRunning, setIsMobileMenuOpen]);

  useEffect(() => {
    if (!isRunning || !currentStep) {
      setTargetRect(null);
      return;
    }

    let frameId = null;
    let intervalId = null;

    const updateTargetRect = () => {
      const element = document.querySelector(`[data-onboarding="${currentStep.target}"]`);
      if (!element) {
        setTargetRect(null);
        return;
      }
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setTargetRect(null);
        return;
      }
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom
      });
    };

    const onScrollOrResize = () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
      frameId = requestAnimationFrame(updateTargetRect);
    };

    updateTargetRect();
    intervalId = setInterval(updateTargetRect, 250);
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);

    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
      if (intervalId) {
        clearInterval(intervalId);
      }
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [currentStep, isRunning, currentPageName]);

  const closeWelcomeAndSkip = () => {
    const nextState = { completed: false, skipped: true };
    persistState(nextState);
    clearRuntime();
    setOnboardingState(nextState);
    setShowWelcome(false);
    setIsRunning(false);
    setStepIndex(0);
  };

  const startTutorial = () => {
    startRequestedRef.current = true;
    setShowWelcome(false);
    setIsRunning(true);
    setStepIndex(0);
  };

  const skipTutorial = () => {
    const nextState = { completed: false, skipped: true };
    persistState(nextState);
    clearRuntime();
    setOnboardingState(nextState);
    setIsRunning(false);
    setStepIndex(0);
    setTargetRect(null);
  };

  const finishTutorial = () => {
    const nextState = { completed: true, skipped: false };
    persistState(nextState);
    clearRuntime();
    setOnboardingState(nextState);
    setIsRunning(false);
    setStepIndex(0);
    setTargetRect(null);
    setIsMobileMenuOpen(false);
  };

  const goToCurrentStepPage = () => {
    if (!currentStep?.page) {
      return;
    }
    navigate(createPageUrl(currentStep.page));
  };

  const goNext = () => {
    if (!currentStep) {
      finishTutorial();
      return;
    }
    if (currentStep.page && currentPageName !== currentStep.page) {
      goToCurrentStepPage();
      return;
    }
    if (stepIndex >= steps.length - 1) {
      finishTutorial();
      return;
    }
    setStepIndex((prev) => prev + 1);
  };

  const goPrev = () => {
    setStepIndex((prev) => Math.max(0, prev - 1));
  };

  const tooltipPosition = getTooltipPosition(targetRect, currentStep?.placement || 'bottom');
  const arrowClassByPlacement = {
    right: '-left-2 top-1/2 -translate-y-1/2',
    left: '-right-2 top-1/2 -translate-y-1/2',
    top: 'left-1/2 -bottom-2 -translate-x-1/2',
    bottom: 'left-1/2 -top-2 -translate-x-1/2'
  };
  const arrowClass = arrowClassByPlacement[currentStep?.placement || 'bottom'];
  const desktopTooltipWidth = 360;
  const mobileTooltipStyle = {
    left: 16,
    right: 16,
    bottom: 'max(1rem, env(safe-area-inset-bottom))',
    top: 'auto',
    transform: 'none',
    width: 'auto',
    maxWidth: 'none',
    maxHeight: 'calc(100vh - 2rem)'
  };
  const desktopTooltipStyle = {
    ...tooltipPosition,
    maxWidth: 'calc(100vw - 32px)',
    left: typeof tooltipPosition.left === 'number'
      ? Math.max(16, Math.min(tooltipPosition.left, window.innerWidth - desktopTooltipWidth - 16))
      : tooltipPosition.left,
    top: typeof tooltipPosition.top === 'number'
      ? Math.max(20, Math.min(tooltipPosition.top, window.innerHeight - 120))
      : tooltipPosition.top
  };
  const tooltipStyle = isMobile ? mobileTooltipStyle : desktopTooltipStyle;

  return (
    <>
      <Dialog
        open={showWelcome}
        onOpenChange={(open) => {
          if (open) {
            setShowWelcome(true);
            return;
          }
          if (startRequestedRef.current) {
            startRequestedRef.current = false;
            return;
          }
          closeWelcomeAndSkip();
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4 text-black sm:p-6 dark:bg-slate-900 dark:border-slate-700 dark:text-white">
          <DialogHeader>
            <DialogTitle>Bem-vindo ao DuoVet</DialogTitle>
            <DialogDescription className="text-gray-700 dark:text-gray-300">
              Vamos mostrar o caminho ideal para configurar seu perfil e começar a atender.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl border border-black bg-white text-black hover:bg-gray-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
              onClick={closeWelcomeAndSkip}
            >
              Pular tutorial
            </Button>
            <Button
              type="button"
              className="rounded-xl border border-black bg-white text-black hover:bg-gray-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
              onClick={startTutorial}
            >
              Começar tutorial
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isRunning && currentStep ? (
        <div className="fixed inset-0 z-[95]">
          <div className="pointer-events-none absolute inset-0 bg-black/45" />

          {targetRect ? (
            <div
              className="pointer-events-none fixed rounded-xl border-2 border-[var(--accent)]"
              style={{
                top: targetRect.top - 6,
                left: targetRect.left - 6,
                width: targetRect.width + 12,
                height: targetRect.height + 12,
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5), 0 0 0 4px rgba(34, 197, 94, 0.22)'
              }}
            />
          ) : null}

          <div
            className="fixed z-[96] w-[min(90vw,360px)] rounded-2xl border border-gray-200 bg-white p-3 sm:p-4 text-black shadow-2xl dark:bg-slate-900 dark:border-slate-700 dark:text-white mx-auto max-h-[calc(100vh-40px)] overflow-y-auto sm:w-[min(92vw,380px)]"
            style={tooltipStyle}
          >
            {targetRect && !isMobile ? (
              <span
                className={`absolute h-4 w-4 rotate-45 border border-gray-200 bg-white dark:bg-slate-900 dark:border-slate-700 ${arrowClass}`}
              />
            ) : null}
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
              Passo {stepIndex + 1} de {steps.length}
            </div>
            <h3 className="text-xs sm:text-sm font-semibold">{currentStep.title}</h3>
            <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300">{currentStep.description}</p>

            {currentStep.page && currentPageName !== currentStep.page ? (
              <Button
                type="button"
                className="mt-2 sm:mt-3 h-8 sm:h-9 rounded-xl border border-black bg-white text-black hover:bg-gray-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 text-xs sm:text-sm"
                onClick={goToCurrentStepPage}
              >
                Ir para esta guia
              </Button>
            ) : null}

            <div className="mt-3 sm:mt-4 flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                className="h-7 sm:h-8 px-2 border border-black bg-white text-black hover:bg-gray-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 text-xs sm:text-sm"
                onClick={skipTutorial}
              >
                Pular
              </Button>
              <div className="flex items-center gap-1 sm:gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-7 sm:h-8 px-2 rounded-lg border border-black bg-white text-black hover:bg-gray-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 text-xs sm:text-sm"
                  onClick={goPrev}
                  disabled={stepIndex === 0}
                >
                  Voltar
                </Button>
                <Button
                  type="button"
                  className="h-7 sm:h-8 px-2 rounded-lg border border-black bg-white text-black hover:bg-gray-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 text-xs sm:text-sm"
                  onClick={goNext}
                >
                  {stepIndex === steps.length - 1 ? 'Concluir' : 'Próximo'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
