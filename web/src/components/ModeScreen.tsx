import React from 'react';
import { BigButton } from './BigButton';

interface ModeScreenProps {
  title: string;
  description: string;
  onStop: () => void;
  children?: React.ReactNode;
}

export const ModeScreen: React.FC<ModeScreenProps> = ({
  title,
  description,
  onStop,
  children,
}) => {
  return (
    <main className="flex flex-col flex-1 h-full w-full p-4 max-w-lg mx-auto justify-between gap-4">
      <header className="text-center pt-2">
        <h1 className="text-3xl font-black text-yellow-400 tracking-wide">{title}</h1>
        <p className="text-zinc-300 text-lg mt-1" aria-live="polite">
          {description}
        </p>
      </header>

      <section className="flex-1 flex flex-col justify-center items-center my-4 w-full">
        {children}
      </section>

      <footer className="w-full pb-4">
        <BigButton
          label="Stop Mode (Exit)"
          variant="danger"
          onClick={onStop}
          className="w-full h-24"
          ariaDescription="Stops the current active mode and returns to main menu"
        />
      </footer>
    </main>
  );
};
