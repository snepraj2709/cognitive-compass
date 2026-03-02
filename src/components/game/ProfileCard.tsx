"use client";

import { motion } from "framer-motion";
import type { PublicProfile } from "@/types/game";

interface ProfileCardProps {
  profile: PublicProfile;
  clueRevealed: boolean;
  onRevealClue: () => void;
}

export function ProfileCard({ profile, clueRevealed, onRevealClue }: ProfileCardProps) {
  return (
    <motion.div
      key={profile.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="surface-glass rounded-lg p-6"
    >
      <div className="mb-4 flex min-w-0 items-center gap-3">
        <span className="text-3xl" role="img" aria-label={profile.name}>
          {profile.avatar}
        </span>
        <div className="min-w-0">
          <h2 className="break-words text-lg font-bold">{profile.name}</h2>
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`inline-block rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                profile.difficulty === "EASY"
                  ? "bg-easy/10 text-easy"
                  : profile.difficulty === "MEDIUM"
                  ? "bg-medium/10 text-medium"
                  : "bg-hard/10 text-hard"
              }`}
            >
              {profile.difficulty}
            </span>
            <span className="min-w-0 break-words text-xs text-muted-foreground">{profile.context}</span>
          </div>
        </div>
      </div>

      <blockquote className="mb-4 break-words font-body text-sm italic leading-relaxed text-foreground/90">
        {profile.scenario}
      </blockquote>

      {!clueRevealed ? (
        <button
          onClick={onRevealClue}
          className="dim-label transition-colors hover:text-foreground"
          aria-label="Reveal behavioral clues"
        >
          ⟐ Reveal clues (−3 XP)
        </button>
      ) : (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="flex flex-wrap gap-1.5"
        >
          {profile.clues.map((clue, i) => (
            <span
              key={i}
              className="rounded-md bg-primary/10 px-2 py-1 font-mono text-xs text-primary"
            >
              &quot;{clue}&quot;
            </span>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
