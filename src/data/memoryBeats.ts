export type MemoryBeat = {
  floor: number;
  title: string;
  fragmentLines: string[];
  houseLine: string;
};

export const MEMORY_BEATS: Record<number, MemoryBeat> = {
  2: {
    floor: 2,
    title: 'A face returns.',
    fragmentLines: [
      'A polished desk. White teeth. Gold cufflinks.',
      '"The winnings are real," the recruiter had said.',
      'You remember how quickly you wanted to believe him.',
    ],
    houseLine: 'Still looking for the exit? It is above you. Keep climbing.',
  },
  3: {
    floor: 3,
    title: 'Terms surface.',
    fragmentLines: [
      'Paper under your hand. Percentages. Penalty clauses.',
      '"One climb. One vault. Enough money to fix it."',
      'Your signature looked desperate even then.',
    ],
    houseLine: "You're starting to remember. I can tell. That's fine.",
  },
  4: {
    floor: 4,
    title: 'The promise sharpens.',
    fragmentLines: [
      'You remember nodding before the recruiter finished the offer.',
      '"You will not need luck if you can endure the House."',
      'You told yourself it was a plan, not gambling.',
    ],
    houseLine: 'You always called it a plan when it was really hunger.',
  },
  5: {
    floor: 5,
    title: 'The vault is close.',
    fragmentLines: [
      'The debt comes back in flashes. The notices. The call you let ring out.',
      'You remember climbing for more than escape. There was something waiting at the top.',
      'The vault is real. The full truth is still sealed behind it.',
    ],
    houseLine: 'Close now. Close enough to feel what you came here for.',
  },
};
