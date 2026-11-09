-- 007_seed_prompts.sql
-- Seed initial speaking prompts across diverse categories

insert into public.prompts (title, description, category, suggested_seconds) values
(
  'Introduce yourself in 60 seconds',
  'Summarize who you are, your background, what drives you, and what you are currently working on.',
  'Introduction',
  60
),
(
  'Explain a project you are proud of',
  'Walk through a technical or creative project: the core problem, your architectural choices, and the measurable impact.',
  'Technical',
  90
),
(
  'Pitch a startup idea',
  'Pitch a product solution to an unsolved customer problem. State the value proposition, target market, and why now.',
  'Pitch',
  90
),
(
  'Describe your biggest professional challenge',
  'Share a difficult situation at work or school, how you navigated conflicting priorities or obstacles, and what you learned.',
  'Behavioral',
  90
),
(
  'Teach a complex concept to a 5-year-old',
  'Pick an intricate concept (like cloud computing, gravity, or machine learning) and explain it using simple analogies.',
  'Explanation',
  60
),
(
  'Give a 1-minute product demo',
  'Showcase your favorite digital or physical product. Highlight the "aha!" moment that makes people love using it.',
  'Pitch',
  60
),
(
  'Tell a story about a time you failed',
  'Discuss an endeavor that did not go as planned. Focus on personal accountability, recovery, and subsequent growth.',
  'Behavioral',
  90
),
(
  'Explain why you are the best fit for your dream role',
  'Articulate your unique strengths, track record, and how your specific perspective accelerates team outcomes.',
  'Interview',
  90
),
(
  'Summarize a book or article you recently read',
  'Distill the primary thesis and 2-3 key takeaways from a book, podcast, or essay that shaped your thinking.',
  'General',
  60
),
(
  'Convince someone to try your favorite hobby',
  'Persuade a skeptic to pick up your hobby. Explain the physical, mental, or creative joy it brings you.',
  'Persuasion',
  60
)
on conflict do nothing;

